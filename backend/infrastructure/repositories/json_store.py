from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from threading import RLock
from typing import Any


class JsonFileStore:
    def __init__(self, path: Path):
        self._path = path
        self._lock = RLock()

    @property
    def path(self) -> Path:
        return self._path

    def exists(self) -> bool:
        return self._path.exists()

    def read(self) -> Any:
        with self._lock:
            if not self._path.exists():
                return None
            return json.loads(self._path.read_text(encoding="utf-8"))

    def write(self, data: Any) -> None:
        with self._lock:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            payload = json.dumps(data, ensure_ascii=False, indent=2)
            # Atomic write
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
