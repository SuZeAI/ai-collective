"""Guardrail middleware — block dangerous tool calls before they execute."""

from __future__ import annotations

import json
import re
from collections.abc import Awaitable, Callable

from langchain.agents.middleware import AgentMiddleware, ToolCallRequest
from langchain_core.messages import ToolMessage
from langgraph.types import Command

from backend.api.settings import settings
from backend.log import get_logger


class GuardrailMiddleware(AgentMiddleware):
    """Block dangerous tool calls before they execute.

    Refuses (returns an explanatory ``ToolMessage`` instead of running) when the
    tool is on the deny list or its serialized args match a deny pattern. A
    last-line safety net for destructive operations.
    """

    def __init__(self, *, deny_tools: list[str] | None = None, deny_patterns: list[str] | None = None) -> None:
        super().__init__()
        self._deny_tools = {t.lower() for t in (deny_tools or settings.llm.guardrail_deny_tool_list())}
        raw_patterns = deny_patterns if deny_patterns is not None else settings.llm.guardrail_deny_pattern_list()
        self._patterns = [re.compile(p, re.IGNORECASE) for p in raw_patterns if p]

    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Awaitable[ToolMessage | Command]],
    ) -> ToolMessage | Command:
        tool_call = request.tool_call or {}
        name = tool_call.get("name", "")
        args_text = ""
        try:
            args_text = json.dumps(tool_call.get("args"), default=str)
        except Exception:  # noqa: BLE001
            args_text = str(tool_call.get("args"))
        blocked = name.lower() in self._deny_tools or any(p.search(args_text) for p in self._patterns)
        if blocked:
            get_logger().warning("Guardrail: blocked tool call '%s'", name)
            return ToolMessage(
                tool_call_id=tool_call.get("id", ""),
                name=name,
                content=(
                    f"Blocked by guardrail policy: the call to '{name}' was not executed "
                    "because it matches a denied tool or argument pattern. Choose a safer action."
                ),
            )
        return await handler(request)
