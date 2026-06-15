"""Agent middleware for the LangChain ``create_agent`` chat path.

The provider's ``chat()`` no longer hand-rolls a ReAct loop; it delegates to
``create_agent`` (see ``agent_builder.py``). The cross-cutting behaviours that
loop used to implement inline are expressed here as middleware, following
https://docs.langchain.com/oss/python/langchain/middleware/overview :

* **Round bound + final answer** — ``ModelCallLimitMiddleware`` replaces the old
  ``max_tool_rounds`` loop and the forced "final round synthesize" turn.
* **Loop detection** — ``LoopDetectionMiddleware`` (custom, below) breaks an agent
  that re-issues the same tool call (same name + args) without progressing.
* **Per-tool timeout** — ``ToolTimeoutMiddleware`` (custom, below) replaces the
  ``asyncio.wait_for`` in the old ``_execute_tool_call``.
* **Tool retry / model fallback** — ``ToolRetryMiddleware`` / ``ModelFallbackMiddleware``
  complement the existing API-key rotation (``rotation.py``).
* **Summarization** — ``SummarizationMiddleware`` compacts long histories. OFF by
  default so it never collides with the orchestrator-level working-memory /
  token-budget machinery.

All knobs are read from environment variables in the same spirit as
``RotationConfig.from_env()`` in ``rotation.py``.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import Awaitable, Callable

from langchain_core.messages import ToolMessage
from langgraph.types import Command

from langchain.agents.middleware import (
    AgentMiddleware,
    ClearToolUsesEdit,
    ContextEditingMiddleware,
    ModelCallLimitMiddleware,
    ModelFallbackMiddleware,
    ModelRetryMiddleware,
    SummarizationMiddleware,
    ToolCallLimitMiddleware,
    ToolCallRequest,
    ToolRetryMiddleware,
)

from backend.api.settings import settings
from backend.log import get_logger


def _default_tool_timeout() -> int:
    """Per-tool timeout in seconds (0 disables)."""
    return max(0, settings.agent.tool_timeout_seconds)


class ToolTimeoutMiddleware(AgentMiddleware):
    """Bound each tool call to ``timeout`` seconds.

    On timeout the tool call resolves to a ``ToolMessage`` describing the
    timeout (instead of hanging or raising), preserving the behaviour the old
    ``_execute_tool_call`` had. ``timeout <= 0`` disables the bound.
    """

    def __init__(self, *, timeout: int | None = None) -> None:
        super().__init__()
        self._timeout = timeout if timeout is not None else _default_tool_timeout()

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


def _loop_signature(name: str, args: object) -> tuple[str, str]:
    """Stable signature for a tool call (name + canonicalized args)."""
    try:
        encoded = json.dumps(args, sort_keys=True, default=str)
    except Exception:  # noqa: BLE001 — args should always encode, but never break a run
        encoded = repr(args)
    return name, encoded


def _default_loop_max_repeats() -> int:
    return settings.llm.loop_detection_max_repeats


class LoopDetectionMiddleware(AgentMiddleware):
    """Detect and break agent loops that repeat an identical tool call.

    A stuck agent often re-issues the *same* tool call (same name + args) over
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
        signature = _loop_signature(name, tool_call.get("args"))

        prior = 0
        state = request.state or {}
        messages = state.get("messages", []) if isinstance(state, dict) else []
        for message in messages:
            for prev in getattr(message, "tool_calls", None) or []:
                prev_name = prev.get("name", "") if isinstance(prev, dict) else ""
                prev_args = prev.get("args") if isinstance(prev, dict) else None
                if _loop_signature(prev_name, prev_args) == signature:
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


def build_default_middleware(
    *,
    max_tool_rounds: int,
    tool_timeout: int | None = None,
) -> list[AgentMiddleware]:
    """Assemble the default middleware stack for a chat agent.

    Always present:
      * ``ModelCallLimitMiddleware`` — caps model calls per run and ends with a
        final answer (replaces the old ``max_tool_rounds`` loop).
      * ``LoopDetectionMiddleware`` — breaks repeated-identical-tool-call loops
        (gated, on by default with ``LLM_LOOP_DETECTION_ENABLED``). Placed before
        retry/timeout so a detected loop short-circuits without burning those.
      * ``ToolTimeoutMiddleware`` — custom per-tool timeout.
      * ``ToolRetryMiddleware`` — retries transient tool failures (gated, on by
        default with ``LLM_TOOL_RETRY_MAX``).

    Conditionally present (only when configured, to avoid surprising behaviour):
      * ``ToolCallLimitMiddleware`` — when ``LLM_TOOL_CALL_LIMIT`` > 0.
      * ``ModelFallbackMiddleware`` — when ``LLM_FALLBACK_MODELS`` is set.
      * ``ModelRetryMiddleware`` — when ``LLM_MODEL_RETRY_MAX`` > 0.
      * ``ContextEditingMiddleware`` — when ``LLM_CONTEXT_EDITING_ENABLED`` is set.
      * ``SummarizationMiddleware`` — when ``LLM_SUMMARIZATION_ENABLED`` is set.
    """
    middleware: list[AgentMiddleware] = [
        ModelCallLimitMiddleware(run_limit=max(1, max_tool_rounds), exit_behavior="end"),
    ]

    tool_call_limit = settings.llm.tool_call_limit
    if tool_call_limit > 0:
        middleware.append(
            ToolCallLimitMiddleware(run_limit=tool_call_limit, exit_behavior="end")
        )

    # Loop detection wraps tool calls; keep it ahead of retry/timeout so a
    # repeated call is short-circuited before those wrappers do any work.
    if settings.llm.loop_detection_enabled:
        middleware.append(LoopDetectionMiddleware())

    retry_max = settings.llm.tool_retry_max
    if retry_max > 0:
        middleware.append(
            ToolRetryMiddleware(max_retries=retry_max, on_failure="return_message")
        )

    middleware.append(ToolTimeoutMiddleware(timeout=tool_timeout))

    fallback_models = settings.llm.fallback_model_list()
    if fallback_models:
        middleware.append(ModelFallbackMiddleware(*fallback_models))

    model_retry_max = settings.llm.model_retry_max
    if model_retry_max > 0:
        middleware.append(
            ModelRetryMiddleware(max_retries=model_retry_max, on_failure="continue")
        )

    if settings.llm.context_editing_enabled:
        middleware.append(
            ContextEditingMiddleware(
                edits=[
                    ClearToolUsesEdit(
                        trigger=settings.llm.context_editing_trigger_tokens,
                        keep=settings.llm.context_editing_keep,
                    )
                ]
            )
        )

    if settings.llm.summarization_enabled:
        summary_model = settings.llm.summarization_model
        if summary_model:
            middleware.append(
                SummarizationMiddleware(
                    model=summary_model,
                    trigger=("tokens", settings.llm.summarization_trigger_tokens),
                    keep=("messages", settings.llm.summarization_keep_messages),
                )
            )
        else:
            get_logger().warning(
                "LLM_SUMMARIZATION_ENABLED set but LLM_SUMMARIZATION_MODEL is empty; "
                "summarization middleware not added."
            )

    return middleware
