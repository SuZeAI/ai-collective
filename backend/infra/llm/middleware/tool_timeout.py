"""Per-tool timeout middleware."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable

from langchain.agents.middleware import AgentMiddleware, ToolCallRequest
from langchain_core.messages import ToolMessage
from langgraph.types import Command

from backend.infra.llm.middleware.helpers import default_tool_timeout
from backend.log import get_logger


class ToolTimeoutMiddleware(AgentMiddleware):
    """Bound each tool call to ``timeout`` seconds.

    On timeout the tool call resolves to a ``ToolMessage`` describing the
    timeout (instead of hanging or raising), preserving the behaviour the old
    ``_execute_tool_call`` had. ``timeout <= 0`` disables the bound.
    """

    def __init__(self, *, timeout: int | None = None) -> None:
        super().__init__()
        self._timeout = timeout if timeout is not None else default_tool_timeout()

    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Awaitable[ToolMessage | Command]],
    ) -> ToolMessage | Command:
        if not self._timeout or self._timeout <= 0:
            return await handler(request)

        tool_call = request.tool_call or {}
        name = tool_call.get("name", "")
        try:
            return await asyncio.wait_for(handler(request), timeout=self._timeout)
        except asyncio.TimeoutError:
            get_logger().warning("Tool '%s' timed out after %ss", name, self._timeout)
            return ToolMessage(
                tool_call_id=tool_call.get("id", ""),
                name=name,
                content=f"Tool '{name}' timed out after {self._timeout}s.",
            )
