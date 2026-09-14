"""Tests for long-term memory: scope matching, recall/remember, dedupe, consolidate."""

from __future__ import annotations

import asyncio

from server.app.service.long_term_memory_service import LongTermMemoryService
from server.domain.memory.long_term_memory import MemoryRecord, MemoryScope
from server.infra.llm.embeddings import HashingEmbeddingProvider
from server.infra.repositories.json_long_term_memory import (
    JsonLongTermMemoryRepository,
)
from server.infra.repositories.json_store import JsonFileStore


def _service(tmp_path):
    store = JsonFileStore(tmp_path / "ltm.json")
    repo = JsonLongTermMemoryRepository(store)
    provider = HashingEmbeddingProvider(dim=128)
    return LongTermMemoryService(
        repo, embedding_provider_getter=lambda: provider, recall_top_k=5
    )


# --------------------------------------------------------------------------- #
# Scope semantics                                                             #
# --------------------------------------------------------------------------- #

def test_scope_broad_record_visible_everywhere():
    broad = MemoryRecord(id="1", content="x", company_id="bu1")  # no owner/agent
    # a narrow query (specific owner+agent) still matches the broad record
    assert MemoryScope("bu1", "u1", "analyst").matches(broad)


def test_scope_narrow_record_hidden_from_other_agents():
    narrow = MemoryRecord(id="1", content="x", company_id="bu1", owner_id="u1", staff_id="analyst")
    assert MemoryScope("bu1", "u1", "analyst").matches(narrow)
    assert not MemoryScope("bu1", "u1", "writer").matches(narrow)
    assert not MemoryScope("bu2", "u1", "analyst").matches(narrow)


# --------------------------------------------------------------------------- #
# Service round-trips                                                         #
# --------------------------------------------------------------------------- #

def test_remember_and_recall_roundtrip(tmp_path):
    svc = _service(tmp_path)

    async def run():
        scope = MemoryScope(company_id="bu1", owner_id="u1")
        await svc.remember(scope, "The fiscal year ends in June", kind="fact", importance=0.7)
        # recall from a narrower agent scope still sees the owner-scoped fact
        got = await svc.recall(MemoryScope("bu1", "u1", "analyst"), "when does the fiscal year end")
        assert any("June" in r.content for r in got)

    asyncio.run(run())


def test_remember_dedupes_similar(tmp_path):
    svc = _service(tmp_path)

    async def run():
        scope = MemoryScope(owner_id="u1")
        r1 = await svc.remember(scope, "Launch date is September", importance=0.5)
        r2 = await svc.remember(scope, "Launch date is September", importance=0.6)
        assert r1.id == r2.id  # same record, importance bumped
        assert r2.importance >= r1.importance
        assert len(svc._repo.query_scope(scope)) == 1

    asyncio.run(run())


def test_recall_empty_when_no_match(tmp_path):
    svc = _service(tmp_path)
    got = asyncio.run(svc.recall(MemoryScope(owner_id="nobody"), "anything"))
    assert got == []


def test_consolidate_promotes_working_memory(tmp_path, monkeypatch):
    svc = _service(tmp_path)

    # Fake a working memory with a pinned note + a decision.
    class _Note:
        def __init__(self, content, kind, pinned=False):
            self.content = content
            self.kind = kind
            self.pinned = pinned

    class _WM:
        notes = [
            _Note("Critical: API key rotated", "guidance", pinned=True),
            _Note("Chose Postgres over Mongo", "decision"),
            _Note("just a finding", "finding"),
        ]

    import server.infra.working_memory_store as wm_store

    monkeypatch.setattr(wm_store, "get_memory", lambda *_: _WM())

    async def run():
        scope = MemoryScope(owner_id="u1")
        n = await svc.consolidate(meeting_id="conv1", scope=scope)
        # pinned guidance + decision promoted; plain finding skipped
        assert n == 2
        recalled = await svc.recall(scope, "API key", limit=10)
        assert any("API key" in r.content for r in recalled)

    asyncio.run(run())
