"""Tests for pluggable vector stores and LTM integration.

Real FAISS/Qdrant/Neo4j backends are exercised only when their optional
dependency is importable; otherwise those tests skip. The scope-filter logic and
the LTM↔store wiring are always tested via a fake in-memory store.
"""

from __future__ import annotations

import asyncio
import importlib.util

import pytest

from backend.app.service.long_term_memory_service import LongTermMemoryService
from backend.domain.memory.long_term_memory import MemoryScope
from backend.infrastructure.llm.embeddings import HashingEmbeddingProvider
from backend.infrastructure.repositories.json_long_term_memory import (
    JsonLongTermMemoryRepository,
)
from backend.infrastructure.repositories.json_store import JsonFileStore
from backend.infrastructure.vector_store.base import VectorHit, payload_matches, scope_payload


def _has(mod: str) -> bool:
    return importlib.util.find_spec(mod) is not None


# --------------------------------------------------------------------------- #
# Scope payload semantics (backend-agnostic)                                  #
# --------------------------------------------------------------------------- #

def test_scope_payload_and_match():
    p = scope_payload(MemoryScope(company_id="bu1", owner_id="u1"))
    assert p == {"workspace_id": "bu1", "owner_id": "u1", "agent_id": None}
    # narrow query matches broad payload (agent_id null) but not a different owner
    assert payload_matches(MemoryScope("bu1", "u1", "analyst"), p)
    assert not payload_matches(MemoryScope("bu1", "u2", "analyst"), p)


def test_factory_none_returns_none(monkeypatch):
    from backend.api.settings import settings
    from backend.infrastructure.vector_store import create_vector_store

    monkeypatch.setattr(settings.vector_store, "backend", "none")
    assert create_vector_store(dim=64) is None


def test_factory_unknown_backend_degrades(monkeypatch):
    from backend.api.settings import settings
    from backend.infrastructure.vector_store import create_vector_store

    monkeypatch.setattr(settings.vector_store, "backend", "does-not-exist")
    assert create_vector_store(dim=64) is None


# --------------------------------------------------------------------------- #
# LTM uses the vector store for recall (fake in-memory store)                 #
# --------------------------------------------------------------------------- #

class _FakeStore:
    def __init__(self):
        self.vectors: dict[str, tuple[list[float], MemoryScope]] = {}
        self.searched = False

    def upsert(self, record_id, vector, scope):
        self.vectors[record_id] = (vector, scope)

    def search(self, vector, *, top_k, scope):
        self.searched = True
        from backend.domain.memory.vectors import cosine_dense

        scored = [
            (cosine_dense(vector, v), rid)
            for rid, (v, sc) in self.vectors.items()
            if payload_matches(scope, scope_payload(sc))
        ]
        scored.sort(reverse=True)
        return [VectorHit(id=rid, score=s) for s, rid in scored[:top_k]]

    def delete(self, record_id):
        self.vectors.pop(record_id, None)


def test_ltm_recall_uses_vector_store(tmp_path):
    repo = JsonLongTermMemoryRepository(JsonFileStore(tmp_path / "ltm.json"))
    provider = HashingEmbeddingProvider(dim=128)
    store = _FakeStore()
    svc = LongTermMemoryService(
        repo, embedding_provider_getter=lambda: provider, vector_store=store
    )

    async def run():
        scope = MemoryScope(owner_id="u1")
        await svc.remember(scope, "The launch date is September", importance=0.7)
        # vector got indexed on remember
        assert len(store.vectors) == 1
        got = await svc.recall(scope, "when is launch")
        assert store.searched
        assert any("September" in r.content for r in got)

    asyncio.run(run())


# --------------------------------------------------------------------------- #
# Real backends (only when the optional dep is present)                       #
# --------------------------------------------------------------------------- #

@pytest.mark.skipif(not _has("faiss"), reason="faiss not installed")
def test_faiss_roundtrip(tmp_path):
    from backend.infrastructure.vector_store.faiss_store import FaissVectorStore

    s = FaissVectorStore(dim=8, path=str(tmp_path), overfetch=5)
    s.upsert("a", [1, 0, 0, 0, 0, 0, 0, 0], MemoryScope(owner_id="u1"))
    s.upsert("b", [0, 1, 0, 0, 0, 0, 0, 0], MemoryScope(owner_id="u2"))
    hits = s.search([1, 0, 0, 0, 0, 0, 0, 0], top_k=1, scope=MemoryScope(owner_id="u1"))
    assert hits and hits[0].id == "a"
    # scope filter hides u2's vector from a u1 query
    hits_u1 = s.search([0, 1, 0, 0, 0, 0, 0, 0], top_k=5, scope=MemoryScope(owner_id="u1"))
    assert all(h.id != "b" for h in hits_u1)
