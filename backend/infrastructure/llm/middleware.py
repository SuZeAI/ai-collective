"""Agent middleware for the LangChain ``create_agent`` chat path.

The provider's ``chat()`` no longer hand-rolls a ReAct loop; it delegates to
``create_agent`` (see ``agent_builder.py``). The cross-cutting behaviours that
loop used to implement inline are expressed here as middleware, following
https://docs.langchain.com/oss/python/langchain/middleware/overview :

* **Round bound + final answer** — ``ModelCallLimitMiddleware`` replaces the old
  ``max_tool_rounds`` loop and the forced "final round synthesize" turn.
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
import os
from collections.abc import Awaitable, Callable

from langchain_core.messages import ToolMessage
from langgraph.types import Command

from langchain.agents.middleware import (
    AgentMiddleware,
    ModelCallLimitMiddleware,
    ModelFallbackMiddleware,
    SummarizationMiddleware,
    ToolCallRequest,
    ToolRetryMiddleware,
)

from backend.log import get_logger


def _default_tool_timeout() -> int:
    """Per-tool timeout in seconds (0 disables). Mirrors the old helper."""
    try:
        return max(0, int(os.getenv("TOOL_TIMEOUT_SECONDS", "0")))
    except ValueError:
        return 0


def _env_int(name: str, default: int) -> int:
    try:
        return int(float(os.getenv(name, str(default))))
    except (TypeError, ValueError):
        return default


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _env_list(name: str) -> list[str]:
    raw = os.getenv(name) or ""
    return [part.strip() for part in raw.replace("\n", ",").split(",") if part.strip()]


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


def build_default_middleware(
    *,
    max_tool_rounds: int,
    tool_timeout: int | None = None,
) -> list[AgentMiddleware]:
    """Assemble the default middleware stack for a chat agent.

    Always present:
      * ``ModelCallLimitMiddleware`` — caps model calls per run and ends with a
        final answer (replaces the old ``max_tool_rounds`` loop).
      * ``ToolTimeoutMiddleware`` — custom per-tool timeout.
      * ``ToolRetryMiddleware`` — retries transient tool failures (gated, on by
        default with ``LLM_TOOL_RETRY_MAX``).

    Conditionally present (only when configured, to avoid surprising behaviour):
      * ``ModelFallbackMiddleware`` — when ``LLM_FALLBACK_MODELS`` is set.
      * ``SummarizationMiddleware`` — when ``LLM_SUMMARIZATION_ENABLED`` is set.
    """
    middleware: list[AgentMiddleware] = [
        ModelCallLimitMiddleware(run_limit=max(1, max_tool_rounds), exit_behavior="end"),
    ]

    retry_max = _env_int("LLM_TOOL_RETRY_MAX", 2)
    if retry_max > 0:
        middleware.append(
            ToolRetryMiddleware(max_retries=retry_max, on_failure="return_message")
        )

    middleware.append(ToolTimeoutMiddleware(timeout=tool_timeout))

    fallback_models = _env_list("LLM_FALLBACK_MODELS")
    if fallback_models:
        middleware.append(ModelFallbackMiddleware(*fallback_models))

    if _env_bool("LLM_SUMMARIZATION_ENABLED"):
        summary_model = os.getenv("LLM_SUMMARIZATION_MODEL")
        if summary_model:
            middleware.append(
                SummarizationMiddleware(
                    model=summary_model,
                    trigger=("tokens", _env_int("LLM_SUMMARIZATION_TRIGGER_TOKENS", 8000)),
                    keep=("messages", _env_int("LLM_SUMMARIZATION_KEEP_MESSAGES", 20)),
                )
            )
        else:
            get_logger().warning(
                "LLM_SUMMARIZATION_ENABLED set but LLM_SUMMARIZATION_MODEL is empty; "
                "summarization middleware not added."
            )

    return middleware
