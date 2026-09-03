from __future__ import annotations

import threading

from server.domain.models import DEFAULT_OWNER_ID, Department
from server.infra.repositories.json_store import JsonFileStore


class JsonDepartmentRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Department] = {}
        for item in data:
            parsed = self._parse_item(item)
            if parsed is not None:
                self._items[parsed.id] = parsed

    @staticmethod
    def _parse_item(item: dict) -> Department | None:
        try:
            return Department(
                id=str(item["id"]),
                name=str(item.get("name", "")),
                description=str(item.get("description", "")),
                staff=[str(x) for x in (item.get("agents") or [])],
                active_tasks=int(item.get("activeTasks", 0)),
                avatar=str(item.get("avatar", "") or str(item.get("name", "") or "T")[:1].upper()),
                avatar_icon=str(item.get("avatar_icon", "") or ""),
                avatar_color=str(item.get("avatar_color", "") or ""),
                avatar_url=str(item.get("avatar_url", "") or ""),
                mode=str(item.get("mode", "sequential")),
                max_steps=int(item.get("maxSteps", 6)),
                owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
                flow=item.get("flow") if isinstance(item.get("flow"), dict) else None,
            )
        except Exception:
            return None

    @staticmethod
    def _serialize_item(t: Department) -> dict:
        return {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "agents": list(t.staff),
            "activeTasks": t.active_tasks,
            "avatar": t.avatar,
            "avatar_icon": t.avatar_icon,
            "avatar_color": t.avatar_color,
            "avatar_url": t.avatar_url,
            "mode": t.mode,
            "maxSteps": t.max_steps,
            "owner_id": t.owner_id,
            "flow": t.flow,
        }

    def list(self) -> list[Department]:
        with self._lock:
            return list(self._items.values())

    def get(self, department_id: str) -> Department | None:
        with self._lock:
            return self._items.get(department_id)

    def upsert(self, department: Department) -> Department:
        with self._lock:
            self._items = self._merge_and_persist({department.id: department}, remove_ids=())
        return department

    def delete(self, department_id: str) -> None:
        with self._lock:
            self._items = self._merge_and_persist({}, remove_ids=(department_id,))

    def _merge_and_persist(
        self, upserts: dict[str, Department], remove_ids: tuple[str, ...]
    ) -> dict[str, Department]:
        """Merge this change into the *current on-disk* state (not just this
        process's in-memory cache) under one lock acquisition, so a concurrent
        writer in another process/instance can't have its update silently
        overwritten (lost-update)."""

        def modify(current):
            raw_items = current if isinstance(current, list) else []
            merged = {str(d["id"]): d for d in raw_items if isinstance(d, dict) and "id" in d}
            for department_id in remove_ids:
                merged.pop(department_id, None)
            for department_id, department in upserts.items():
                merged[department_id] = self._serialize_item(department)
            return list(merged.values())

        new_raw = self._store.read_modify_write(modify)
        result: dict[str, Department] = {}
        for item in new_raw:
            parsed = self._parse_item(item)
            if parsed is not None:
                result[parsed.id] = parsed
        return result
