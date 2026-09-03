from __future__ import annotations

import threading

from backend.domain.enums import SprintStatus
from backend.domain.models import DEFAULT_OWNER_ID, Sprint
from backend.infra.repositories._helpers import parse_iso_utc
from backend.infra.repositories.json_store import JsonFileStore


class JsonSprintRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Sprint] = {}
        for item in data:
            parsed = self._parse_item(item)
            if parsed is not None:
                self._items[parsed.id] = parsed

    @staticmethod
    def _parse_item(item: dict) -> Sprint | None:
        try:
            try:
                status = SprintStatus(str(item.get("status", "planned")))
            except ValueError:
                status = SprintStatus.planned
            start_raw = item.get("startDate")
            end_raw = item.get("endDate")
            return Sprint(
                id=str(item["id"]),
                project_id=str(item.get("projectId", "")),
                name=str(item.get("name", "")),
                goal=str(item.get("goal", "")),
                status=status,
                start_date=parse_iso_utc(str(start_raw)) if start_raw else None,
                end_date=parse_iso_utc(str(end_raw)) if end_raw else None,
                owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
            )
        except Exception:
            return None

    @staticmethod
    def _serialize_item(s: Sprint) -> dict:
        return {
            "id": s.id,
            "projectId": s.project_id,
            "name": s.name,
            "goal": s.goal,
            "status": s.status.value if hasattr(s.status, "value") else str(s.status),
            "startDate": s.start_date.isoformat() if s.start_date else None,
            "endDate": s.end_date.isoformat() if s.end_date else None,
            "owner_id": s.owner_id,
        }

    def list(self) -> list[Sprint]:
        with self._lock:
            return list(self._items.values())

    def get(self, sprint_id: str) -> Sprint | None:
        with self._lock:
            return self._items.get(sprint_id)

    def upsert(self, sprint: Sprint) -> Sprint:
        with self._lock:
            self._items = self._merge_and_persist({sprint.id: sprint}, remove_ids=())
        return sprint

    def delete(self, sprint_id: str) -> None:
        with self._lock:
            self._items = self._merge_and_persist({}, remove_ids=(sprint_id,))

    def _merge_and_persist(
        self, upserts: dict[str, Sprint], remove_ids: tuple[str, ...]
    ) -> dict[str, Sprint]:
        """Merge this change into the *current on-disk* state (not just this
        process's in-memory cache) under one lock acquisition, so a concurrent
        writer in another process/instance can't have its update silently
        overwritten (lost-update)."""

        def modify(current):
            raw_items = current if isinstance(current, list) else []
            merged = {str(d["id"]): d for d in raw_items if isinstance(d, dict) and "id" in d}
            for sprint_id in remove_ids:
                merged.pop(sprint_id, None)
            for sprint_id, sprint in upserts.items():
                merged[sprint_id] = self._serialize_item(sprint)
            return list(merged.values())

        new_raw = self._store.read_modify_write(modify)
        result: dict[str, Sprint] = {}
        for item in new_raw:
            parsed = self._parse_item(item)
            if parsed is not None:
                result[parsed.id] = parsed
        return result
