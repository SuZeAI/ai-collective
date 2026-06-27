from __future__ import annotations

import threading

from backend.domain.enums import SprintStatus
from backend.domain.models import DEFAULT_OWNER_ID, Sprint
from backend.infrastructure.repositories._helpers import parse_iso_utc
from backend.infrastructure.repositories.json_store import JsonFileStore


class JsonSprintRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Sprint] = {}
        for item in data:
            try:
                try:
                    status = SprintStatus(str(item.get("status", "planned")))
                except ValueError:
                    status = SprintStatus.planned
                start_raw = item.get("startDate")
                end_raw = item.get("endDate")
                sprint = Sprint(
                    id=str(item["id"]),
                    project_id=str(item.get("projectId", "")),
                    name=str(item.get("name", "")),
                    goal=str(item.get("goal", "")),
                    status=status,
                    start_date=parse_iso_utc(str(start_raw)) if start_raw else None,
                    end_date=parse_iso_utc(str(end_raw)) if end_raw else None,
                    owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
                )
                self._items[sprint.id] = sprint
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write(
            [
                {
                    "id": s.id,
                    "projectId": s.project_id,
                    "name": s.name,
                    "goal": s.goal,
                    "status": s.status.value if hasattr(s.status, "value") else str(s.status),
                    "startDate": s.start_date.isoformat() if s.start_date else None,
                    "endDate": s.end_date.isoformat() if s.end_date else None,
                    "owner_id": s.owner_id,
                }
                for s in self._items.values()
            ]
        )

    def list(self) -> list[Sprint]:
        with self._lock:
            return list(self._items.values())

    def get(self, sprint_id: str) -> Sprint | None:
        with self._lock:
            return self._items.get(sprint_id)

    def upsert(self, sprint: Sprint) -> Sprint:
        with self._lock:
            self._items[sprint.id] = sprint
            self._persist()
        return sprint

    def delete(self, sprint_id: str) -> None:
        with self._lock:
            self._items.pop(sprint_id, None)
            self._persist()
