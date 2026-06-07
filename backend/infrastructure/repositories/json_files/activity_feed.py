from __future__ import annotations

import threading

from backend.domain.models import ActivityFeedItem
from backend.infrastructure.repositories.json_store import JsonFileStore


class JsonActivityFeedRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: list[ActivityFeedItem] = []
        for item in data:
            try:
                self._items.append(
                    ActivityFeedItem(
                        id=str(item["id"]),
                        agent_id=str(item.get("agentId", "")),
                        action=str(item.get("action", "")),
                        time=str(item.get("time", "")),
                    )
                )
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write(
            [{"id": i.id, "agentId": i.agent_id, "action": i.action, "time": i.time} for i in self._items]
        )

    def list(self) -> list[ActivityFeedItem]:
        with self._lock:
            return list(self._items)

    def add(self, item: ActivityFeedItem) -> ActivityFeedItem:
        with self._lock:
            self._items.insert(0, item)
            self._persist()
        return item
