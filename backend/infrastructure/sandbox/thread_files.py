"""Thread-file (attachment) store — tracks files attached to a conversation.

A conversation "has files" once a user uploads a document or an agent writes one
into the shared workspace. This store records that metadata so the orchestrator
can cheaply decide whether to provision the conversation sandbox + inject the
sandbox tools (see ``attach_conversation_sandbox``).

Mirrors ``sandbox_session``'s dual-mode persistence: MongoDB when
``storage_backend == "mongo"``, otherwise ``{STORAGE_DIR}/thread_files.json``
(the gitignored live store, NOT the committed ``storage/`` seed catalog).

Every function is best-effort: failures log and degrade gracefully — they must
never raise, because ``conversation_has_files`` gates every agent run.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from backend.infrastructure.lock_provider import get_shared_lock_provider
from backend.log import get_logger

logger = get_logger(__name__)

_LOCK_KEY = "thread_files"

# conversation_has_files is called synchronously at the start of *every* agent
# turn across all 5 topologies (build_agent_tools -> attach_conversation_sandbox),
# which otherwise re-does a disk read (or Mongo round-trip) every single turn.
# A conversation only ever transitions False -> True (files are never removed
# mid-conversation — purge_thread_files only runs on task deletion, which ends
# it), so caching "known to have files" and skipping the I/O once True is safe
# and eliminates nearly all of the redundant per-turn cost.
_has_files_cache: set[str] = set()


def _storage_lock():
    """Distributed (or in-process, per LOCK_BACKEND) lock guarding thread_files.json.

    This module does its own raw file I/O rather than going through a JSON
    repository, so without this it would bypass LOCK_BACKEND=redis entirely —
    a private threading.Lock only serializes writers within one process.
    """
    return get_shared_lock_provider().acquire(_LOCK_KEY)


def _storage_path() -> Path:
    """Resolve the live thread-files file under the configured STORAGE_DIR."""
    try:
        from backend.api.settings import settings

        base = settings.storage_dir or "storage"
    except Exception:  # noqa: BLE001 - usable without full app wiring (tests)
        base = os.getenv("STORAGE_DIR", "storage")
    return Path(base) / "thread_files.json"


def _is_mongo() -> bool:
    try:
        from backend.api.settings import settings

        return settings.storage_backend == "mongo"
    except Exception:
        return False


# ── Recording ──────────────────────────────────────────────────────────────────

def record_thread_file(
    conversation_id: str,
    *,
    filename: str,
    size: int,
    content_type: Optional[str],
    rel_path: str,
    uploaded_by: str = "user",
    produced_by_agent: Optional[str] = None,
) -> dict:
    """Record a file attached to *conversation_id*; return the stored record."""
    record = {
        "id": f"file_{uuid4().hex}",
        "conversation_id": conversation_id,
        "filename": filename,
        "size": size,
        "content_type": content_type,
        "rel_path": rel_path,
        "uploaded_by": uploaded_by,
        "produced_by_agent": produced_by_agent,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if _is_mongo():
        _record_mongo(record)
    else:
        _record_json(record)
    _has_files_cache.add(conversation_id)
    return record


def _record_json(record: dict) -> None:
    try:
        path = _storage_path()
        with _storage_lock():
            files: list[dict] = []
            if path.exists():
                try:
                    files = json.loads(path.read_text(encoding="utf-8"))
                    if not isinstance(files, list):
                        files = []
                except (json.JSONDecodeError, OSError):
                    files = []
            # Upsert by (conversation_id, rel_path): overwrite an existing entry.
            files = [
                f for f in files
                if not (
                    f.get("conversation_id") == record["conversation_id"]
                    and f.get("rel_path") == record["rel_path"]
                )
            ]
            files.append(record)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(
                json.dumps(files, indent=2, ensure_ascii=False), encoding="utf-8"
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to persist thread file (json): %s", exc)


def _record_mongo(record: dict) -> None:
    try:
        import pymongo
        from backend.api.settings import settings

        client = pymongo.MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=2000)
        db = client[settings.mongo_db]
        doc = dict(record)
        doc["_id"] = f"{record['conversation_id']}:{record['rel_path']}"
        db.thread_files.replace_one({"_id": doc["_id"]}, doc, upsert=True)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to persist thread file (mongo): %s", exc)


# ── Listing ──────────────────────────────────────────────────────────────────

def list_thread_files(conversation_id: str) -> list[dict]:
    """Return all recorded files for *conversation_id* (newest last)."""
    try:
        if _is_mongo():
            return _list_mongo(conversation_id)
        return _list_json(conversation_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to list thread files for %s: %s", conversation_id, exc)
        return []


def _list_json(conversation_id: str) -> list[dict]:
    path = _storage_path()
    if not path.exists():
        return []
    with _storage_lock():
        try:
            files = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return []
    if not isinstance(files, list):
        return []
    return [f for f in files if f.get("conversation_id") == conversation_id]


def _list_mongo(conversation_id: str) -> list[dict]:
    import pymongo
    from backend.api.settings import settings

    client = pymongo.MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=2000)
    db = client[settings.mongo_db]
    return list(
        db.thread_files.find({"conversation_id": conversation_id}, {"_id": False})
        .sort("created_at", pymongo.ASCENDING)
    )


# ── Existence check (gates every run — must be cheap and never raise) ──────────

def conversation_has_files(conversation_id: str) -> bool:
    """True if *conversation_id* has any recorded file or an on-disk upload.

    Called synchronously at the start of every agent turn (via
    build_agent_tools/attach_conversation_sandbox in every topology), so a
    cache hit short-circuits the disk/Mongo check entirely — see
    ``_has_files_cache``.

    Tolerant: a transient store failure falls back to the on-disk ``uploads/``
    check, and any unexpected error returns ``False`` so a run never breaks.
    """
    if not conversation_id:
        return False
    if conversation_id in _has_files_cache:
        return True
    if _conversation_has_files_uncached(conversation_id):
        _has_files_cache.add(conversation_id)
        return True
    return False


def _conversation_has_files_uncached(conversation_id: str) -> bool:
    try:
        if _is_mongo():
            try:
                import pymongo
                from backend.api.settings import settings

                client = pymongo.MongoClient(
                    settings.mongo_uri, serverSelectionTimeoutMS=2000
                )
                db = client[settings.mongo_db]
                if db.thread_files.count_documents(
                    {"conversation_id": conversation_id}, limit=1
                ):
                    return True
            except Exception:  # noqa: BLE001 - fall through to disk check
                pass
        else:
            path = _storage_path()
            if path.exists():
                try:
                    files = json.loads(path.read_text(encoding="utf-8"))
                    if isinstance(files, list) and any(
                        f.get("conversation_id") == conversation_id for f in files
                    ):
                        return True
                except (json.JSONDecodeError, OSError):
                    pass
        # On-disk fallback: a file in the conversation uploads/ dir counts.
        return _uploads_dir_has_files(conversation_id)
    except Exception as exc:  # noqa: BLE001
        logger.debug("conversation_has_files check failed for %s: %s", conversation_id, exc)
        return False


def _uploads_dir_has_files(conversation_id: str) -> bool:
    try:
        from backend.infrastructure.sandbox.sandbox_session import (
            conversation_thread_id,
        )
        from backend.api.settings import settings

        base = settings.sandbox_workspace or os.path.join(
            os.path.expanduser("~"), "sandbox_workspace"
        )
        uploads = os.path.join(base, conversation_thread_id(conversation_id), "uploads")
        return os.path.isdir(uploads) and any(os.scandir(uploads))
    except Exception:  # noqa: BLE001
        return False


def purge_thread_files(conversation_id: str) -> None:
    """Remove all records for *conversation_id* (best-effort; used on cleanup)."""
    try:
        if _is_mongo():
            import pymongo
            from backend.api.settings import settings

            client = pymongo.MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=2000)
            db = client[settings.mongo_db]
            db.thread_files.delete_many({"conversation_id": conversation_id})
            return
        path = _storage_path()
        if not path.exists():
            return
        with _storage_lock():
            try:
                files = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                return
            if not isinstance(files, list):
                return
            remaining = [f for f in files if f.get("conversation_id") != conversation_id]
            path.write_text(
                json.dumps(remaining, indent=2, ensure_ascii=False), encoding="utf-8"
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to purge thread files for %s: %s", conversation_id, exc)
