"""Sandbox middleware — provisions a per-conversation sandbox when a chat has files.

This is the "sandbox middleware" entry point. It does NOT run as a LangChain
``AgentMiddleware`` (tools must be bound before the staff is built, and the
conversation id isn't available that deep). Instead it exposes a provisioning
helper that the orchestrator nodes call when assembling an staff's tools — see
``server.domain.staff._graph_runtime.attach_conversation_sandbox``.

Responsibilities:
  * Ensure the shared, conversation-scoped workspace exists on the host.
  * Report whether the conversation has any files (the lazy trigger).
  * In k8s mode, restore previously-backed-up files into the live sandbox
    (Pod filesystems are ephemeral) and push freshly-uploaded files in.
  * Back uploads up to object storage (MinIO) so they survive Pod recreation.

Every operation is best-effort: failures log and degrade so a run never breaks.
"""
from __future__ import annotations

import asyncio
import threading
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

from server.share.log import get_logger

logger = get_logger(__name__)

# Conversations whose remote sandbox has already been restored in this process,
# so we don't re-push every file on every staff turn.
_restored: set[str] = set()
_restored_lock = threading.Lock()


@dataclass(frozen=True)
class ConversationSandbox:
    conversation_id: str
    thread_id: str
    workspace: str
    uploads_dir: str
    has_files: bool


@lru_cache(maxsize=1)
def get_backup_service():
    """Process-wide singleton backup service (no-op when MinIO is disabled)."""
    from server.infra.sandbox.backup import create_backup_service

    return create_backup_service()


def _sandbox_mode() -> str:
    try:
        from server.api.settings import settings

        return settings.sandbox_mode or "local"
    except Exception:  # noqa: BLE001
        return "local"


def _file_backend() -> str:
    """Effective byte-store backend ('local' | 's3'), independent of sandbox_mode."""
    try:
        from server.api.settings import settings

        return settings.file_storage_backend
    except Exception:  # noqa: BLE001
        return "local"


def ensure_conversation_sandbox(conversation_id: Optional[str]) -> Optional[ConversationSandbox]:
    """Provision (idempotently) the shared workspace for a chat and report files.

    Returns ``None`` when *conversation_id* is falsy. Best-effort: on any failure
    it logs and returns a ``has_files=False`` sandbox so the caller treats the
    chat as file-less and skips injection.
    """
    if not conversation_id:
        return None
    try:
        import os

        from server.infra.sandbox.sandbox_session import (
            conversation_thread_id,
            ensure_conversation_workspace,
        )
        from server.infra.sandbox.thread_files import conversation_has_files

        thread_id = conversation_thread_id(conversation_id)
        workspace = ensure_conversation_workspace(conversation_id)
        uploads_dir = os.path.join(workspace, "uploads")
        has_files = conversation_has_files(conversation_id)

        if has_files and _file_backend() == "s3":
            # Rehydrate the host workspace agents read/write so files survive a
            # restart on an ephemeral FS.
            _restore_local_once(conversation_id, thread_id, workspace)
            # k8s Pods may run on a node that doesn't share a filesystem with
            # the backend at all (a real cluster, vs. this host's dev k3s) —
            # always also push the bytes directly into the live pod over HTTP.
            if _sandbox_mode() != "local":
                _restore_remote_once(conversation_id, thread_id, workspace)

        return ConversationSandbox(
            conversation_id=conversation_id,
            thread_id=thread_id,
            workspace=workspace,
            uploads_dir=uploads_dir,
            has_files=has_files,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("ensure_conversation_sandbox failed for %s: %s", conversation_id, exc)
        return None


def _restore_local_once(conversation_id: str, thread_id: str, workspace: str) -> None:
    """Rehydrate the host workspace from S3 once per conversation per process.

    In ``s3`` mode the host workspace is a cache: after a restart on an ephemeral
    filesystem it is empty even though the durable copy lives in MinIO. We restore
    the bytes back into ``{SANDBOX_WORKSPACE}/<thread_id>/`` — the backend-side
    staging dir local mode's sandbox tools read/write directly. Idempotent and
    best-effort. Uses a distinct marker so it can coexist with the remote restore.
    """
    marker = f"local:{conversation_id}"
    with _restored_lock:
        if marker in _restored:
            return
        _restored.add(marker)
    try:
        from server.infra.storage.file_store import get_file_store

        count = get_file_store("sandbox").restore_to_dir(thread_id, workspace)
        if count:
            logger.info("Restored %d file(s) into host workspace for %s", count, conversation_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Local sandbox restore failed for %s: %s", conversation_id, exc)
        with _restored_lock:
            _restored.discard(marker)  # allow a later retry


def _restore_remote_once(conversation_id: str, thread_id: str, workspace: str) -> None:
    """Fire-and-forget restore of backed-up files into the live sandbox (Pod).

    Runs in a background thread so it never blocks an staff node, and only once
    per conversation per process.
    """
    with _restored_lock:
        if conversation_id in _restored:
            return
        _restored.add(conversation_id)

    def _work() -> None:
        try:
            backup = get_backup_service()
            rel_paths = backup.list_rel_paths(thread_id) if backup.enabled else []
            if not rel_paths:
                return
            from server.infra.sandbox.factory import create_sandbox_adapter

            sandbox = create_sandbox_adapter(session_id=thread_id)
            base = _remote_base(sandbox)
            for rel in rel_paths:
                data = backup.get_bytes(thread_id, rel)
                if data is None:
                    continue
                target = f"{base}/{thread_id}/{rel}"
                asyncio.run(sandbox.write_bytes(target, data))
            logger.info("Restored %d file(s) into sandbox for %s", len(rel_paths), conversation_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Remote sandbox restore failed for %s: %s", conversation_id, exc)
            with _restored_lock:
                _restored.discard(conversation_id)  # allow a later retry

    threading.Thread(target=_work, daemon=True).start()


def push_upload_to_sandbox(conversation_id: str, rel_path: str, content: bytes) -> None:
    """Persist an uploaded file: back it up to MinIO and push it into the Pod.

    Called from the upload endpoint via ``asyncio.to_thread`` (a worker thread,
    so ``asyncio.run`` is safe). In local mode the host workspace IS the sandbox
    filesystem, so only the MinIO backup applies. Best-effort throughout.
    """
    try:
        from server.infra.sandbox.sandbox_session import conversation_thread_id

        thread_id = conversation_thread_id(conversation_id)
        if _file_backend() == "s3":
            backup = get_backup_service()
            if backup.enabled:
                backup.backup_bytes(thread_id, rel_path, content)

        if _sandbox_mode() == "local":
            return  # host FS already holds the file (uploader wrote it)

        from server.infra.sandbox.factory import create_sandbox_adapter

        sandbox = create_sandbox_adapter(session_id=thread_id)
        base = _remote_base(sandbox)
        target = f"{base}/{thread_id}/{rel_path}"
        asyncio.run(sandbox.write_bytes(target, content))
    except Exception as exc:  # noqa: BLE001
        logger.warning("push_upload_to_sandbox failed for %s: %s", conversation_id, exc)


def backup_conversation_workspace(conversation_id: str) -> None:
    """Sync a conversation's host workspace up to MinIO (best-effort).

    Useful in local mode, where staff-written files live directly on the host.
    In k8s mode staff outputs live in the Pod (optionally also hostPath-mounted
    for local dev, see docker/provisioner/app.py); surfacing them durably is
    left to the upload path / explicit backup tooling.
    """
    try:
        if _file_backend() != "s3":
            return
        backup = get_backup_service()
        if not backup.enabled:
            return
        from server.infra.sandbox.sandbox_session import (
            conversation_thread_id,
            ensure_conversation_workspace,
        )

        thread_id = conversation_thread_id(conversation_id)
        workspace = ensure_conversation_workspace(conversation_id)
        backup.backup_dir(thread_id, workspace)
    except Exception as exc:  # noqa: BLE001
        logger.warning("backup_conversation_workspace failed for %s: %s", conversation_id, exc)


def cleanup_conversation_sandbox(conversation_id: str) -> None:
    """Best-effort teardown of a conversation's sandbox artifacts.

    Removes the host workspace, purges the file records and MinIO objects, and
    (k8s mode) destroys the per-conversation Pod. Safe to call even when the
    chat never had files. Never raises.
    """
    if not conversation_id:
        return
    try:
        import os
        import shutil

        from server.infra.sandbox.sandbox_session import (
            conversation_thread_id,
        )
        from server.infra.sandbox.thread_files import purge_thread_files

        thread_id = conversation_thread_id(conversation_id)

        # Records
        purge_thread_files(conversation_id)

        # MinIO objects
        try:
            get_backup_service().purge(thread_id)
        except Exception:  # noqa: BLE001
            pass

        # Remote container/Pod
        if _sandbox_mode() != "local":
            try:
                from server.infra.sandbox.sandbox_provider import (
                    get_sandbox_provider,
                )

                provider = get_sandbox_provider()
                provider.destroy(provider._deterministic_id(thread_id))
            except Exception:  # noqa: BLE001
                pass

        # Host workspace (backend-side staging dir; local mode reads/writes it directly)
        try:
            base = ""
            from server.api.settings import settings

            base = settings.sandbox_workspace or os.path.join(
                os.path.expanduser("~"), "sandbox_workspace"
            )
            shutil.rmtree(os.path.join(base, thread_id), ignore_errors=True)
        except Exception:  # noqa: BLE001
            pass

        with _restored_lock:
            _restored.discard(conversation_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("cleanup_conversation_sandbox failed for %s: %s", conversation_id, exc)


def _remote_base(sandbox) -> str:
    """Base workspace path inside a remote (container) sandbox."""
    try:
        from server.infra.sandbox.local_sandbox import LocalSandboxAdapter

        if isinstance(sandbox, LocalSandboxAdapter):
            return sandbox._workspace
    except Exception:  # noqa: BLE001
        pass
    return "/workspace"
