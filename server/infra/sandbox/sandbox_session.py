"""Sandbox session tracking — per-staff-run thread_id via contextvars.

Each staff node invocation gets a unique thread_id that:
  - Scopes all sandbox bash sessions within that run (prevents cross-run pollution)
  - Creates an isolated workspace directory: {SANDBOX_WORKSPACE}/{thread_id}/
  - Is persisted to MongoDB (mongo) or, in json mode, to
    {STORAGE_DIR}/sandbox_threads.json (the gitignored live store, NOT the
    committed storage/seed/ dir)
  - Propagates automatically through async tool calls via ContextVar
"""
from __future__ import annotations

import hashlib
import json
import os
import threading
from contextvars import ContextVar
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Optional
from uuid import uuid4

from server.share.log import get_logger

logger = get_logger(__name__)

# Per-asyncio-task context variable — set once per staff node run.
_current_thread_id: ContextVar[Optional[str]] = ContextVar("sandbox_thread_id", default=None)

_storage_lock = threading.Lock()


def _storage_path() -> Path:
    """Resolve the live sandbox-threads file under the configured STORAGE_DIR.

    Live session data belongs in STORAGE_DIR (the gitignored ``storage/runtime/``
    store), never the committed ``storage/seed/`` catalog. Falls back to the
    ``STORAGE_DIR`` env var / ``storage/runtime`` so it stays usable without full
    app wiring (mirrors ``working_memory_store._storage_dir``).
    """
    try:
        from server.api.settings import settings

        base = settings.storage_dir or "storage/runtime"
    except Exception:  # noqa: BLE001 - usable without full app wiring (tests)
        base = os.getenv("STORAGE_DIR", "storage/runtime")
    return Path(base) / "sandbox_threads.json"


def get_current_thread_id() -> Optional[str]:
    """Return the thread_id bound to the current async context, or None."""
    return _current_thread_id.get()


def set_current_thread_id(thread_id: str) -> None:
    """Bind *thread_id* to the current async context (overwrites previous value)."""
    _current_thread_id.set(thread_id)


def get_thread_workspace(base_workspace: str, thread_id: Optional[str] = None) -> str:
    """Return the workspace path for a given thread_id.

    Returns ``{base_workspace}/{thread_id}`` when thread_id is set,
    or ``base_workspace`` as fallback.
    """
    tid = thread_id if thread_id is not None else _current_thread_id.get()
    if tid:
        return os.path.join(base_workspace, tid)
    return base_workspace


def new_thread_id(
    staff_name: str,
    task_id: Optional[str] = None,
    run_id: Optional[str] = None,
) -> str:
    """Generate a new thread_id, set it in context, and persist to storage.

    Also creates the isolated workspace directory under SANDBOX_WORKSPACE so
    it is ready the moment the staff starts using sandbox tools.

    Call this at the start of each staff node invocation.
    """
    thread_id = uuid4().hex
    _current_thread_id.set(thread_id)

    workspace_path = _ensure_thread_workspace(thread_id)
    _persist_session(
        thread_id=thread_id,
        staff_name=staff_name,
        task_id=task_id,
        run_id=run_id or uuid4().hex,
        workspace_path=workspace_path,
    )
    logger.debug(
        "Sandbox thread_id=%s created for staff=%s task_id=%s workspace=%s",
        thread_id, staff_name, task_id, workspace_path,
    )
    return thread_id


# ── Conversation-scoped (shared) workspaces ────────────────────────────────────

_CONV_THREAD_PREFIX = "conv-"


def conversation_thread_id(conversation_id: str) -> str:
    """Deterministic, filesystem-safe thread_id for a whole conversation.

    Same conversation_id always maps to the same id, so every staff in the chat
    resolves to the *same* shared workspace ``{SANDBOX_WORKSPACE}/conv-<hash>/``.
    Hashing avoids path-traversal / odd-char issues and gives a stable length.
    """
    digest = hashlib.sha256(conversation_id.encode("utf-8")).hexdigest()[:32]
    return f"{_CONV_THREAD_PREFIX}{digest}"


def ensure_conversation_workspace(conversation_id: str) -> str:
    """Create ``{SANDBOX_WORKSPACE}/conv-<hash>/`` (+ an ``uploads/`` subdir).

    Returns the workspace path. Reuses :func:`_ensure_thread_workspace` so the
    base-path resolution (including the ``~/sandbox_workspace`` fallback) is
    identical to the per-turn path — the uploader and the tools never drift.
    """
    tid = conversation_thread_id(conversation_id)
    workspace = _ensure_thread_workspace(tid)
    try:
        os.makedirs(os.path.join(workspace, "uploads"), exist_ok=True)
    except OSError as exc:
        logger.warning("Could not create uploads dir in %s: %s", workspace, exc)
    return workspace


def use_conversation_thread(conversation_id: str) -> str:
    """Bind the contextvar to the conversation-scoped (shared) thread_id.

    Overwrites any random per-turn id set earlier in the staff node, ensures the
    shared workspace exists, and persists a session record. Call this at node
    start *only* when the conversation has files (see ``attach_conversation_sandbox``).
    """
    tid = conversation_thread_id(conversation_id)
    _current_thread_id.set(tid)
    workspace = ensure_conversation_workspace(conversation_id)
    _persist_session(
        thread_id=tid,
        staff_name="conversation",
        task_id=conversation_id,
        run_id=tid,
        workspace_path=workspace,
    )
    return tid


# ── Workspace creation ────────────────────────────────────────────────────────

def _ensure_thread_workspace(thread_id: str) -> str:
    """Create {SANDBOX_WORKSPACE}/{thread_id}/ and return its path."""
    try:
        from server.api.settings import settings
        base = settings.sandbox_workspace or os.path.join(os.path.expanduser("~"), "sandbox_workspace")
    except Exception:
        base = os.path.join(os.path.expanduser("~"), "sandbox_workspace")

    workspace = os.path.join(base, thread_id)
    try:
        os.makedirs(workspace, exist_ok=True)
    except OSError as exc:
        logger.warning("Could not create thread workspace %s: %s", workspace, exc)
    return workspace


# ── Persistence ───────────────────────────────────────────────────────────────

def _persist_session(
    thread_id: str,
    staff_name: str,
    task_id: Optional[str],
    run_id: str,
    workspace_path: str = "",
) -> None:
    record = {
        "thread_id": thread_id,
        "agent_name": staff_name,
        "taskId": task_id,
        "run_id": run_id,
        "workspace_path": workspace_path,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        from server.api.settings import settings
        if settings.storage_backend == "mongo":
            _persist_session_mongo(record)
            return
    except Exception:
        pass
    _persist_session_json(record)


def _persist_session_json(record: dict) -> None:
    try:
        path = _storage_path()
        with _storage_lock:
            sessions: list[dict] = []
            if path.exists():
                try:
                    sessions = json.loads(path.read_text(encoding="utf-8"))
                    if not isinstance(sessions, list):
                        sessions = []
                except (json.JSONDecodeError, OSError):
                    sessions = []
            sessions.append(record)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(
                json.dumps(sessions, indent=2, ensure_ascii=False), encoding="utf-8"
            )
    except Exception as exc:
        logger.warning("Failed to persist sandbox session (json): %s", exc)


@lru_cache
def _mongo_db():
    """Single cached MongoClient/db for this module instead of opening a new
    client (and connection pool) on every session persist call."""
    import pymongo
    from server.api.settings import settings

    client = pymongo.MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=2000)
    return client[settings.mongo_db]


def _persist_session_mongo(record: dict) -> None:
    # Pure-Mongo: a transient Mongo failure logs and skips; it must NOT write a
    # JSON file in mongo mode (session tracking is best-effort metadata).
    try:
        db = _mongo_db()
        doc = dict(record)
        doc["_id"] = doc["thread_id"]
        db.sandbox_threads.replace_one({"_id": doc["_id"]}, doc, upsert=True)
    except Exception as exc:
        logger.warning("Failed to persist sandbox session (mongo): %s", exc)
