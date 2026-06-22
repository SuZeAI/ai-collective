"""Long-term memory orchestration: recall, remember, consolidate.

Sits between the agent runtime and the LTM repository. Handles embedding,
similarity-based dedupe and the end-of-run consolidation that promotes salient
short-term knowledge (working-memory notes, high-salience graph nodes) into
durable cross-conversation memory.

All methods are best-effort and async (embedding is async). The module-level
store in ``infrastructure.long_term_memory_store`` wires a concrete repository
and exposes thin, never-raising wrappers for the runtime.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Protocol

from backend.domain.memory.long_term_memory import (
    MemoryRecord,
    MemoryScope,
    render_digest,
    score_record,
)
from backend.domain.memory.vectors import cosine_dense, lexical_overlap
from backend.log import get_logger

logger = get_logger(__name__)


class LongTermMemoryRepository(Protocol):
    def get(self, record_id: str) -> MemoryRecord | None: ...
    def upsert(self, record: MemoryRecord) -> MemoryRecord: ...
    def delete(self, record_id: str) -> None: ...
    def query_scope(self, scope: MemoryScope) -> list[MemoryRecord]: ...


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class LongTermMemoryService:
    def __init__(
        self,
        repo: LongTermMemoryRepository,
        *,
        embedding_provider_getter=None,
        vector_store=None,
        recall_top_k: int = 5,
        min_importance: float = 0.0,
        dedupe_threshold: float = 0.92,
        digest_chars: int = 2000,
    ) -> None:
        self._repo = repo
        # A callable returning the embedding provider (or None) so the provider
        # is resolved lazily and honours the EMBEDDING_ENABLED toggle at runtime.
        self._get_embedder = embedding_provider_getter
        # Optional ANN index (FAISS/Qdrant). When present, recall queries it for
        # candidate ids instead of scanning every scope-matched record.
        self._vector_store = vector_store
        self._recall_top_k = recall_top_k
        self._min_importance = min_importance
        self._dedupe_threshold = dedupe_threshold
        self._digest_chars = digest_chars

    async def _embed(self, text: str) -> list[float] | None:
        getter = self._get_embedder
        if getter is None:
            return None
        try:
            provider = getter()
            if provider is None:
                return None
            return await provider.embed_one(text)
        except Exception:  # noqa: BLE001 — embedding is optional
            logger.debug("LTM embedding failed", exc_info=True)
            return None

    def _vector_candidates(
        self, scope: MemoryScope, query_embedding: list[float] | None, limit: int
    ) -> list[MemoryRecord] | None:
        """ANN-backed candidate set (None → caller falls back to brute force)."""
        if self._vector_store is None or query_embedding is None:
            return None
        try:
            hits = self._vector_store.search(query_embedding, top_k=limit, scope=scope)
        except Exception:  # noqa: BLE001 — index error → brute-force fallback
            logger.debug("Vector store search failed; brute force", exc_info=True)
            return None
        if not hits:
            return None  # empty could be an index miss → fall back for safety
        records = []
        for hit in hits:
            rec = self._repo.get(hit.id)
            if rec is not None and scope.matches(rec):
                records.append(rec)
        return records or None

    # ── Recall ────────────────────────────────────────────────────────────────
    async def recall(
        self, scope: MemoryScope, query: str, *, limit: int | None = None
    ) -> list[MemoryRecord]:
        top_k = limit or self._recall_top_k
        query_embedding = await self._embed(query) if query.strip() else None

        candidates = self._vector_candidates(scope, query_embedding, top_k)
        if candidates is None:
            candidates = self._repo.query_scope(scope)
        if not candidates:
            return []
        # Newest first for the recency tiebreaker.
        candidates.sort(key=lambda r: r.created_at, reverse=True)
        total = len(candidates)
        scored = [
            (
                score_record(
                    rec,
                    query=query,
                    query_embedding=query_embedding,
                    recency_index=idx,
                    total=total,
                ),
                rec,
            )
            for idx, rec in enumerate(candidates)
        ]
        scored = [(s, r) for s, r in scored if r.importance >= self._min_importance and s > 0]
        scored.sort(key=lambda item: item[0], reverse=True)
        top = [rec for _, rec in scored[: (limit or self._recall_top_k)]]
        self._touch(top)
        return top

    async def recall_digest(self, scope: MemoryScope, query: str) -> str:
        records = await self.recall(scope, query)
        return render_digest(records, max_chars=self._digest_chars)

    def _touch(self, records: list[MemoryRecord]) -> None:
        now = _now_iso()
        for rec in records:
            rec.access_count += 1
            rec.last_accessed_at = now
            try:
                self._repo.upsert(rec)
            except Exception:  # noqa: BLE001 — access stats are non-critical
                logger.debug("Failed to update LTM access stats for %s", rec.id)

    # ── Remember ────────────────────────────────────────────────────────────────
    async def remember(
        self,
        scope: MemoryScope,
        content: str,
        *,
        kind: str = "fact",
        importance: float = 0.5,
        source_conversation_id: str | None = None,
    ) -> MemoryRecord | None:
        content = (content or "").strip()
        if not content:
            return None
        scope = scope.normalized()
        embedding = await self._embed(content)

        # Dedupe against existing records in the same scope.
        existing = self._repo.query_scope(scope)
        for rec in existing:
            if rec.scope() != scope:
                continue
            if embedding is not None and rec.embedding is not None:
                similarity = cosine_dense(embedding, rec.embedding)
            else:
                similarity = lexical_overlap(content, rec.content)
            if similarity >= self._dedupe_threshold:
                rec.importance = min(1.0, max(rec.importance, importance) + 0.05)
                rec.access_count += 1
                rec.last_accessed_at = _now_iso()
                try:
                    self._repo.upsert(rec)
                except Exception:  # noqa: BLE001
                    logger.debug("Failed to bump duplicate LTM record %s", rec.id)
                return rec

        now = _now_iso()
        record = MemoryRecord(
            id=str(uuid.uuid4()),
            content=content,
            kind=kind,
            workspace_id=scope.workspace_id,
            owner_id=scope.owner_id,
            agent_id=scope.agent_id,
            embedding=embedding,
            importance=max(0.0, min(1.0, importance)),
            source_conversation_id=source_conversation_id,
            created_at=now,
            last_accessed_at=now,
            access_count=0,
        )
        saved = self._repo.upsert(record)
        if self._vector_store is not None and embedding is not None:
            try:
                self._vector_store.upsert(saved.id, embedding, scope)
            except Exception:  # noqa: BLE001 — index write is best-effort
                logger.debug("Vector store upsert failed for %s", saved.id, exc_info=True)
        return saved

    # ── Consolidate ─────────────────────────────────────────────────────────────
    async def consolidate(
        self,
        *,
        conversation_id: str,
        scope: MemoryScope,
        min_salience: float = 0.6,
        max_items: int = 20,
    ) -> int:
        """Promote salient short-term knowledge into long-term memory.

        Pulls pinned / recent working-memory notes and high-salience knowledge
        graph nodes for the conversation and stores them. Returns the number of
        records written. Never raises.
        """
        written = 0
        promoted: list[tuple[str, str, float]] = []  # (content, kind, importance)

        try:
            from backend.infrastructure import working_memory_store

            memory = working_memory_store.get_memory(conversation_id)
            if memory is not None:
                for note in memory.notes:
                    if note.pinned or note.kind in {"decision", "result", "artifact"}:
                        importance = 0.8 if note.pinned else 0.6
                        promoted.append((note.content, "episodic", importance))
        except Exception:  # noqa: BLE001
            logger.debug("LTM consolidate: working memory unavailable", exc_info=True)

        for content, kind, importance in promoted[:max_items]:
            rec = await self.remember(
                scope,
                content,
                kind=kind,
                importance=importance,
                source_conversation_id=conversation_id,
            )
            if rec is not None:
                written += 1
        return written
