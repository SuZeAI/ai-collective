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
            parsed = self._parse_item(item)
            if parsed is not None:
                self._items[parsed.id] = parsed

    @staticmethod
    def _parse_item(item: dict) -> Epic | None:
        try:
            try:
                status = TaskStatus(str(item.get("status", "pending")))
            except ValueError:
                status = TaskStatus.pending
            start_raw = item.get("startDate")
            due_raw = item.get("dueDate")
            return Epic(
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
        except Exception:
            return None

    @staticmethod
    def _serialize_item(e: Epic) -> dict:
        return {
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

    def list(self) -> list[Epic]:
        with self._lock:
            return list(self._items.values())

    def get(self, epic_id: str) -> Epic | None:
        with self._lock:
            return self._items.get(epic_id)

    def upsert(self, epic: Epic) -> Epic:
        with self._lock:
            self._items = self._merge_and_persist({epic.id: epic}, remove_ids=())
        return epic

    def delete(self, epic_id: str) -> None:
        with self._lock:
            self._items = self._merge_and_persist({}, remove_ids=(epic_id,))

    def _merge_and_persist(
        self, upserts: dict[str, Epic], remove_ids: tuple[str, ...]
    ) -> dict[str, Epic]:
        """Merge this change into the *current on-disk* state (not just this
        process's in-memory cache) under one lock acquisition, so a concurrent
        writer in another process/instance can't have its update silently
        overwritten (lost-update)."""

        def modify(current):
            raw_items = current if isinstance(current, list) else []
            merged = {str(d["id"]): d for d in raw_items if isinstance(d, dict) and "id" in d}
            for epic_id in remove_ids:
                merged.pop(epic_id, None)
            for epic_id, epic in upserts.items():
                merged[epic_id] = self._serialize_item(epic)
            return list(merged.values())

        new_raw = self._store.read_modify_write(modify)
        result: dict[str, Epic] = {}
        for item in new_raw:
            parsed = self._parse_item(item)
            if parsed is not None:
                result[parsed.id] = parsed
        return result
