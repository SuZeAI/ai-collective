"""Tool-result cache middleware — serve identical idempotent calls from the run."""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from langchain.agents.middleware import AgentMiddleware, ToolCallRequest
from langchain_core.messages import ToolMessage
from langgraph.types import Command

from server.api.settings import settings
from server.infra.llm.middleware.helpers import loop_signature, state_messages
from server.share.log import get_logger


class ToolResultCacheMiddleware(AgentMiddleware):
    """Serve identical idempotent tool calls from the in-run cache.

    Scans the per-run message history for a prior ``ToolMessage`` produced by the
    same tool with the same canonical args and, if found, returns it instead of
    re-executing. Complements ``LoopDetectionMiddleware`` (which only nudges) by
    actually reusing the result. Stateless — works off ``state['messages']`` —
    and skips any tool on the deny list (non-idempotent tools).
    """

    def __init__(self, *, deny_tools: list[str] | None = None) -> None:
        super().__init__()
        self._deny = set(deny_tools or settings.llm.tool_cache_deny_list())

    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Awaitable[ToolMessage | Command]],
    ) -> ToolMessage | Command:
        tool_call = request.tool_call or {}
        name = tool_call.get("name", "")
        if not name or name in self._deny:
            return await handler(request)
        signature = loop_signature(name, tool_call.get("args"))

        messages = state_messages(getattr(request, "state", None))
        # Map each tool_call id -> signature, then find a ToolMessage whose
        # originating call matches our signature.
        id_to_sig: dict[str, tuple[str, str]] = {}
        for message in messages:
            for prev in getattr(message, "tool_calls", None) or []:
                if isinstance(prev, dict) and prev.get("id"):
                    id_to_sig[prev["id"]] = loop_signature(prev.get("name", ""), prev.get("args"))
        for message in messages:
            if isinstance(message, ToolMessage):
                origin = id_to_sig.get(getattr(message, "tool_call_id", ""))
                if origin == signature:
                    get_logger().info("ToolResultCache: reusing prior result for '%s'", name)
                    return ToolMessage(
                        tool_call_id=tool_call.get("id", ""),
                        name=name,
                        content=getattr(message, "content", ""),
                    )
        return await handler(request)
