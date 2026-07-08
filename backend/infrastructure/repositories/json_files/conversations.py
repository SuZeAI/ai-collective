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
            parsed = self._parse_item(item)
            if parsed is not None:
                self._items.append(parsed)

    @staticmethod
    def _parse_item(item: dict) -> Message | None:
        try:
            ts = str(item.get("timestamp") or "")
            dt = parse_iso_utc(ts) if ts else datetime.now(timezone.utc).replace(microsecond=0)
            return Message(
                id=str(item["id"]),
                staff_id=str(item.get("agentId", "")),
                content=str(item.get("content", "")),
                timestamp=dt,
                task_id=(str(item.get("taskId")) if item.get("taskId") is not None else None),
            )
        except Exception:
            return None

    @staticmethod
    def _serialize_item(m: Message) -> dict:
        return {
            "id": m.id,
            "agentId": m.staff_id,
            "content": m.content,
            "timestamp": m.timestamp.isoformat(),
            "taskId": m.task_id,
        }

    def list(self, task_id: str | None = None) -> list[Message]:
        with self._lock:
            if task_id is None:
                return list(self._items)
            return [m for m in self._items if m.task_id == task_id]

    def add(self, message: Message) -> Message:
        """Append into the *current on-disk* transcript (not just this
        process's in-memory cache), so concurrent instances chatting in the
        same task can't silently drop each other's messages (lost-update) —
        this is the highest-write-volume store in the app."""
        with self._lock:
            def modify(current):
                raw_items = current if isinstance(current, list) else []
                existing = [p for p in (self._parse_item(r) for r in raw_items) if p is not None]
                return [self._serialize_item(p) for p in existing] + [self._serialize_item(message)]

            new_raw = self._store.read_modify_write(modify)
            self._items = [p for p in (self._parse_item(r) for r in new_raw) if p is not None]
        return message

    def delete_by_task(self, task_id: str) -> None:
        with self._lock:
            def modify(current):
                raw_items = current if isinstance(current, list) else []
                existing = [p for p in (self._parse_item(r) for r in raw_items) if p is not None]
                kept = [p for p in existing if p.task_id != task_id]
                return [self._serialize_item(p) for p in kept]

            new_raw = self._store.read_modify_write(modify)
            self._items = [p for p in (self._parse_item(r) for r in new_raw) if p is not None]
