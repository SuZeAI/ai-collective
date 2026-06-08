"""Unit tests for the shared working memory (domain + store)."""

from __future__ import annotations

from backend.domain.memory import working_memory as wm_module
from backend.domain.memory.working_memory import (
    WORKING_MEMORY_MAX_NOTES,
    WorkingMemory,
)


def _make_memory() -> WorkingMemory:
    return WorkingMemory(conversation_id="conv-1")


def test_set_task_is_idempotent():
    memory = _make_memory()
    memory.set_task("Build a report")
    memory.set_task("Something else")
    assert memory.task == "Build a report"


def test_add_note_clips_and_assigns_sequence():
    memory = _make_memory()
    note = memory.add_note(agent="researcher", content="x" * 5000, kind="finding", turn=2)
    assert note is not None
    assert note.seq == 1
    assert len(note.content) <= wm_module.WORKING_MEMORY_NOTE_CHARS
    assert memory.next_seq == 2


def test_add_note_rejects_empty_and_dedupes_recent():
    memory = _make_memory()
    assert memory.add_note(agent="a", content="   ") is None
    first = memory.add_note(agent="a", content="same fact")
    repeat = memory.add_note(agent="a", content="same fact")
    assert repeat is first
    assert len(memory.notes) == 1


def test_unknown_kind_falls_back_to_finding():
    memory = _make_memory()
    note = memory.add_note(agent="a", content="fact", kind="banana")
    assert note.kind == "finding"


def test_compaction_folds_oldest_unpinned_into_summary():
    memory = _make_memory()
    pinned = memory.add_note(agent="user", content="critical guidance", kind="guidance", pinned=True)
    for i in range(WORKING_MEMORY_MAX_NOTES + 10):
        memory.add_note(agent="worker", content=f"unique finding number {i}", turn=i + 1)

    assert len(memory.notes) <= WORKING_MEMORY_MAX_NOTES
    assert pinned in memory.notes  # pinned survives compaction
    assert "unique finding number 0" in memory.rolling_summary  # oldest folded, not dropped


def test_token_threshold_triggers_summarization(monkeypatch):
    # Force a tiny token ceiling: ~100 tokens ≈ 320 chars of notes.
    monkeypatch.setattr(wm_module, "WORKING_MEMORY_COMPACT_TOKENS", 100)
    memory = _make_memory()
    pinned = memory.add_note(agent="user", content="pinned rule", kind="guidance", pinned=True)
    for i in range(10):
        memory.add_note(agent="w", content=f"long finding {i} " + "z" * 150, turn=i + 1)

    assert memory.estimated_tokens() <= 100 + 60  # fits again (±1 note of slack)
    assert pinned in memory.notes                  # pinned never summarized
    assert "long finding 0" in memory.rolling_summary  # oldest folded, not dropped
    assert any("long finding 9" in n.content for n in memory.notes)  # newest verbatim


def test_estimated_tokens_grows_with_content():
    memory = _make_memory()
    assert memory.estimated_tokens() == 0
    memory.add_note(agent="a", content="x" * 320)
    assert memory.estimated_tokens() >= 100


def test_digest_contains_task_summary_pinned_and_recent():
    memory = _make_memory()
    memory.set_task("Investigate churn")
    memory.add_note(agent="user", content="never email customers", kind="guidance", pinned=True)
    memory.add_note(agent="analyst", content="churn is 12% in Q3", kind="finding", turn=3)
    digest = memory.render_digest()
    assert "WORKING MEMORY" in digest
    assert "Investigate churn" in digest
    assert "never email customers" in digest
    assert "churn is 12% in Q3" in digest


def test_digest_respects_budget_and_prefers_recent_notes():
    memory = _make_memory()
    for i in range(30):
        memory.add_note(agent="a", content=f"note number {i} " + "y" * 200, turn=i + 1)
    digest = memory.render_digest(max_chars=1200)
    assert len(digest) <= 1200
    assert "note number 29" in digest  # most recent always survives


def test_empty_memory_renders_nothing():
    assert _make_memory().render_digest() == ""


def test_search_matches_terms_and_falls_back_to_recent():
    memory = _make_memory()
    memory.add_note(agent="a", content="the API key lives in vault path kv/prod")
    memory.add_note(agent="b", content="frontend uses React 18")
    hits = memory.search("vault api")
    assert hits and "vault" in hits[0].content
    assert len(memory.search("")) == 2


def test_serialization_roundtrip():
    memory = _make_memory()
    memory.set_task("task")
    memory.add_note(agent="a", content="fact one", turn=1, pinned=True)
    memory.add_note(agent="b", content="fact two", turn=2)
    restored = WorkingMemory.from_dict(memory.to_dict())
    assert restored.task == "task"
    assert [n.content for n in restored.notes] == ["fact one", "fact two"]
    assert restored.notes[0].pinned is True
    assert restored.next_seq == memory.next_seq


def test_store_persists_and_reloads(tmp_path, monkeypatch):
    from backend.infrastructure import working_memory_store as store

    # Force file persistence in a temp dir regardless of app settings.
    monkeypatch.setattr(store, "_storage_dir", lambda: tmp_path / "working_memory")
    monkeypatch.setattr(store, "_persistence", store.FileWorkingMemoryPersistence())
    monkeypatch.setattr(store, "_memories", {})

    conv = "conv-persist"
    assert store.record_note(conv, agent="w1", content="found the bug in auth.py", turn=1)
    store.set_task(conv, "fix the login bug")

    # Simulate process restart: evict in-memory entry, reload from disk.
    store.drop_memory(conv)
    digest = store.render_digest(conv)
    assert "found the bug in auth.py" in digest
    assert "fix the login bug" in digest

    notes = store.search_notes(conv, "auth")
    assert notes and "auth.py" in notes[0].content


class _FakeMongoCollection:
    """Minimal stand-in for pymongo Collection (find_one/replace_one/delete_one)."""

    def __init__(self):
        self.docs: dict[str, dict] = {}
        self.index_calls: list = []

    def create_index(self, *args, **kwargs):
        self.index_calls.append((args, kwargs))

    def find_one(self, query):
        return self.docs.get(query["conversation_id"])

    def replace_one(self, query, payload, upsert=False):
        assert upsert is True
        self.docs[query["conversation_id"]] = payload

    def delete_one(self, query):
        self.docs.pop(query["conversation_id"], None)


class _FakeMongoDb(dict):
    def __getitem__(self, name):
        return self.setdefault(name, _FakeMongoCollection())


def test_mongo_persistence_roundtrip_and_read_through(monkeypatch):
    from backend.infrastructure import working_memory_store as store

    db = _FakeMongoDb()
    backend = store.MongoWorkingMemoryPersistence(db)
    assert backend.cacheable is False
    assert db["working_memory"].index_calls  # unique index on conversation_id

    monkeypatch.setattr(store, "_persistence", backend)
    monkeypatch.setattr(store, "_memories", {})

    conv = "conv-mongo"
    assert store.record_note(conv, agent="w1", content="quarterly revenue is 4.2M", turn=1)
    store.set_task(conv, "summarize finance")

    doc = db["working_memory"].docs[conv]
    assert doc["_id"] == conv and doc["task"] == "summarize finance"

    # Read-through (no cache): a write from "another instance" is visible.
    other = WorkingMemory.from_dict(doc)
    other.add_note(agent="w2", content="costs grew 9%", turn=2)
    db["working_memory"].docs[conv] = {"_id": conv, **other.to_dict()}
    digest = store.render_digest(conv)
    assert "quarterly revenue is 4.2M" in digest
    assert "costs grew 9%" in digest

    backend.delete(conv)
    assert conv not in db["working_memory"].docs


def test_mongo_init_failure_falls_back_to_files(monkeypatch, tmp_path):
    from backend.infrastructure import working_memory_store as store

    class _BrokenSettings:
        storage_backend = "mongo"
        mongo_uri = "mongodb://invalid:1/x"
        mongo_db = "x"

    monkeypatch.setattr(store, "_storage_dir", lambda: tmp_path / "wm")

    def _boom_mongo(*a, **k):
        raise RuntimeError("no mongo here")

    import backend.api.settings as settings_module

    monkeypatch.setattr(settings_module, "settings", _BrokenSettings())
    import pymongo

    monkeypatch.setattr(pymongo, "MongoClient", _boom_mongo)
    backend = store._create_persistence()
    assert isinstance(backend, store.FileWorkingMemoryPersistence)


def test_store_returns_safe_defaults_when_disabled(monkeypatch):
    from backend.infrastructure import working_memory_store as store

    # The store imported the flag into its own namespace; patch it there.
    monkeypatch.setattr(store, "WORKING_MEMORY_ENABLED", False)
    assert store.get_memory("conv-x") is None
    assert store.record_note("conv-x", agent="a", content="y") is False
    assert store.render_digest("conv-x") == ""
    assert store.search_notes("conv-x") == []
