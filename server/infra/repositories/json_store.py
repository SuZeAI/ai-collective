from __future__ import annotations

import json
import os
import tempfile
from contextlib import contextmanager
from pathlib import Path
from threading import RLock
from typing import Any, Callable


class JsonFileStore:
    """Atomic JSON file store with pluggable locking.

    By default uses a per-instance ``threading.RLock`` (single-process safe).
    Pass a ``lock_provider`` (e.g. ``RedisLockProvider``) for distributed locking
    across multiple processes/instances.
    """

    def __init__(self, path: Path, lock_provider=None) -> None:
        self._path = path
        self._lock_provider = lock_provider
        self._local_lock = RLock()  # always present as in-process fallback
        # Full resolved path, not just the basename — two files with the same
        # name under different directories (e.g. different STORAGE_DIRs, or a
        # per-namespace subdir) must not share a distributed lock key.
        self._lock_key = str(self._path.resolve())

    @property
    def path(self) -> Path:
        return self._path

    def exists(self) -> bool:
        return self._path.exists()

    @contextmanager
    def _lock(self):
        """Return the active lock context — provider-supplied or local threading.RLock."""
        if self._lock_provider is not None:
            with self._lock_provider.acquire(self._lock_key):
                yield
        else:
            with self._local_lock:
                yield

    def _read_raw(self) -> Any:
        if not self._path.exists():
            return None
        return json.loads(self._path.read_text(encoding="utf-8"))

    def _write_raw(self, data: Any) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(data, ensure_ascii=False, indent=2)
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            delete=False,
            dir=str(self._path.parent),
            prefix=self._path.name + ".",
            suffix=".tmp",
        ) as f:
            f.write(payload)
            tmp_name = f.name
        os.replace(tmp_name, self._path)

    def read(self) -> Any:
        with self._lock():
            return self._read_raw()

    def write(self, data: Any) -> None:
        with self._lock():
            self._write_raw(data)

    def read_modify_write(self, modify_fn: Callable[[Any], Any]) -> Any:
        """Read, apply modify_fn, and write back — holding the lock for the
        whole cycle so a concurrent writer in another process can't interleave
        a stale read between this read and write (the lost-update problem a
        separate read() + write() pair has under multi-process/multi-instance
        deployments, e.g. STORAGE_BACKEND=json with LOCK_BACKEND=redis).

        ``modify_fn`` receives the freshly-read current data (or None if the
        file doesn't exist yet) and must return the new data to persist.
        """
        with self._lock():
            current = self._read_raw()
            new_data = modify_fn(current)
            self._write_raw(new_data)
            return new_data
