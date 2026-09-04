"""memory tool — staff-facing access to the shared run working memory.

Bound by default to every staff in a graph run (next to ``ask_user``), so any
staff can deliberately persist a key fact, decision, or artifact reference and
any later staff — in this run or after a pause/resume — can recall it. The
runtime already auto-captures a compressed record of every completed turn; this
toolkit is for the *important* details an staff wants kept verbatim.

See ``server/domain/memory/working_memory.py`` for the model and
``docs/agent-memory.md`` for the full design.
"""

from __future__ import annotations

from typing import Any

from langchain.tools import tool

from server.domain.tools.base import BaseToolkit
from server.share.log import get_logger

logger = get_logger(__name__)


class MemoryToolkit(BaseToolkit):
    """Toolkit exposing ``memory_save`` and ``memory_recall`` for one staff."""

    name: str = "memory"

    def __init__(
        self,
        conversation_id: str,
        staff_name: str | None = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self._conversation_id = conversation_id
        self._staff_name = staff_name or "staff"

    @tool(parse_docstring=True)
    async def memory_save(
        self,
        content: str,
        kind: str = "finding",
        pin: bool = False,
    ) -> str:
        """Save an important fact to the shared working memory of this task.

        Every staff working on this task (now and after pauses/handoffs) sees
        the working memory, so save anything a teammate must not lose: a key
        finding, a decision and its reason, an artifact location (file path,
        URL, sheet ID), or an open TODO. Keep it short and self-contained —
        one note per fact. Do NOT save raw dumps or things already obvious
        from the conversation.

        Args:
            content: The fact to remember, phrased so it makes sense without
                surrounding context (max ~600 chars, longer is clipped).
            kind: One of "finding", "decision", "artifact", "todo". Defaults
                to "finding".
            pin: Set true only for critical facts that must stay verbatim in
                every staff's context (pinned notes are never compacted away).
        """
        from server.infra import working_memory_store

        content = (content or "").strip()
        if not content:
            return "[memory_save error] content must not be empty."
        saved = working_memory_store.record_note(
            self._conversation_id,
            staff=self._staff_name,
            content=content,
            kind=(kind or "finding").strip().lower(),
            pinned=bool(pin),
        )
        if not saved:
            return "[memory_save unavailable] Working memory is disabled for this run."
        logger.info(
            "memory_save: staff=%s conversation=%s pinned=%s chars=%d",
            self._staff_name, self._conversation_id, pin, len(content),
        )
        return "Saved to shared working memory."

    @tool(parse_docstring=True)
    async def memory_recall(
        self,
        query: str = "",
        limit: int = 8,
    ) -> str:
        """Recall notes from the shared working memory of this task.

        Use this before redoing work or when you need a detail (an ID, a path,
        a prior decision) that is not in your current context. An empty query
        returns the most recent notes.

        Args:
            query: Keywords to match against saved notes. Empty returns the
                latest notes.
            limit: Maximum number of notes to return (default 8).
        """
        from server.infra import working_memory_store

        notes = working_memory_store.search_notes(
            self._conversation_id, query=query or "", limit=max(1, min(int(limit), 25))
        )
        if not notes:
            return (
                "No matching notes in working memory."
                if (query or "").strip()
                else "Working memory is empty so far."
            )
        return "Working memory notes:\n" + "\n".join(n.render() for n in notes)
