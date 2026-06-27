from __future__ import annotations

import threading
from datetime import datetime, timezone

from backend.domain.models import Message
from backend.infrastructure.repositories._helpers import parse_iso_utc
from backend.infrastructure.repositories.json_store import JsonFileStore


class JsonMeetingRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: list[Message] = []
        for item in data:
            try:
                ts = str(item.get("timestamp") or "")
                dt = parse_iso_utc(ts) if ts else datetime.now(timezone.utc).replace(microsecond=0)
                self._items.append(
                    Message(
                        id=str(item["id"]),
                        staff_id=str(item.get("agentId", "")),
                        content=str(item.get("content", "")),
                        timestamp=dt,
                        task_id=(str(item.get("taskId")) if item.get("taskId") is not None else None),
                    )
                )
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write(
            [
                {
                    "id": m.id,
                    "agentId": m.staff_id,
                    "content": m.content,
                    "timestamp": m.timestamp.isoformat(),
                    "taskId": m.task_id,
                }
                for m in self._items
            ]
        )

    def list(self, task_id: str | None = None) -> list[Message]:
        with self._lock:
            if task_id is None:
                return list(self._items)
            return [m for m in self._items if m.task_id == task_id]

    def add(self, message: Message) -> Message:
        with self._lock:
            self._items.append(message)
            self._persist()
        return message

    def delete_by_task(self, task_id: str) -> None:
        with self._lock:
            self._items = [m for m in self._items if m.task_id != task_id]
            self._persist()
