"""Google OAuth user-token persistence: local secrets/ dir + optional MinIO mirror.

Each Google Workspace toolkit (calendar/docs/drive/sheet/slides) resolves a
per-user token file under ``secrets/google/<user_id>/<tool_name>/token_<email>.json``
once that user authenticates (see ``backend.api.routers.auth``). That directory
is intentionally OUTSIDE the sandbox workspace tree — sandboxed code execution
must never be able to read another user's OAuth token — so this does not
reuse ``FileStore`` (which roots local files under the sandbox workspace).
Instead it mirrors bytes to MinIO the same way the sandbox/document-library
stores do: via ``S3BackupService``, under its own ``google_tokens`` key root,
so a token survives a pod reschedule in k8s sandbox mode when
``minio.enabled`` is set. The MinIO object key mirrors the local path's
position under ``secrets/google/`` (so the ``<user_id>/<tool_name>/...``
layout carries over 1:1) rather than a caller-supplied scope, so two
different users' tokens never collide in either store. With MinIO disabled
this is unchanged local-disk behavior.
"""
from __future__ import annotations

from pathlib import Path

from backend.log import get_logger

logger = get_logger(__name__)

_TOKENS_ROOT = Path("secrets") / "google"
_backup = None


def _backup_service():
    global _backup
    if _backup is None:
        from backend.infra.sandbox.backup import create_backup_service

        _backup = create_backup_service(key_root="google_tokens")
    return _backup


def _rel_key(local_path: str) -> str:
    """*local_path* relative to secrets/google/, so the MinIO key follows the
    same <user_id>/<tool_name>/... layout as the local path. Falls back to
    just the file name for a path outside that tree."""
    try:
        return str(Path(local_path).resolve().relative_to(_TOKENS_ROOT.resolve()))
    except ValueError:
        return Path(local_path).name


def save_token(local_path: str, token_json: str) -> None:
    """Write *token_json* to *local_path*, mirrored to MinIO when enabled."""
    path = Path(local_path)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(token_json, encoding="utf-8")
    except OSError as exc:
        logger.warning("Google token local write failed for %s: %s", path, exc)
    svc = _backup_service()
    if svc.enabled:
        svc.backup_bytes("tokens", _rel_key(local_path), token_json.encode("utf-8"))


def restore_token_if_missing(local_path: str) -> None:
    """Rehydrate *local_path* from MinIO when the local copy is missing."""
    path = Path(local_path)
    if path.is_file():
        return
    svc = _backup_service()
    if not svc.enabled:
        return
    data = svc.get_bytes("tokens", _rel_key(local_path))
    if data is None:
        return
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    except OSError as exc:
        logger.warning("Google token restore write failed for %s: %s", path, exc)
