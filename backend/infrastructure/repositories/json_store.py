from __future__ import annotations

import json
import os
import tempfile
from contextlib import contextmanager
from pathlib import Path
from threading import RLock
from typing import Any


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

    @property
    def path(self) -> Path:
        return self._path

    def exists(self) -> bool:
        return self._path.exists()

    @contextmanager
    def _lock(self):
        """Return the active lock context — provider-supplied or local threading.RLock."""
        if self._lock_provider is not None:
            with self._lock_provider.acquire(self._path.name):
                yield
        else:
            with self._local_lock:
                yield

    def read(self) -> Any:
        with self._lock():
            if not self._path.exists():
                return None
            return json.loads(self._path.read_text(encoding="utf-8"))

    def write(self, data: Any) -> None:
        with self._lock():
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
