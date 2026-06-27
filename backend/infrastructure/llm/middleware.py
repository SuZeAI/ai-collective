"""Staff middleware for the LangChain ``create_staff`` chat path.

The provider's ``chat()`` no longer hand-rolls a ReAct loop; it delegates to
``create_staff`` (see ``agent_builder.py``). The cross-cutting behaviours that
loop used to implement inline are expressed here as middleware, following
https://docs.langchain.com/oss/python/langchain/middleware/overview :

* **Round bound + final answer** — ``ModelCallLimitMiddleware`` replaces the old
  ``max_tool_rounds`` loop and the forced "final round synthesize" turn.
* **Loop detection** — ``LoopDetectionMiddleware`` (custom, below) breaks an staff
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
import re
from collections.abc import Awaitable, Callable
from typing import Any

from langchain_core.messages import RemoveMessage, SystemMessage, ToolMessage
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


# ── shared helpers ────────────────────────────────────────────────────────────
def _message_text(message: Any) -> str:
    """Best-effort plain text of a LangChain message (handles block content)."""
    content = getattr(message, "content", message)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and isinstance(block.get("text"), str):
                parts.append(block["text"])
        return " ".join(parts)
    return str(content)


def _estimate_tokens(text: str) -> int:
    """Cheap, provider-agnostic token estimate (~4 chars/token)."""
    return max(1, len(text or "") // 4)


def _state_messages(state: Any) -> list:
    if isinstance(state, dict):
        return state.get("messages") or []
    return getattr(state, "messages", None) or []


def _default_tool_timeout() -> int:
    """Per-tool timeout in seconds (0 disables)."""
    return max(0, settings.staff.tool_timeout_seconds)


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


class RollingSummaryMiddleware(AgentMiddleware):
    """Project-native, LLM-free history compactor.

    When the running message history exceeds ``trigger_tokens``, the oldest
    messages (everything before the last ``keep_messages``) are folded into a
    single compact ``SystemMessage`` summary and removed from state. This is the
    cheap, dependency-light alternative to LangChain's ``SummarizationMiddleware``
    (which makes an extra LLM call) — it integrates with the same rolling-digest
    philosophy as the working memory.

    Pairing safety: a tool_use must stay adjacent to its tool_result. The cut is
    nudged so the kept window never *starts* with a ``ToolMessage`` and we never
    drop only one half of a tool-call pair. Messages without an id (cannot be
    removed via the reducer) are left in place.
    """

    def __init__(self, *, trigger_tokens: int | None = None, keep_messages: int | None = None) -> None:
        super().__init__()
        self._trigger = trigger_tokens if trigger_tokens is not None else settings.llm.rolling_summary_trigger_tokens
        self._keep = keep_messages if keep_messages is not None else settings.llm.rolling_summary_keep_messages

    def _safe_cut(self, messages: list) -> int:
        """Index up to which messages may be dropped (exclusive)."""
        cut = max(0, len(messages) - max(1, self._keep))
        # Don't let the kept window start with a ToolMessage (orphaned result).
        while cut < len(messages) and isinstance(messages[cut], ToolMessage):
            cut -= 1
            if cut <= 0:
                return 0
        return cut

    def before_model(self, state: Any, runtime: Any) -> dict[str, Any] | None:  # noqa: ANN401
        messages = _state_messages(state)
        if len(messages) <= max(2, self._keep):
            return None
        total = sum(_estimate_tokens(_message_text(m)) for m in messages)
        if total < self._trigger:
            return None

        cut = self._safe_cut(messages)
        droppable = [m for m in messages[:cut] if getattr(m, "id", None)]
        if len(droppable) < 2:
            return None

        bullets: list[str] = []
        for m in droppable:
            text = _message_text(m).strip().replace("\n", " ")
            if not text:
                continue
            role = m.__class__.__name__.replace("Message", "").lower()
            bullets.append(f"- {role}: {text[:200]}")
        if not bullets:
            return None
        summary = (
            "[CONVERSATION SUMMARY — earlier turns compacted to save context]\n"
            + "\n".join(bullets[-40:])
        )
        get_logger().info(
            "RollingSummary: folded %d message(s) (~%d tokens) into a summary",
            len(droppable),
            total,
        )
        updates: list[Any] = [RemoveMessage(id=m.id) for m in droppable]
        updates.append(SystemMessage(content=summary))
        return {"messages": updates}


class LongTermMemoryMiddleware(AgentMiddleware):
    """Recall long-term memory before the model call; persist salient after.

    Reads the run scope from ``long_term_memory_store.current_memory_scope`` (set
    once per run by the API layer), recalls a digest for the latest user message
    and injects it as a ``SystemMessage``. After the model answers, the final
    response is stored back as an episodic memory. No-op when LTM is disabled or
    no scope is bound. The orchestrator-path counterpart so even the plain
    ``provider.chat`` path benefits from cross-conversation memory.
    """

    def _scope_and_query(self, state: Any):
        from backend.infrastructure import long_term_memory_store as ltm

        scope = ltm.get_current_scope()
        if scope is None:
            return None, ""
        query = ""
        for m in reversed(_state_messages(state)):
            if m.__class__.__name__ == "HumanMessage":
                query = _message_text(m)
                break
        return scope, query

    async def abefore_model(self, state: Any, runtime: Any) -> dict[str, Any] | None:  # noqa: ANN401
        scope, query = self._scope_and_query(state)
        if scope is None:
            return None
        from backend.infrastructure import long_term_memory_store as ltm

        digest = await ltm.recall_digest(scope, query)
        if not digest:
            return None
        return {"messages": [SystemMessage(content=digest)]}

    async def aafter_model(self, state: Any, runtime: Any) -> dict[str, Any] | None:  # noqa: ANN401
        from backend.infrastructure import long_term_memory_store as ltm

        scope = ltm.get_current_scope()
        if scope is None:
            return None
        messages = _state_messages(state)
        if not messages:
            return None
        last = messages[-1]
        if last.__class__.__name__ != "AIMessage" or getattr(last, "tool_calls", None):
            return None  # only persist final textual answers, not tool-call turns
        text = _message_text(last).strip()
        if len(text) < 40:
            return None
        await ltm.remember(scope, text, kind="episodic", importance=0.5)
        return None


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
        signature = _loop_signature(name, tool_call.get("args"))

        messages = _state_messages(getattr(request, "state", None))
        # Map each tool_call id -> signature, then find a ToolMessage whose
        # originating call matches our signature.
        id_to_sig: dict[str, tuple[str, str]] = {}
        for message in messages:
            for prev in getattr(message, "tool_calls", None) or []:
                if isinstance(prev, dict) and prev.get("id"):
                    id_to_sig[prev["id"]] = _loop_signature(prev.get("name", ""), prev.get("args"))
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


class CostBudgetMiddleware(AgentMiddleware):
    """Soft-stop a run that exceeds a token budget.

    Estimates cumulative history tokens before each model call; once past
    ``budget`` it injects a firm ``SystemMessage`` instructing the staff to stop
    calling tools and produce its final answer now. A soft cap (the run stays
    alive and yields a result) layered on top of the hard ``ModelCallLimit``.
    """

    def __init__(self, *, budget: int | None = None) -> None:
        super().__init__()
        self._budget = budget if budget is not None else settings.llm.run_token_budget

    def before_model(self, state: Any, runtime: Any) -> dict[str, Any] | None:  # noqa: ANN401
        if self._budget <= 0:
            return None
        messages = _state_messages(state)
        total = sum(_estimate_tokens(_message_text(m)) for m in messages)
        if total < self._budget:
            return None
        # Avoid re-nudging every turn once we've already asked to finalize.
        for m in messages[-3:]:
            if isinstance(m, SystemMessage) and "TOKEN BUDGET REACHED" in _message_text(m):
                return None
        get_logger().warning("CostBudget: run hit ~%d tokens (budget %d)", total, self._budget)
        return {
            "messages": [
                SystemMessage(
                    content=(
                        "[TOKEN BUDGET REACHED] Stop calling tools and write your final "
                        "answer now using what you already have."
                    )
                )
            ]
        }


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


# Conservative PII patterns: emails, long digit runs (cards/phones), and common
# secret tokens. Intentionally simple — high-precision, low false-positive.
_PII_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"), "[REDACTED_EMAIL]"),
    (re.compile(r"\b(?:\d[ -]?){13,16}\b"), "[REDACTED_CARD]"),
    (re.compile(r"\b(?:sk|pk|ghp|xox[baprs])[-_][A-Za-z0-9]{16,}\b"), "[REDACTED_SECRET]"),
]


class PIIRedactionMiddleware(AgentMiddleware):
    """Redact obvious PII / secrets from tool results before the model sees them."""

    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Awaitable[ToolMessage | Command]],
    ) -> ToolMessage | Command:
        result = await handler(request)
        if isinstance(result, ToolMessage) and isinstance(result.content, str):
            redacted = result.content
            for pattern, replacement in _PII_PATTERNS:
                redacted = pattern.sub(replacement, redacted)
            if redacted != result.content:
                get_logger().info("PIIRedaction: redacted sensitive data in '%s' result", result.name)
                result.content = redacted
        return result


def build_default_middleware(
    *,
    max_tool_rounds: int,
    tool_timeout: int | None = None,
) -> list[AgentMiddleware]:
    """Assemble the default middleware stack for a chat staff.

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
      * ``GuardrailMiddleware`` — when deny tools/patterns are configured.
      * ``ToolResultCacheMiddleware`` — when ``LLM_TOOL_CACHE_ENABLED`` is set.
      * ``PIIRedactionMiddleware`` — when ``LLM_PII_REDACTION_ENABLED`` is set.
      * ``ModelFallbackMiddleware`` — when ``LLM_FALLBACK_MODELS`` is set.
      * ``ModelRetryMiddleware`` — when ``LLM_MODEL_RETRY_MAX`` > 0.
      * ``ContextEditingMiddleware`` — when ``LLM_CONTEXT_EDITING_ENABLED`` is set.
      * ``SummarizationMiddleware`` — when ``LLM_SUMMARIZATION_ENABLED`` is set.
      * ``RollingSummaryMiddleware`` — when ``LLM_ROLLING_SUMMARY_ENABLED`` is set.
      * ``LongTermMemoryMiddleware`` — when ``LLM_LTM_MIDDLEWARE_ENABLED`` is set.
      * ``CostBudgetMiddleware`` — when ``LLM_RUN_TOKEN_BUDGET`` > 0.

    Ordering rationale: guardrail/PII protect tool execution, cache serves before
    retry/timeout, loop-detection → retry → timeout wrap the actual call, and the
    model-facing trio (summary → LTM recall → cost budget) acts around the model.
    """
    middleware: list[AgentMiddleware] = [
        ModelCallLimitMiddleware(run_limit=max(1, max_tool_rounds), exit_behavior="end"),
    ]

    tool_call_limit = settings.llm.tool_call_limit
    if tool_call_limit > 0:
        middleware.append(
            ToolCallLimitMiddleware(run_limit=tool_call_limit, exit_behavior="end")
        )

    # Guardrail first: a denied/dangerous tool call must be blocked before any
    # other wrapper (cache/retry/timeout) does work on it.
    if settings.llm.guardrail_deny_tool_list() or settings.llm.guardrail_deny_pattern_list():
        middleware.append(GuardrailMiddleware())

    # Cache next: serve an identical idempotent call from the run before loop
    # detection / retry / timeout.
    if settings.llm.tool_cache_enabled:
        middleware.append(ToolResultCacheMiddleware())

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

    # PII redaction wraps the executed tool result (innermost of the tool
    # wrappers) so it scrubs the raw output before it re-enters the history.
    if settings.llm.pii_redaction_enabled:
        middleware.append(PIIRedactionMiddleware())

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

    # Model-facing middleware (before/after the model call). Order: trim history
    # first, then recall long-term memory, then enforce the token budget.
    if settings.llm.rolling_summary_enabled:
        middleware.append(RollingSummaryMiddleware())

    if settings.llm.ltm_middleware_enabled:
        middleware.append(LongTermMemoryMiddleware())

    if settings.llm.run_token_budget > 0:
        middleware.append(CostBudgetMiddleware())

    return middleware
