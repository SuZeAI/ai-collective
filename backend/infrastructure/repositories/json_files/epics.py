from __future__ import annotations

import threading

from backend.domain.enums import TaskStatus
from backend.domain.models import DEFAULT_OWNER_ID, Epic
from backend.infrastructure.repositories._helpers import parse_iso_utc
from backend.infrastructure.repositories.json_store import JsonFileStore


class JsonEpicRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Epic] = {}
        for item in data:
            try:
                try:
                    status = TaskStatus(str(item.get("status", "pending")))
                except ValueError:
                    status = TaskStatus.pending
                start_raw = item.get("startDate")
                due_raw = item.get("dueDate")
                epic = Epic(
                    id=str(item["id"]),
                    project_id=str(item.get("projectId", "")),
                    key=str(item.get("key", "")),
                    title=str(item.get("title", "")),
                    description=str(item.get("description", "")),
                    status=status,
                    color=str(item.get("color", "")),
                    start_date=parse_iso_utc(str(start_raw)) if start_raw else None,
                    due_date=parse_iso_utc(str(due_raw)) if due_raw else None,
                    owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
                )
                self._items[epic.id] = epic
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write(
            [
                {
                    "id": e.id,
                    "projectId": e.project_id,
                    "key": e.key,
                    "title": e.title,
                    "description": e.description,
                    "status": e.status.value if hasattr(e.status, "value") else str(e.status),
                    "color": e.color,
                    "startDate": e.start_date.isoformat() if e.start_date else None,
                    "dueDate": e.due_date.isoformat() if e.due_date else None,
                    "owner_id": e.owner_id,
                }
                for e in self._items.values()
            ]
        )

    def list(self) -> list[Epic]:
        with self._lock:
            return list(self._items.values())

    def get(self, epic_id: str) -> Epic | None:
        with self._lock:
            return self._items.get(epic_id)

    def upsert(self, epic: Epic) -> Epic:
        with self._lock:
            self._items[epic.id] = epic
            self._persist()
        return epic

    def delete(self, epic_id: str) -> None:
        with self._lock:
            self._items.pop(epic_id, None)
            self._persist()
