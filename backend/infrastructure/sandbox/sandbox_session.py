"""Sandbox session tracking — per-agent-run thread_id via contextvars.

Each agent node invocation gets a unique thread_id that:
  - Scopes all sandbox bash sessions within that run (prevents cross-run pollution)
  - Creates an isolated workspace directory: {SANDBOX_WORKSPACE}/{thread_id}/
  - Is persisted to storage/sandbox_threads.json (json) or MongoDB (mongo)
  - Propagates automatically through async tool calls via ContextVar
"""
from __future__ import annotations

import json
import os
import threading
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from backend.log import get_logger

logger = get_logger(__name__)

# Per-asyncio-task context variable — set once per agent node run.
_current_thread_id: ContextVar[Optional[str]] = ContextVar("sandbox_thread_id", default=None)

_STORAGE_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "../../../storage/sandbox_threads.json")
)
_storage_lock = threading.Lock()


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
    agent_name: str,
    task_id: Optional[str] = None,
    run_id: Optional[str] = None,
) -> str:
    """Generate a new thread_id, set it in context, and persist to storage.

    Also creates the isolated workspace directory under SANDBOX_WORKSPACE so
    it is ready the moment the agent starts using sandbox tools.

    Call this at the start of each agent node invocation.
    """
    thread_id = uuid4().hex
    _current_thread_id.set(thread_id)

    workspace_path = _ensure_thread_workspace(thread_id)
    _persist_session(
        thread_id=thread_id,
        agent_name=agent_name,
        task_id=task_id,
        run_id=run_id or uuid4().hex,
        workspace_path=workspace_path,
    )
    logger.debug(
        "Sandbox thread_id=%s created for agent=%s task_id=%s workspace=%s",
        thread_id, agent_name, task_id, workspace_path,
    )
    return thread_id


# ── Workspace creation ────────────────────────────────────────────────────────

def _ensure_thread_workspace(thread_id: str) -> str:
    """Create {SANDBOX_WORKSPACE}/{thread_id}/ and return its path."""
    try:
        from backend.api.settings import settings
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
    agent_name: str,
    task_id: Optional[str],
    run_id: str,
    workspace_path: str = "",
) -> None:
    record = {
        "thread_id": thread_id,
        "agent_name": agent_name,
        "taskId": task_id,
        "run_id": run_id,
        "workspace_path": workspace_path,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        from backend.api.settings import settings
        if settings.storage_backend == "mongo":
            _persist_session_mongo(record)
            return
    except Exception:
        pass
    _persist_session_json(record)


def _persist_session_json(record: dict) -> None:
    try:
        with _storage_lock:
            sessions: list[dict] = []
            if os.path.exists(_STORAGE_PATH):
                try:
                    with open(_STORAGE_PATH, "r", encoding="utf-8") as f:
                        sessions = json.load(f)
                    if not isinstance(sessions, list):
                        sessions = []
                except (json.JSONDecodeError, OSError):
                    sessions = []
            sessions.append(record)
            with open(_STORAGE_PATH, "w", encoding="utf-8") as f:
                json.dump(sessions, f, indent=2, ensure_ascii=False)
    except Exception as exc:
        logger.warning("Failed to persist sandbox session (json): %s", exc)


def _persist_session_mongo(record: dict) -> None:
    try:
        import pymongo
        from backend.api.settings import settings
        client = pymongo.MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=2000)
        db = client[settings.mongo_db]
        doc = dict(record)
        doc["_id"] = doc["thread_id"]
        db.sandbox_threads.replace_one({"_id": doc["_id"]}, doc, upsert=True)
    except Exception as exc:
        logger.warning("Failed to persist sandbox session (mongo): %s", exc)
        _persist_session_json(record)
