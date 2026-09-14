"""Long-term memory — cross-conversation knowledge that outlives a single run.

Where working memory (``working_memory.py``) and the knowledge graph are scoped
to one ``meeting_id`` and reset when a run ends, long-term memory persists
durable facts across tasks. Each record is scoped along three independent
dimensions so it can be recalled at any granularity:

* ``company_id`` — the Business Unit the knowledge belongs to.
* ``owner_id`` — the user it belongs to.
* ``staff_id`` — the staff that learned it (persona / experience).

Any dimension may be ``None`` ("applies broadly"). A recall query supplies a
concrete scope and matches every record that is equal-or-broader on each
dimension, so a workspace-wide fact surfaces for any staff in that workspace.

This module is pure domain logic (dataclasses + scoring). Persistence lives in
the repositories; orchestration in ``long_term_memory_service``.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from server.domain.memory.vectors import cosine_dense, lexical_overlap

MEMORY_KINDS = ("fact", "preference", "episodic", "semantic", "persona")

_WS_RE = re.compile(r"\s+")


def _clip(text: str, limit: int = 1000) -> str:
    text = _WS_RE.sub(" ", (text or "").strip())
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 1)].rstrip() + "…"


@dataclass(frozen=True)
class MemoryScope:
    """Three-dimensional scope. ``None`` on a dimension means 'applies broadly'."""

    company_id: str | None = None
    owner_id: str | None = None
    staff_id: str | None = None

    @staticmethod
    def _norm(value: str | None) -> str | None:
        v = (value or "").strip()
        return v or None if v not in {"*", ""} else None

    def normalized(self) -> "MemoryScope":
        return MemoryScope(
            company_id=self._norm(self.company_id),
            owner_id=self._norm(self.owner_id),
            staff_id=self._norm(self.staff_id),
        )

    def matches(self, record: "MemoryRecord") -> bool:
        """True when ``record`` is equal-or-broader than this query scope.

        A record dimension of ``None`` (broad) matches any query value; a
        concrete record dimension must equal the query's value on that
        dimension (or the query is broad there).
        """

        def dim_ok(query_val: str | None, rec_val: str | None) -> bool:
            if rec_val is None:
                return True  # broad record is visible everywhere
            if query_val is None:
                return True  # broad query sees everything in the dimension
            return query_val == rec_val

        return (
            dim_ok(self.company_id, record.company_id)
            and dim_ok(self.owner_id, record.owner_id)
            and dim_ok(self.staff_id, record.staff_id)
        )


@dataclass
class MemoryRecord:
    id: str
    content: str
    kind: str = "fact"
    company_id: str | None = None
    owner_id: str | None = None
    staff_id: str | None = None
    embedding: list[float] | None = None
    importance: float = 0.5
    source_meeting_id: str | None = None
    created_at: str = ""
    last_accessed_at: str = ""
    access_count: int = 0

    def scope(self) -> MemoryScope:
        return MemoryScope(self.company_id, self.owner_id, self.staff_id)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "content": self.content,
            "kind": self.kind,
            "workspace_id": self.company_id,
            "owner_id": self.owner_id,
            "agent_id": self.staff_id,
            "embedding": self.embedding,
            "importance": self.importance,
            "source_meeting_id": self.source_meeting_id,
            "created_at": self.created_at,
            "last_accessed_at": self.last_accessed_at,
            "access_count": self.access_count,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MemoryRecord":
        raw_emb = data.get("embedding")
        embedding = [float(x) for x in raw_emb] if isinstance(raw_emb, list) else None
        kind = str(data.get("kind", "fact"))
        return cls(
            id=str(data.get("id", "")),
            content=str(data.get("content", "")),
            kind=kind if kind in MEMORY_KINDS else "fact",
            company_id=(data.get("workspace_id") or None),
            owner_id=(data.get("owner_id") or None),
            staff_id=(data.get("agent_id") or None),
            embedding=embedding,
            importance=float(data.get("importance", 0.5) or 0.5),
            source_meeting_id=(data.get("source_meeting_id") or None),
            created_at=str(data.get("created_at", "")),
            last_accessed_at=str(data.get("last_accessed_at", "")),
            access_count=int(data.get("access_count", 0) or 0),
        )


def score_record(
    record: MemoryRecord,
    *,
    query: str,
    query_embedding: list[float] | None,
    recency_index: int = 0,
    total: int = 1,
) -> float:
    """Blend semantic/lexical similarity with importance and recency.

    Uses dense cosine when both the record and the query have embeddings; else
    falls back to lexical term overlap. ``recency_index`` is the record's rank
    by recency (0 = newest) used as a mild tiebreaker.
    """
    if query_embedding is not None and record.embedding is not None:
        similarity = cosine_dense(query_embedding, record.embedding)
    else:
        similarity = lexical_overlap(query, record.content)
    recency = 1.0 - (recency_index / max(1, total))
    return similarity * 0.7 + record.importance * 0.2 + recency * 0.1


def render_digest(records: list[MemoryRecord], *, max_chars: int = 2000) -> str:
    """Render recalled records as an injectable prompt block ('' when empty)."""
    if not records:
        return ""
    header = (
        "[LONG-TERM MEMORY — durable knowledge recalled from earlier work. "
        "Trust it as background; verify before acting if it seems stale.]"
    )
    lines = [header]
    for rec in records:
        scope_bits = [b for b in (rec.staff_id, rec.kind) if b]
        tag = f"[{'/'.join(scope_bits)}] " if scope_bits else ""
        lines.append(f"- {tag}{_clip(rec.content, 300)}")
    out = "\n".join(lines)
    return out if len(out) <= max_chars else out[: max_chars - 1].rstrip() + "…"
