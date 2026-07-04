from __future__ import annotations

import threading

from backend.domain.models import DEFAULT_OWNER_ID, Department
from backend.infrastructure.repositories.json_store import JsonFileStore


class JsonDepartmentRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Department] = {}
        for item in data:
            try:
                department = Department(
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
                self._items[department.id] = department
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write(
            [
                {
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
                for t in self._items.values()
            ]
        )

    def list(self) -> list[Department]:
        with self._lock:
            return list(self._items.values())

    def get(self, department_id: str) -> Department | None:
        with self._lock:
            return self._items.get(department_id)

    def upsert(self, department: Department) -> Department:
        with self._lock:
            self._items[department.id] = department
            self._persist()
        return department

    def delete(self, department_id: str) -> None:
        with self._lock:
            self._items.pop(department_id, None)
            self._persist()
