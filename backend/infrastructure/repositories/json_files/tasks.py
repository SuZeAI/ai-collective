from __future__ import annotations

import threading

from backend.domain.enums import TaskStatus
from backend.domain.models import DEFAULT_OWNER_ID, Task
from backend.infrastructure.repositories._helpers import parse_iso_utc
from backend.infrastructure.repositories.json_store import JsonFileStore


class JsonTaskRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Task] = {}
        for item in data:
            try:
                start_time_raw = item.get("startTime")
                end_time_raw = item.get("endTime")
                task = Task(
                    id=str(item["id"]),
                    title=str(item.get("title", "")),
                    description=str(item.get("description", "")),
                    team_id=str(item.get("teamId", "")),
                    status=TaskStatus(str(item.get("status", "pending"))),
                    progress=int(item.get("progress", 0)),
                    assigned_agents=[str(x) for x in (item.get("assignedAgents") or [])],
                    start_time=parse_iso_utc(str(start_time_raw)) if start_time_raw else None,
                    end_time=parse_iso_utc(str(end_time_raw)) if end_time_raw else None,
                    owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
                )
                self._items[task.id] = task
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write(
            [
                {
                    "id": t.id,
                    "title": t.title,
                    "description": t.description,
                    "teamId": t.team_id,
                    "status": t.status.value,
                    "progress": t.progress,
                    "assignedAgents": list(t.assigned_agents),
                    "startTime": t.start_time.isoformat() if t.start_time else None,
                    "endTime": t.end_time.isoformat() if t.end_time else None,
                    "owner_id": t.owner_id,
                }
                for t in self._items.values()
            ]
        )

    def list(self) -> list[Task]:
        with self._lock:
            return list(self._items.values())

    def get(self, task_id: str) -> Task | None:
        with self._lock:
            return self._items.get(task_id)

    def upsert(self, task: Task) -> Task:
        with self._lock:
            self._items[task.id] = task
            self._persist()
        return task

    def delete(self, task_id: str) -> None:
        with self._lock:
            self._items.pop(task_id, None)
            self._persist()
