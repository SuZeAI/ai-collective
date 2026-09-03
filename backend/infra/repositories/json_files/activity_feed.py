from __future__ import annotations

import threading

from backend.domain.models import ActivityFeedItem
from backend.infra.repositories.json_store import JsonFileStore


class JsonActivityFeedRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: list[ActivityFeedItem] = []
        for item in data:
            parsed = self._parse_item(item)
            if parsed is not None:
                self._items.append(parsed)

    @staticmethod
    def _parse_item(item: dict) -> ActivityFeedItem | None:
        try:
            return ActivityFeedItem(
                id=str(item["id"]),
                staff_id=str(item.get("agentId", "")),
                action=str(item.get("action", "")),
                time=str(item.get("time", "")),
            )
        except Exception:
            return None

    @staticmethod
    def _serialize_item(i: ActivityFeedItem) -> dict:
        return {"id": i.id, "agentId": i.staff_id, "action": i.action, "time": i.time}

    def list(self) -> list[ActivityFeedItem]:
        with self._lock:
            return list(self._items)

    def add(self, item: ActivityFeedItem) -> ActivityFeedItem:
        """Prepend into the *current on-disk* feed (not just this process's
        in-memory cache), so a concurrent writer in another process/instance
        can't have its entry silently dropped (lost-update)."""
        with self._lock:
            def modify(current):
                raw_items = current if isinstance(current, list) else []
                existing = [p for p in (self._parse_item(r) for r in raw_items) if p is not None]
                return [self._serialize_item(item)] + [self._serialize_item(p) for p in existing]

            new_raw = self._store.read_modify_write(modify)
            self._items = [p for p in (self._parse_item(r) for r in new_raw) if p is not None]
        return item
