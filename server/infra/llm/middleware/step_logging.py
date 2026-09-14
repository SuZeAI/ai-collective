"""Step-logging middleware — concise per-round trace of model/tool activity."""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from typing import Any

from langchain.agents.middleware import AgentMiddleware, ToolCallRequest
from langchain_core.messages import ToolMessage
from langgraph.types import Command

from server.infra.llm.middleware.helpers import message_text, truncate
from server.share.log import get_logger


class StepLoggingMiddleware(AgentMiddleware):
    """Log one line per step: model round number, tool name, input, output.

    Placed as the outermost tool wrapper so the logged output reflects what
    every inner wrapper (cache, retry, PII redaction) finally produced — one
    line per attempted call, not one per retry. Input/output previews are
    truncated to ``preview_chars`` so a run stays readable in the logs.
    """

    def __init__(self, *, preview_chars: int = 300) -> None:
        super().__init__()
        self._preview_chars = preview_chars

    def before_model(self, state: Any, runtime: Any) -> dict[str, Any] | None:  # noqa: ANN401
        run_count = state.get("run_model_call_count", 0) if isinstance(state, dict) else 0
        get_logger().info("Step %d: calling model", run_count + 1)
        return None

    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Awaitable[ToolMessage | Command]],
    ) -> ToolMessage | Command:
        tool_call = request.tool_call or {}
        name = tool_call.get("name", "")
        try:
            args_preview = json.dumps(tool_call.get("args"), ensure_ascii=False, default=str)
        except Exception:  # noqa: BLE001 — args should always encode, but never break a run
            args_preview = str(tool_call.get("args"))
        get_logger().info("Step tool call: %s(%s)", name, truncate(args_preview, self._preview_chars))

        result = await handler(request)

        output_preview = message_text(result) if isinstance(result, ToolMessage) else str(result)
        get_logger().info("Step tool result: %s -> %s", name, truncate(output_preview, self._preview_chars))
        return result
