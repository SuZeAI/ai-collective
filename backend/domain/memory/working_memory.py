"""Shared working memory for multi-agent runs — the anti-context-loss layer.

Problem this solves: each agent turn is a *stateless* LLM call. Context flows
only through (a) windowed logs that silently drop old entries, (b) top-k
knowledge-graph retrieval that may miss what matters, and (c) tail truncation
by the token budget. On long runs, agents forget what earlier agents found.

The working memory is a per-conversation blackboard shared by every agent in a
run (and across paused/resumed and follow-up runs of the same conversation):

- **Notes** — small structured records (finding / decision / artifact / todo /
  guidance / result) written automatically at every turn boundary and
  explicitly by agents through the ``memory`` toolkit.
- **Rolling summary** — when the note list exceeds its cap, the *oldest*
  unpinned notes are folded into a compact summary instead of being dropped.
  Nothing silently disappears; it degrades into a one-line bullet.
- **Digest** — a deterministic, token-bounded rendering injected near the top
  of every agent prompt, so it survives tail truncation.

This module is pure domain logic (no I/O). Persistence and the per-process
registry live in ``backend.infrastructure.working_memory_store``.
"""

from __future__ import annotations

import math
import os
import re
from dataclasses import dataclass, field
from typing import Any

# ── Tunables (env-overridable) ────────────────────────────────────────────────
WORKING_MEMORY_ENABLED = os.getenv("WORKING_MEMORY_ENABLED", "true").strip().lower() in (
    "1", "true", "yes", "on",
)
# Max structured notes kept verbatim before compaction folds the oldest into
# the rolling summary.
WORKING_MEMORY_MAX_NOTES = max(4, int(os.getenv("WORKING_MEMORY_MAX_NOTES", "40")))
# Token ceiling for the verbatim notes: when the estimated token size of all
# notes exceeds this, the oldest unpinned notes are summarized away until the
# memory fits again (count cap above still applies independently).
WORKING_MEMORY_COMPACT_TOKENS = max(200, int(os.getenv("WORKING_MEMORY_COMPACT_TOKENS", "1500")))
# Conservative chars-per-token estimate, matching token_budget's claude family.
_CHARS_PER_TOKEN = 3.2
# Per-note content clip — notes are telegrams, not transcripts.
WORKING_MEMORY_NOTE_CHARS = max(80, int(os.getenv("WORKING_MEMORY_NOTE_CHARS", "600")))
# Cap on the rolling summary; oldest summary lines drop first when exceeded.
WORKING_MEMORY_SUMMARY_CHARS = max(400, int(os.getenv("WORKING_MEMORY_SUMMARY_CHARS", "3000")))
# Cap on the rendered digest injected into prompts.
WORKING_MEMORY_DIGEST_CHARS = max(400, int(os.getenv("WORKING_MEMORY_DIGEST_CHARS", "4000")))

NOTE_KINDS = ("finding", "decision", "artifact", "todo", "guidance", "result")

_WS_RE = re.compile(r"\s+")


def _clip(text: str, limit: int) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 1)].rstrip() + "…"


def _one_line(text: str, limit: int) -> str:
    return _clip(_WS_RE.sub(" ", text or ""), limit)


@dataclass
class MemoryNote:
    seq: int
    turn: int
    agent: str
    kind: str
    content: str
    pinned: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "seq": self.seq,
            "turn": self.turn,
            "agent": self.agent,
            "kind": self.kind,
            "content": self.content,
            "pinned": self.pinned,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MemoryNote":
        return cls(
            seq=int(data.get("seq", 0)),
            turn=int(data.get("turn", 0)),
            agent=str(data.get("agent", "")),
            kind=str(data.get("kind", "finding")),
            content=str(data.get("content", "")),
            pinned=bool(data.get("pinned", False)),
        )

    def render(self) -> str:
        pin = "📌 " if self.pinned else ""
        turn = f"t{self.turn}" if self.turn else "t?"
        return f"- {pin}[{turn}|{self.agent}|{self.kind}] {self.content}"


@dataclass
class WorkingMemory:
    conversation_id: str
    task: str = ""
    rolling_summary: str = ""
    notes: list[MemoryNote] = field(default_factory=list)
    next_seq: int = 1

    # ── Mutations ────────────────────────────────────────────────────────────

    def set_task(self, task: str) -> None:
        """Record the original task once; later calls are no-ops."""
        if not self.task and (task or "").strip():
            self.task = _clip(task, WORKING_MEMORY_NOTE_CHARS)

    def add_note(
        self,
        *,
        agent: str,
        content: str,
        kind: str = "finding",
        turn: int = 0,
        pinned: bool = False,
    ) -> MemoryNote | None:
        """Append a note (clipped, deduplicated against the recent tail)."""
        content = _clip(content, WORKING_MEMORY_NOTE_CHARS)
        if not content:
            return None
        if kind not in NOTE_KINDS:
            kind = "finding"
        # Skip exact repeats of a recent note (agents sometimes re-save).
        for prior in self.notes[-5:]:
            if prior.content == content and prior.agent == agent and prior.kind == kind:
                return prior
        note = MemoryNote(
            seq=self.next_seq, turn=turn, agent=agent, kind=kind,
            content=content, pinned=pinned,
        )
        self.next_seq += 1
        self.notes.append(note)
        self.compact()
        return note

    def estimated_tokens(self) -> int:
        """Rough token size of the verbatim notes (conservative estimate)."""
        chars = sum(len(n.content) + 24 for n in self.notes)  # +24 ≈ note header
        return math.ceil(chars / _CHARS_PER_TOKEN)

    def compact(self) -> int:
        """Summarize the oldest unpinned notes into the rolling summary.

        Two independent triggers, both folding oldest-first:
        1. note count exceeds ``WORKING_MEMORY_MAX_NOTES``;
        2. estimated note tokens exceed ``WORKING_MEMORY_COMPACT_TOKENS``.

        Returns the number of notes folded. Pinned notes are never folded; if
        pinned notes alone exceed a cap they are all kept (caller chose to
        pin them).
        """
        summary_lines = [ln for ln in self.rolling_summary.splitlines() if ln.strip()]
        folded = 0

        def fold_oldest_unpinned() -> bool:
            for idx, note in enumerate(self.notes):
                if not note.pinned:
                    summary_lines.append(
                        f"• t{note.turn} {note.agent} ({note.kind}): "
                        + _one_line(note.content, 160)
                    )
                    del self.notes[idx]
                    return True
            return False

        while len(self.notes) > WORKING_MEMORY_MAX_NOTES and fold_oldest_unpinned():
            folded += 1
        while self.estimated_tokens() > WORKING_MEMORY_COMPACT_TOKENS and fold_oldest_unpinned():
            folded += 1

        if not folded and not summary_lines:
            return 0
        # Trim the summary from the top (oldest first) to stay within budget.
        summary = "\n".join(summary_lines)
        while len(summary) > WORKING_MEMORY_SUMMARY_CHARS and len(summary_lines) > 1:
            summary_lines.pop(0)
            summary = "\n".join(summary_lines)
        self.rolling_summary = _clip(summary, WORKING_MEMORY_SUMMARY_CHARS)
        return folded

    # ── Queries ──────────────────────────────────────────────────────────────

    def search(self, query: str = "", limit: int = 8) -> list[MemoryNote]:
        """Cheap lexical recall: term-overlap scored, recency-tiebroken."""
        limit = max(1, int(limit))
        if not query.strip():
            return self.notes[-limit:]
        terms = {t for t in _WS_RE.split(query.lower()) if len(t) > 1}
        if not terms:
            return self.notes[-limit:]
        scored: list[tuple[float, int, MemoryNote]] = []
        for note in self.notes:
            haystack = f"{note.agent} {note.kind} {note.content}".lower()
            hits = sum(1 for t in terms if t in haystack)
            if hits:
                scored.append((hits / len(terms), note.seq, note))
        scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
        return [note for _, _, note in scored[:limit]]

    def is_empty(self) -> bool:
        return not self.notes and not self.rolling_summary.strip()

    def render_digest(self, max_chars: int | None = None) -> str:
        """Render the prompt-injection block ('' when there is nothing yet).

        Inclusion priority when the budget bites: header/task/pinned, then the
        most recent unpinned notes, and only then the rolling summary (which
        keeps its newest lines). Render order stays chronological: summary
        before recent notes.
        """
        if self.is_empty():
            return ""
        budget = max(200, int(max_chars or WORKING_MEMORY_DIGEST_CHARS))

        header = (
            "[WORKING MEMORY — shared across all agents in this task. "
            "Trust it as ground truth for what has already been done; do not redo it.]"
        )
        head_sections: list[str] = [header]
        if self.task:
            head_sections.append(f"Task: {_one_line(self.task, 300)}")
        pinned = [n for n in self.notes if n.pinned]
        recent = [n for n in self.notes if not n.pinned]
        if pinned:
            head_sections.append("Pinned:\n" + "\n".join(n.render() for n in pinned))
        base = "\n\n".join(head_sections)
        remaining = budget - len(base)

        # Most recent unpinned notes first — they must never be squeezed out
        # by an ever-growing summary.
        recent_block = ""
        if recent and remaining > 40:
            title = "Recent notes:\n"
            avail = remaining - (2 + len(title))
            chosen: list[str] = []
            for note in reversed(recent):
                line = note.render()
                if avail - (len(line) + 1) < 0 and chosen:
                    break
                chosen.append(line)
                avail -= len(line) + 1
            recent_block = title + "\n".join(reversed(chosen))
            remaining -= 2 + len(recent_block)

        # The summary gets the leftover budget, keeping its newest lines.
        summary_block = ""
        if self.rolling_summary.strip() and remaining > 40:
            title = "Earlier progress (compacted):\n"
            avail = remaining - (2 + len(title))
            kept: list[str] = []
            size = 0
            for line in reversed(self.rolling_summary.strip().splitlines()):
                if size + len(line) + 1 > avail and kept:
                    break
                kept.append(line)
                size += len(line) + 1
            summary_block = _clip(title + "\n".join(reversed(kept)), remaining - 2)

        sections = [base]
        if summary_block:
            sections.append(summary_block)
        if recent_block:
            sections.append(recent_block)
        return _clip("\n\n".join(sections), budget)

    # ── Serialization ────────────────────────────────────────────────────────

    def to_dict(self) -> dict[str, Any]:
        return {
            "conversation_id": self.conversation_id,
            "task": self.task,
            "rolling_summary": self.rolling_summary,
            "notes": [n.to_dict() for n in self.notes],
            "next_seq": self.next_seq,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "WorkingMemory":
        notes = [MemoryNote.from_dict(n) for n in data.get("notes", []) if isinstance(n, dict)]
        return cls(
            conversation_id=str(data.get("conversation_id", "")),
            task=str(data.get("task", "")),
            rolling_summary=str(data.get("rolling_summary", "")),
            notes=notes,
            next_seq=max(int(data.get("next_seq", 1)), max((n.seq for n in notes), default=0) + 1),
        )
