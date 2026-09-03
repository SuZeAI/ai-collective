"""Assemble the default middleware stack for a chat staff."""

from __future__ import annotations

from langchain.agents.middleware import (
    AgentMiddleware,
    ClearToolUsesEdit,
    ContextEditingMiddleware,
    ModelCallLimitMiddleware,
    ModelFallbackMiddleware,
    ModelRetryMiddleware,
    SummarizationMiddleware,
    ToolCallLimitMiddleware,
    ToolRetryMiddleware,
)
from langchain_anthropic.middleware import AnthropicPromptCachingMiddleware

from backend.infra.llm.middleware.config import get_middleware_config
from backend.infra.llm.middleware.cost_budget import CostBudgetMiddleware
from backend.infra.llm.middleware.guardrail import GuardrailMiddleware
from backend.infra.llm.middleware.long_term_memory import LongTermMemoryMiddleware
from backend.infra.llm.middleware.loop_detection import LoopDetectionMiddleware
from backend.infra.llm.middleware.pii_redaction import PIIRedactionMiddleware
from backend.infra.llm.middleware.rolling_summary import RollingSummaryMiddleware
from backend.infra.llm.middleware.tool_result_cache import ToolResultCacheMiddleware
from backend.infra.llm.middleware.tool_timeout import ToolTimeoutMiddleware
from backend.log import get_logger


def build_default_middleware(
    *,
    max_tool_rounds: int,
    tool_timeout: int | None = None,
) -> list[AgentMiddleware]:
    """Assemble the default middleware stack for a chat staff.

    Component enablement and knobs come from :func:`get_middleware_config`, which
    reads the ``middleware:`` section of config.yml and falls back to the
    ``settings.llm.*`` defaults for anything not declared there.

    Always present:
      * ``ModelCallLimitMiddleware`` — caps model calls per run and ends with a
        final answer (replaces the old ``max_tool_rounds`` loop).
      * ``LoopDetectionMiddleware`` — breaks repeated-identical-tool-call loops.
        Placed before retry/timeout so a detected loop short-circuits.
      * ``ToolTimeoutMiddleware`` — custom per-tool timeout.
      * ``ToolRetryMiddleware`` — retries transient tool failures (when max > 0).

    Conditionally present (only when configured):
      * ``ToolCallLimitMiddleware`` — when ``tool_call_limit`` > 0.
      * ``GuardrailMiddleware`` — when deny tools/patterns are configured.
      * ``ToolResultCacheMiddleware`` — when ``tool_cache.enabled``.
      * ``PIIRedactionMiddleware`` — when ``pii_redaction.enabled``.
      * ``AnthropicPromptCachingMiddleware`` — when ``prompt_cache.enabled``
        (Anthropic provider only; no-op elsewhere).
      * ``ModelFallbackMiddleware`` — when ``model_fallback.models`` set.
      * ``ModelRetryMiddleware`` — when ``model_retry.max`` > 0.
      * ``ContextEditingMiddleware`` — when ``context_editing.enabled``.
      * ``SummarizationMiddleware`` — when ``summarization.enabled``.
      * ``RollingSummaryMiddleware`` — when ``rolling_summary.enabled``.
      * ``LongTermMemoryMiddleware`` — when ``long_term_memory.enabled``.
      * ``CostBudgetMiddleware`` — when ``cost_budget.run_token_budget`` > 0.

    Ordering rationale: guardrail/PII protect tool execution, cache serves before
    retry/timeout, loop-detection → retry → timeout wrap the actual call, and the
    model-facing trio (summary → LTM recall → cost budget) acts around the model.
    """
    cfg = get_middleware_config()

    middleware: list[AgentMiddleware] = [
        ModelCallLimitMiddleware(run_limit=max(1, max_tool_rounds), exit_behavior="end"),
    ]

    if cfg.tool_call_limit > 0:
        middleware.append(
            ToolCallLimitMiddleware(run_limit=cfg.tool_call_limit, exit_behavior="end")
        )

    # Guardrail first: a denied/dangerous tool call must be blocked before any
    # other wrapper (cache/retry/timeout) does work on it.
    if cfg.guardrail_deny_tools or cfg.guardrail_deny_patterns:
        middleware.append(
            GuardrailMiddleware(
                deny_tools=cfg.guardrail_deny_tools,
                deny_patterns=cfg.guardrail_deny_patterns,
            )
        )

    # Cache next: serve an identical idempotent call from the run before loop
    # detection / retry / timeout.
    if cfg.tool_cache_enabled:
        middleware.append(ToolResultCacheMiddleware(deny_tools=cfg.tool_cache_deny_tools))

    # Loop detection wraps tool calls; keep it ahead of retry/timeout so a
    # repeated call is short-circuited before those wrappers do any work.
    if cfg.loop_detection_enabled:
        middleware.append(LoopDetectionMiddleware(max_repeats=cfg.loop_detection_max_repeats))

    if cfg.tool_retry_max > 0:
        middleware.append(
            ToolRetryMiddleware(max_retries=cfg.tool_retry_max, on_failure="return_message")
        )

    middleware.append(ToolTimeoutMiddleware(timeout=tool_timeout))

    # PII redaction wraps the executed tool result (innermost of the tool
    # wrappers) so it scrubs the raw output before it re-enters the history.
    if cfg.pii_redaction_enabled:
        middleware.append(PIIRedactionMiddleware())

    # Anthropic prompt caching: marks the system prompt/tools/last-message
    # prefix as cacheable so repeat model calls (agent loop rounds, subagent
    # fan-out, multi-turn meetings) reuse cached input tokens. No-op — silently
    # skipped, not warned — on every non-Anthropic provider.
    if cfg.prompt_cache_enabled:
        middleware.append(
            AnthropicPromptCachingMiddleware(
                ttl=cfg.prompt_cache_ttl,
                min_messages_to_cache=cfg.prompt_cache_min_messages,
                unsupported_model_behavior="ignore",
            )
        )

    if cfg.fallback_models:
        middleware.append(ModelFallbackMiddleware(*cfg.fallback_models))

    if cfg.model_retry_max > 0:
        middleware.append(
            ModelRetryMiddleware(max_retries=cfg.model_retry_max, on_failure="continue")
        )

    if cfg.context_editing_enabled:
        middleware.append(
            ContextEditingMiddleware(
                edits=[
                    ClearToolUsesEdit(
                        trigger=cfg.context_editing_trigger_tokens,
                        keep=cfg.context_editing_keep,
                    )
                ]
            )
        )

    if cfg.summarization_enabled:
        if cfg.summarization_model:
            middleware.append(
                SummarizationMiddleware(
                    model=cfg.summarization_model,
                    trigger=("tokens", cfg.summarization_trigger_tokens),
                    keep=("messages", cfg.summarization_keep_messages),
                )
            )
        else:
            get_logger().warning(
                "summarization enabled but no summarization model set; "
                "summarization middleware not added."
            )

    # Model-facing middleware (before/after the model call). Order: trim history
    # first, then recall long-term memory, then enforce the token budget.
    if cfg.rolling_summary_enabled:
        middleware.append(
            RollingSummaryMiddleware(
                trigger_tokens=cfg.rolling_summary_trigger_tokens,
                keep_messages=cfg.rolling_summary_keep_messages,
            )
        )

    if cfg.ltm_middleware_enabled:
        middleware.append(LongTermMemoryMiddleware())

    if cfg.run_token_budget > 0:
        middleware.append(CostBudgetMiddleware(budget=cfg.run_token_budget))

    return middleware
