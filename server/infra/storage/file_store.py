"""FileStore — one facade over file *bytes*, switchable between local disk and S3/MinIO.

Both conversation sandbox files and the document library route their bytes through
this facade so the ``local`` ⇄ ``s3`` decision lives in exactly one place
(``settings.file_storage_backend``).

A store is created per *namespace* (object-key/dir root):
  * ``sandbox``  → conversation files; scope id = the conversation thread id (``conv-…``)
  * ``library``  → document library;   scope id = the Business Unit (workspace) id

Layout (identical shape on both backends):
  local:  ``{base}/{rel_root}/{scope_id}/{rel_path}``
  s3:     ``{key_root}/{scope_id}/{rel_path}``  (MinIO object key)

Backends:
  * ``local`` → bytes live only on the host dir. ``get`` reads the host dir; restore is a no-op.
  * ``s3``    → MinIO is the durable system of record. ``put`` write-throughs to BOTH the host
                dir (so sandbox tools / the host FS can read it) AND MinIO; ``get`` falls back to
                MinIO when the host copy is missing; ``restore_to_dir`` rehydrates the host dir.

Everything is best-effort: failures log and degrade so a request/staff run never breaks.
"""
from __future__ import annotations

import os
from typing import Optional

from server.log import get_logger

logger = get_logger(__name__)


def workspace_base() -> str:
    """Resolve the host workspace base — identical to ``sandbox_session`` resolution."""
    try:
        from server.api.settings import settings

        return settings.sandbox_workspace or os.path.join(
            os.path.expanduser("~"), "sandbox_workspace"
        )
    except Exception:  # noqa: BLE001 - usable without full app wiring (tests)
        return os.path.join(os.path.expanduser("~"), "sandbox_workspace")


def _s3_enabled() -> bool:
    try:
        from server.api.settings import settings

        return settings.file_storage_backend == "s3"
    except Exception:  # noqa: BLE001
        return False


class FileStore:
    """Byte store for one namespace, backed by local disk and (optionally) S3/MinIO."""

    def __init__(self, namespace: str) -> None:
        self.namespace = namespace.strip("/") or "sandbox"
        # ``sandbox`` files live at the workspace root (no extra segment) to match
        # the existing host layout; every other namespace gets its own subdir.
        if self.namespace == "sandbox":
            self._local_root = workspace_base()
        else:
            self._local_root = os.path.join(workspace_base(), self.namespace)
        self._backup = None  # lazily built S3 service (or no-op)

    # ── backend selection ──────────────────────────────────────────────────────

    @property
    def s3(self):
        if self._backup is None:
            from server.infra.sandbox.backup import create_backup_service

            self._backup = create_backup_service(key_root=self.namespace)
        return self._backup

    def _use_s3(self) -> bool:
        return _s3_enabled() and self.s3.enabled

    # ── path helpers ─────────────────────────────────────────────────────────────

    def local_path(self, scope_id: str, rel_path: str = "") -> str:
        """Join scope_id/rel_path onto the store root, confined to that root.

        Both segments can originate from request input (e.g. a document
        library ``workspaceId`` form field); without confinement a value like
        ``../../../etc`` would escape ``_local_root`` entirely (path traversal
        / arbitrary file write).
        """
        root = os.path.abspath(self._local_root)
        dest = os.path.abspath(
            os.path.join(root, scope_id, rel_path) if rel_path else os.path.join(root, scope_id)
        )
        if os.path.commonpath([root, dest]) != root:
            raise ValueError(f"Path escapes storage root: scope_id={scope_id!r} rel_path={rel_path!r}")
        return dest

    # ── operations ───────────────────────────────────────────────────────────────

    def put(self, scope_id: str, rel_path: str, data: bytes) -> None:
        """Persist *data*. Always writes the host copy; mirrors to S3 in ``s3`` mode."""
        dest = self.local_path(scope_id, rel_path)
        try:
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, "wb") as fh:
                fh.write(data)
        except OSError as exc:
            logger.warning("FileStore.put local write failed for %s: %s", dest, exc)
        if self._use_s3():
            self.s3.backup_bytes(scope_id, rel_path, data)

    def get(self, scope_id: str, rel_path: str) -> Optional[bytes]:
        """Read *rel_path*. Prefers the host copy, falls back to S3 in ``s3`` mode."""
        src = self.local_path(scope_id, rel_path)
        try:
            if os.path.isfile(src):
                with open(src, "rb") as fh:
                    return fh.read()
        except OSError as exc:
            logger.warning("FileStore.get local read failed for %s: %s", src, exc)
        if self._use_s3():
            data = self.s3.get_bytes(scope_id, rel_path)
            if data is not None:
                # Repopulate the host cache so subsequent reads are local.
                try:
                    os.makedirs(os.path.dirname(src), exist_ok=True)
                    with open(src, "wb") as fh:
                        fh.write(data)
                except OSError:
                    pass
            return data
        return None

    def list(self, scope_id: str) -> list[str]:
        """Return rel_paths under *scope_id* (union of host dir + S3 in ``s3`` mode)."""
        found: set[str] = set()
        root = self.local_path(scope_id)
        if os.path.isdir(root):
            for dirpath, _dirs, files in os.walk(root):
                for name in files:
                    found.add(os.path.relpath(os.path.join(dirpath, name), root))
        if self._use_s3():
            found.update(self.s3.list_rel_paths(scope_id))
        return sorted(found)

    def delete(self, scope_id: str, rel_path: str) -> None:
        src = self.local_path(scope_id, rel_path)
        try:
            if os.path.isfile(src):
                os.remove(src)
        except OSError as exc:
            logger.warning("FileStore.delete local failed for %s: %s", src, exc)
        if self._use_s3():
            try:
                self.s3.purge_object(scope_id, rel_path)
            except Exception as exc:  # noqa: BLE001
                logger.warning("FileStore.delete s3 failed for %s: %s", rel_path, exc)

    def restore_to_dir(self, scope_id: str, dest_dir: str) -> int:
        """Rehydrate the host *dest_dir* from S3. No-op in ``local`` mode. Returns count."""
        if not self._use_s3():
            return 0
        return self.s3.restore_dir(scope_id, dest_dir)

    def backup_dir(self, scope_id: str, src_dir: str) -> int:
        """Mirror everything under host *src_dir* up to S3. No-op in ``local`` mode."""
        if not self._use_s3():
            return 0
        return self.s3.backup_dir(scope_id, src_dir)


# Process-wide singletons (the underlying S3 client is itself memoised).
_stores: dict[str, FileStore] = {}


def get_file_store(namespace: str = "sandbox") -> FileStore:
    store = _stores.get(namespace)
    if store is None:
        store = FileStore(namespace)
        _stores[namespace] = store
    return store
