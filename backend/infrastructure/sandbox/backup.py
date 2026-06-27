"""S3/MinIO backup service for conversation sandbox workspaces.

In K8s mode the sandbox Pod filesystem is ephemeral and is NOT bind-mounted from
the host, so files would be lost on Pod eviction/recreation. This service mirrors
a conversation's files to an S3-compatible object store (MinIO), keyed by the
conversation-scoped id, so they can be restored when a Pod is re-provisioned.

Object key layout:  ``sandbox/<conv-thread-id>/<rel_path>``

Everything is best-effort: when MinIO is not configured (``MINIO_ENABLED`` false)
every method is a no-op, so local/dev keeps working with zero setup. Failures log
and degrade — they never raise into a request or an staff run.
"""
from __future__ import annotations

import io
import os
from typing import Optional

from backend.log import get_logger

logger = get_logger(__name__)


class S3BackupService:
    """Mirror conversation workspaces to an S3-compatible bucket (MinIO)."""

    def __init__(
        self,
        *,
        endpoint: str,
        access_key: str,
        secret_key: str,
        bucket: str,
        secure: bool = False,
        key_root: str = "sandbox",
    ) -> None:
        self._bucket = bucket
        self._endpoint = endpoint
        self._key_root = key_root.strip("/") or "sandbox"
        self._client = None
        try:
            from minio import Minio  # type: ignore

            self._client = Minio(
                endpoint,
                access_key=access_key,
                secret_key=secret_key,
                secure=secure,
            )
            self._ensure_bucket()
        except Exception as exc:  # noqa: BLE001
            logger.warning("MinIO client init failed (%s); backups disabled.", exc)
            self._client = None

    @property
    def enabled(self) -> bool:
        return self._client is not None

    def _ensure_bucket(self) -> None:
        if self._client is None:
            return
        try:
            if not self._client.bucket_exists(self._bucket):
                self._client.make_bucket(self._bucket)
        except Exception as exc:  # noqa: BLE001
            logger.warning("MinIO ensure-bucket failed: %s", exc)

    def _key(self, thread_id: str, rel_path: str) -> str:
        return f"{self._key_root}/{thread_id}/{rel_path.lstrip('/')}"

    # ── Single object ──────────────────────────────────────────────────────────

    def backup_bytes(self, thread_id: str, rel_path: str, data: bytes) -> None:
        if self._client is None:
            return
        try:
            self._client.put_object(
                self._bucket,
                self._key(thread_id, rel_path),
                io.BytesIO(data),
                length=len(data),
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("MinIO backup_bytes failed for %s: %s", rel_path, exc)

    def get_bytes(self, thread_id: str, rel_path: str) -> Optional[bytes]:
        if self._client is None:
            return None
        resp = None
        try:
            resp = self._client.get_object(self._bucket, self._key(thread_id, rel_path))
            return resp.read()
        except Exception as exc:  # noqa: BLE001
            logger.warning("MinIO get_bytes failed for %s: %s", rel_path, exc)
            return None
        finally:
            if resp is not None:
                try:
                    resp.close()
                    resp.release_conn()
                except Exception:  # noqa: BLE001
                    pass

    # ── Listing & directory sync ────────────────────────────────────────────────

    def list_rel_paths(self, thread_id: str) -> list[str]:
        """Return rel_paths of all objects stored under this conversation."""
        if self._client is None:
            return []
        prefix = f"{self._key_root}/{thread_id}/"
        try:
            return [
                obj.object_name[len(prefix):]
                for obj in self._client.list_objects(
                    self._bucket, prefix=prefix, recursive=True
                )
                if not obj.object_name.endswith("/")
            ]
        except Exception as exc:  # noqa: BLE001
            logger.warning("MinIO list failed for %s: %s", thread_id, exc)
            return []

    def usage(self, scope_prefix: str = "") -> tuple[int, int]:
        """Return (object_count, total_bytes) under ``{key_root}/<scope_prefix>``."""
        if self._client is None:
            return (0, 0)
        prefix = f"{self._key_root}/{scope_prefix}".rstrip("/") + "/" if scope_prefix else f"{self._key_root}/"
        count = 0
        total = 0
        try:
            for obj in self._client.list_objects(self._bucket, prefix=prefix, recursive=True):
                if obj.object_name.endswith("/"):
                    continue
                count += 1
                total += int(obj.size or 0)
        except Exception as exc:  # noqa: BLE001
            logger.warning("MinIO usage failed for %s: %s", prefix, exc)
        return (count, total)

    def ping(self) -> bool:
        """Best-effort connectivity check (bucket existence)."""
        if self._client is None:
            return False
        try:
            return bool(self._client.bucket_exists(self._bucket))
        except Exception as exc:  # noqa: BLE001
            logger.warning("MinIO ping failed: %s", exc)
            return False

    def backup_dir(self, thread_id: str, root: str) -> int:
        """Upload every file under host *root* dir. Returns count uploaded."""
        if self._client is None or not os.path.isdir(root):
            return 0
        count = 0
        for dirpath, _dirs, files in os.walk(root):
            for name in files:
                abspath = os.path.join(dirpath, name)
                rel = os.path.relpath(abspath, root)
                try:
                    with open(abspath, "rb") as fh:
                        self.backup_bytes(thread_id, rel, fh.read())
                    count += 1
                except OSError as exc:
                    logger.warning("backup_dir read failed for %s: %s", abspath, exc)
        return count

    def restore_dir(self, thread_id: str, root: str) -> int:
        """Download every stored object into host *root* dir. Returns count."""
        if self._client is None:
            return 0
        count = 0
        for rel in self.list_rel_paths(thread_id):
            data = self.get_bytes(thread_id, rel)
            if data is None:
                continue
            dest = os.path.join(root, rel)
            try:
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                with open(dest, "wb") as fh:
                    fh.write(data)
                count += 1
            except OSError as exc:
                logger.warning("restore_dir write failed for %s: %s", dest, exc)
        return count

    def purge_object(self, thread_id: str, rel_path: str) -> None:
        """Delete a single object (best-effort)."""
        if self._client is None:
            return
        try:
            self._client.remove_object(self._bucket, self._key(thread_id, rel_path))
        except Exception as exc:  # noqa: BLE001
            logger.warning("MinIO purge_object failed for %s: %s", rel_path, exc)

    def purge(self, thread_id: str) -> None:
        """Delete all objects for a conversation (best-effort; used on cleanup)."""
        if self._client is None:
            return
        try:
            from minio.deleteobjects import DeleteObject  # type: ignore

            prefix = f"{self._key_root}/{thread_id}/"
            objs = [
                DeleteObject(o.object_name)
                for o in self._client.list_objects(
                    self._bucket, prefix=prefix, recursive=True
                )
            ]
            if objs:
                for err in self._client.remove_objects(self._bucket, objs):
                    logger.warning("MinIO purge error: %s", err)
        except Exception as exc:  # noqa: BLE001
            logger.warning("MinIO purge failed for %s: %s", thread_id, exc)


class _NoopBackupService:
    """Used when MinIO is disabled — every method is an inert no-op."""

    enabled = False

    def backup_bytes(self, *_a, **_k) -> None: ...
    def get_bytes(self, *_a, **_k):  # noqa: ANN001
        return None
    def list_rel_paths(self, *_a, **_k) -> list[str]:
        return []
    def backup_dir(self, *_a, **_k) -> int:
        return 0
    def restore_dir(self, *_a, **_k) -> int:
        return 0
    def usage(self, *_a, **_k) -> tuple[int, int]:
        return (0, 0)
    def ping(self, *_a, **_k) -> bool:
        return False
    def purge_object(self, *_a, **_k) -> None: ...
    def purge(self, *_a, **_k) -> None: ...


def create_backup_service(key_root: str = "sandbox"):
    """Build the configured backup service, or a no-op when MinIO is disabled.

    *key_root* is the object-key namespace (``sandbox`` for conversation files,
    ``library`` for the document library) so distinct stores never collide.
    """
    try:
        from backend.api.settings import settings

        cfg = settings.minio
        if not cfg.enabled:
            return _NoopBackupService()
        return S3BackupService(
            endpoint=cfg.endpoint,
            access_key=cfg.access_key,
            secret_key=cfg.secret_key,
            bucket=cfg.bucket,
            secure=cfg.secure,
            key_root=key_root,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Backup service unavailable (%s); using no-op.", exc)
        return _NoopBackupService()
