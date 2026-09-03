from __future__ import annotations

import threading

from backend.infra.repositories.json_store import JsonFileStore


class JsonSystemSettingsRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()

    def get_active_model(self) -> str | None:
        with self._lock:
            data = self._store.read()
            value = data.get("active_model") if isinstance(data, dict) else None
            return str(value) if value else None

    def set_active_model(self, name: str) -> None:
        with self._lock:
            def modify(current):
                doc = dict(current) if isinstance(current, dict) else {}
                doc["active_model"] = name
                return doc

            self._store.read_modify_write(modify)
