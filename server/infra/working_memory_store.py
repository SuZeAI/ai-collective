"""Per-process registry + pluggable persistence for run working memory.

One ``WorkingMemory`` per meeting_id, shared by every staff node and
memory tool call in the process. Persistence follows ``STORAGE_BACKEND``:

- ``json`` (default) — atomic snapshot files under
  ``{STORAGE_DIR}/working_memory/{meeting_id}.json``. An in-process cache
  fronts the files (single-instance deployments).
- ``mongo`` — one document per conversation in the ``working_memory``
  collection (same ``pymongo`` client pattern as the other Mongo
  repositories). No in-process cache: every operation reads through Mongo, so
  multiple backend instances always see each other's notes. Lost-update races
  are not a practical concern because at most one run per conversation is
  active at a time (enforced by the task-run registry), so writes for a given
  conversation are already serialized.

Best-effort by design: persistence failures are logged, never raised — losing
a snapshot must not break an staff run. If Mongo is configured but
unreachable at first use, the store falls back to file persistence (with an
error log) rather than disabling memory entirely.
"""

from __future__ import annotations

import json
import os
import re
import threading
from pathlib import Path
from typing import Protocol

from server.domain.memory.working_memory import WORKING_MEMORY_ENABLED, WorkingMemory
from server.share.log import get_logger

logger = get_logger(__name__)

_lock = threading.RLock()
_memories: dict[str, WorkingMemory] = {}

_SAFE_ID_RE = re.compile(r"[^A-Za-z0-9_-]+")


# ------------------------------------------------------------------ #
# Persistence backends                                                 #
# ------------------------------------------------------------------ #

class WorkingMemoryPersistence(Protocol):
    """Snapshot storage for working memory (one snapshot per conversation)."""

    #: True when an in-process cache in front of this backend is safe
    #: (single-writer storage like local files). Shared storage (Mongo) must
    #: read through so other instances' writes are visible.
    cacheable: bool

    def load(self, meeting_id: str) -> WorkingMemory | None: ...

    def save(self, memory: WorkingMemory) -> None: ...

    def delete(self, meeting_id: str) -> None: ...


def _storage_dir() -> Path:
    try:
        from server.api.settings import settings

        base = settings.storage_dir or "storage/runtime"
    except Exception:  # noqa: BLE001 - usable without full app wiring (tests)
        base = os.getenv("STORAGE_DIR", "storage/runtime")
    return Path(base) / "working_memory"


class FileWorkingMemoryPersistence:
    """Atomic JSON snapshot files (default; single-instance deployments)."""

    cacheable = True

    def _path(self, meeting_id: str) -> Path:
        safe = _SAFE_ID_RE.sub("_", meeting_id)[:128] or "default"
        return _storage_dir() / f"{safe}.json"

    def load(self, meeting_id: str) -> WorkingMemory | None:
        path = self._path(meeting_id)
        try:
            if path.exists():
                data = json.loads(path.read_text(encoding="utf-8"))
                memory = WorkingMemory.from_dict(data)
                memory.meeting_id = meeting_id
                return memory
        except Exception:  # noqa: BLE001 - corrupt snapshot must not kill the run
            logger.exception("Failed to load working-memory snapshot for %s", meeting_id)
        return None

    def save(self, memory: WorkingMemory) -> None:
        path = self._path(memory.meeting_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".json.tmp")
        tmp.write_text(
            json.dumps(memory.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8"
        )
        tmp.replace(path)

    def delete(self, meeting_id: str) -> None:
        self._path(meeting_id).unlink(missing_ok=True)


class MongoWorkingMemoryPersistence:
    """One document per conversation in the ``working_memory`` collection."""

    cacheable = False  # shared storage: always read through

    def __init__(self, db) -> None:
        self._col = db["working_memory"]
        self._col.create_index("meeting_id", unique=True, background=True)

    def load(self, meeting_id: str) -> WorkingMemory | None:
        try:
            doc = self._col.find_one({"meeting_id": meeting_id})
        except Exception:  # noqa: BLE001 - read failure must not kill the run
            logger.exception("Failed to load working memory from Mongo for %s", meeting_id)
            return None
        if not doc:
            return None
        memory = WorkingMemory.from_dict(doc)
        memory.meeting_id = meeting_id
        return memory

    def save(self, memory: WorkingMemory) -> None:
        payload = {"_id": memory.meeting_id, **memory.to_dict()}
        self._col.replace_one(
            {"meeting_id": memory.meeting_id}, payload, upsert=True
        )

    def delete(self, meeting_id: str) -> None:
        self._col.delete_one({"meeting_id": meeting_id})


_persistence: WorkingMemoryPersistence | None = None


def _create_persistence() -> WorkingMemoryPersistence:
    try:
        from server.api.settings import settings

        if settings.storage_backend == "mongo":
            import pymongo

            client = pymongo.MongoClient(settings.mongo_uri)
            db = client[settings.mongo_db]
            backend = MongoWorkingMemoryPersistence(db)
            logger.info("Working memory persistence: MongoDB (collection=working_memory)")
            return backend
    except Exception:  # noqa: BLE001 - degrade to files rather than lose memory
        logger.exception(
            "Failed to initialise Mongo working-memory persistence; falling back to files"
        )
    return FileWorkingMemoryPersistence()


def _get_persistence() -> WorkingMemoryPersistence:
    global _persistence
    if _persistence is None:
        _persistence = _create_persistence()
    return _persistence


# ------------------------------------------------------------------ #
# Store API (used by graph runtime and the memory toolkit)             #
# ------------------------------------------------------------------ #

def get_memory(meeting_id: str) -> WorkingMemory | None:
    """Return the working memory for a conversation (None when disabled).

    With cacheable persistence (files) the in-process instance is reused;
    with shared persistence (Mongo) the snapshot is re-read so concurrent
    instances observe each other's writes.
    """
    if not WORKING_MEMORY_ENABLED or not meeting_id:
        return None
    with _lock:
        backend = _get_persistence()
        if backend.cacheable:
            memory = _memories.get(meeting_id)
            if memory is None:
                memory = backend.load(meeting_id) or WorkingMemory(
                    meeting_id=meeting_id
                )
                _memories[meeting_id] = memory
            return memory
        return backend.load(meeting_id) or WorkingMemory(meeting_id=meeting_id)


def _persist(memory: WorkingMemory) -> None:
    try:
        _get_persistence().save(memory)
    except Exception:  # noqa: BLE001 - persistence is best-effort
        logger.exception("Failed to persist working memory for %s", memory.meeting_id)


def set_task(meeting_id: str, task: str) -> None:
    """Record the run's original task once (idempotent)."""
    with _lock:
        memory = get_memory(meeting_id)
        if memory is None or memory.task:
            return
        memory.set_task(task)
        _persist(memory)


def record_note(
    meeting_id: str,
    *,
    staff: str,
    content: str,
    kind: str = "finding",
    turn: int = 0,
    pinned: bool = False,
) -> bool:
    """Add a note (auto-compacting) and persist. Returns False when disabled."""
    with _lock:
        memory = get_memory(meeting_id)
        if memory is None:
            return False
        note = memory.add_note(staff=staff, content=content, kind=kind, turn=turn, pinned=pinned)
        if note is not None:
            _persist(memory)
        return note is not None


def render_digest(meeting_id: str, max_chars: int | None = None) -> str:
    """Render the prompt-injection digest ('' when disabled or empty)."""
    with _lock:
        memory = get_memory(meeting_id)
        if memory is None:
            return ""
        return memory.render_digest(max_chars)


def search_notes(meeting_id: str, query: str = "", limit: int = 8):
    """Lexical recall over the conversation's notes (empty list when disabled)."""
    with _lock:
        memory = get_memory(meeting_id)
        if memory is None:
            return []
        return memory.search(query, limit)


def drop_memory(meeting_id: str) -> None:
    """Evict the in-process entry (persisted snapshot is kept)."""
    with _lock:
        _memories.pop(meeting_id, None)


def delete_memory(meeting_id: str) -> None:
    """Permanently remove a conversation's working memory (cache + persisted).

    Used by the "clear history" fresh-start action — without this, a wiped
    conversation would still resume with stale notes/task text from before
    the wipe, since get_memory() only re-creates an empty WorkingMemory when
    nothing is persisted.
    """
    with _lock:
        _memories.pop(meeting_id, None)
        try:
            _get_persistence().delete(meeting_id)
        except Exception:  # noqa: BLE001 - persistence is best-effort
            logger.exception("Failed to delete working memory for %s", meeting_id)


def reset_persistence_for_tests() -> None:
    """Re-resolve the persistence backend (test helper)."""
    global _persistence
    with _lock:
        _persistence = None
        _memories.clear()
