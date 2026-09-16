"""Rolling-summary middleware — LLM-free history compactor."""

from __future__ import annotations

from typing import Any

from langchain.agents.middleware import AgentMiddleware
from langchain_core.messages import RemoveMessage, SystemMessage, ToolMessage

from server.api.settings import settings
from server.infra.llm.middleware.helpers import (
    estimate_tokens,
    message_text,
    state_messages,
)
from server.share.log import get_logger


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
        messages = state_messages(state)
        if len(messages) <= max(2, self._keep):
            return None
        total = sum(estimate_tokens(message_text(m)) for m in messages)
        if total < self._trigger:
            return None

        cut = self._safe_cut(messages)
        droppable = [m for m in messages[:cut] if getattr(m, "id", None)]
        if len(droppable) < 2:
            return None

        bullets: list[str] = []
        for m in droppable:
            text = message_text(m).strip().replace("\n", " ")
            role = m.__class__.__name__.replace("Message", "").lower()
            if not text:
                # Every message in `droppable` gets RemoveMessage'd below, so a
                # message with no plain-text content (e.g. an AIMessage that's
                # only a tool_call) still needs a trace here — otherwise it's
                # silently deleted with no record in the summary.
                tool_calls = getattr(m, "tool_calls", None) or []
                names = [tc.get("name", "") for tc in tool_calls if isinstance(tc, dict) and tc.get("name")]
                text = f"(called {', '.join(names)})" if names else "(no text content)"
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
