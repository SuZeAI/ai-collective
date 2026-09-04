"""Loop-detection middleware — breaks staff loops that repeat a tool call."""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from langchain.agents.middleware import AgentMiddleware, ToolCallRequest
from langchain_core.messages import ToolMessage
from langgraph.types import Command

from server.api.settings import settings
from server.infra.llm.middleware.helpers import loop_signature
from server.share.log import get_logger


def _default_loop_max_repeats() -> int:
    return settings.llm.loop_detection_max_repeats


class LoopDetectionMiddleware(AgentMiddleware):
    """Detect and break staff loops that repeat an identical tool call.

    A stuck staff often re-issues the *same* tool call (same name + args) over
    and over, burning its whole round budget (and tokens, and per-tool timeouts)
    without making progress. When the current call has already been made
    ``max_repeats`` times earlier in the run, this middleware **does not
    re-execute it**; instead it returns a ``ToolMessage`` telling the model the
    call is repeating and to use the prior result, change approach, or finalize
    (a "soft nudge" — the run stays alive).

    Detection is **stateless**: it scans the per-run message history
    (``request.state["messages"]``) rather than holding instance counters. This
    is required because compiled agents are memoized in ``agent_builder`` and
    shared across concurrent runs/threads. ``max_repeats <= 0`` disables it.
    """

    def __init__(self, *, max_repeats: int | None = None) -> None:
        super().__init__()
        self._max_repeats = (
            max_repeats if max_repeats is not None else _default_loop_max_repeats()
        )

    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Awaitable[ToolMessage | Command]],
    ) -> ToolMessage | Command:
        if not self._max_repeats or self._max_repeats <= 0:
            return await handler(request)

        tool_call = request.tool_call or {}
        name = tool_call.get("name", "")
        signature = loop_signature(name, tool_call.get("args"))

        prior = 0
        state = request.state or {}
        messages = state.get("messages", []) if isinstance(state, dict) else []
        for message in messages:
            for prev in getattr(message, "tool_calls", None) or []:
                prev_name = prev.get("name", "") if isinstance(prev, dict) else ""
                prev_args = prev.get("args") if isinstance(prev, dict) else None
                if loop_signature(prev_name, prev_args) == signature:
                    prior += 1

        if prior >= self._max_repeats:
            get_logger().warning(
                "Loop detected: tool '%s' called identically %d time(s); short-circuiting.",
                name,
                prior,
            )
            return ToolMessage(
                tool_call_id=tool_call.get("id", ""),
                name=name,
                content=(
                    f"Loop detected: this exact call to '{name}' was already made "
                    f"{prior} time(s) with the same arguments and was not re-executed. "
                    "Use the previous result, change your approach, or give your final answer."
                ),
            )

        return await handler(request)
