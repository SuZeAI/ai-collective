"""Long-term-memory middleware — recall before the model, persist salient after."""

from __future__ import annotations

from typing import Any

from langchain.agents.middleware import AgentMiddleware
from langchain_core.messages import SystemMessage

from backend.infrastructure.llm.middleware.helpers import message_text, state_messages


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
        for m in reversed(state_messages(state)):
            if m.__class__.__name__ == "HumanMessage":
                query = message_text(m)
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
        messages = state_messages(state)
        if not messages:
            return None
        last = messages[-1]
        if last.__class__.__name__ != "AIMessage" or getattr(last, "tool_calls", None):
            return None  # only persist final textual answers, not tool-call turns
        text = message_text(last).strip()
        if len(text) < 40:
            return None
        await ltm.remember(scope, text, kind="episodic", importance=0.5)
        return None
