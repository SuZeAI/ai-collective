from __future__ import annotations

import threading

from backend.domain.enums import StaffStatus
from backend.domain.models import DEFAULT_OWNER_ID, Staff
from backend.infrastructure.repositories._helpers import default_staff_system_prompt
from backend.infrastructure.repositories.json_store import JsonFileStore


class JsonStaffRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Staff] = {}
        for item in data:
            parsed = self._parse_item(item)
            if parsed is not None:
                self._items[parsed.id] = parsed

    @staticmethod
    def _parse_item(item: dict) -> Staff | None:
        try:
            return Staff(
                id=str(item["id"]),
                name=str(item.get("name", "")),
                role=str(item.get("role", "")),
                description=str(item.get("description", "")),
                skill_ids=[str(x) for x in (item.get("skillIds") or [])],
                status=StaffStatus(str(item.get("status", "idle"))),
                avatar=str(item.get("avatar", "A")),
                avatar_icon=str(item.get("avatar_icon", "") or ""),
                avatar_color=str(item.get("avatar_color", "") or ""),
                avatar_url=str(item.get("avatar_url", "") or ""),
                system_prompt=(
                    str(item.get("system_prompt", "")).strip()
                    or default_staff_system_prompt(
                        name=str(item.get("name", "")),
                        role=str(item.get("role", "")),
                        description=str(item.get("description", "")),
                    )
                ),
                subagent_enabled=bool(item.get("subagent_enabled", False)),
                owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
            )
        except Exception:
            return None

    @staticmethod
    def _serialize_item(a: Staff) -> dict:
        return {
            "id": a.id,
            "name": a.name,
            "role": a.role,
            "description": a.description,
            "skillIds": list(a.skill_ids),
            "status": a.status.value,
            "avatar": a.avatar,
            "avatar_icon": a.avatar_icon,
            "avatar_color": a.avatar_color,
            "avatar_url": a.avatar_url,
            "system_prompt": a.system_prompt
            or default_staff_system_prompt(name=a.name, role=a.role, description=a.description),
            "subagent_enabled": a.subagent_enabled,
            "owner_id": a.owner_id,
        }

    def list(self) -> list[Staff]:
        with self._lock:
            return list(self._items.values())

    def get(self, staff_id: str) -> Staff | None:
        with self._lock:
            return self._items.get(staff_id)

    def upsert(self, staff: Staff) -> Staff:
        with self._lock:
            self._items = self._merge_and_persist({staff.id: staff}, remove_ids=())
        return staff

    def delete(self, staff_id: str) -> None:
        with self._lock:
            self._items = self._merge_and_persist({}, remove_ids=(staff_id,))

    def _merge_and_persist(
        self, upserts: dict[str, Staff], remove_ids: tuple[str, ...]
    ) -> dict[str, Staff]:
        """Merge this change into the *current on-disk* state (not just this
        process's in-memory cache) under one lock acquisition, so a concurrent
        writer in another process/instance can't have its update silently
        overwritten (lost-update)."""

        def modify(current):
            raw_items = current if isinstance(current, list) else []
            merged = {str(d["id"]): d for d in raw_items if isinstance(d, dict) and "id" in d}
            for staff_id in remove_ids:
                merged.pop(staff_id, None)
            for staff_id, staff in upserts.items():
                merged[staff_id] = self._serialize_item(staff)
            return list(merged.values())

        new_raw = self._store.read_modify_write(modify)
        result: dict[str, Staff] = {}
        for item in new_raw:
            parsed = self._parse_item(item)
            if parsed is not None:
                result[parsed.id] = parsed
        return result
