from __future__ import annotations

import threading

from server.domain.models import ActivityFeedItem
from server.infra.repositories.json_store import JsonFileStore

# This backs a "recent activity" feed, not an audit trail — bound it so the
# JSON file (rewritten in full on every add()) can't grow unboundedly.
_MAX_FEED_ITEMS = 200


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
        self._items = self._items[:_MAX_FEED_ITEMS]

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
                merged = [item] + existing
                return [self._serialize_item(p) for p in merged[:_MAX_FEED_ITEMS]]

            new_raw = self._store.read_modify_write(modify)
            self._items = [p for p in (self._parse_item(r) for r in new_raw) if p is not None]
        return item
