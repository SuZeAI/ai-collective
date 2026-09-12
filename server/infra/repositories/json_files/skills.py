from __future__ import annotations

import threading

from server.domain.models import CATALOG_COMPANY_ID, DEFAULT_OWNER_ID, Skill
from server.infra.repositories.json_store import JsonFileStore


class JsonSkillRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Skill] = {}
        for item in data:
            parsed = self._parse_item(item)
            if parsed is not None:
                self._items[parsed.id] = parsed

    @staticmethod
    def _parse_item(item: dict) -> Skill | None:
        try:
            return Skill(
                id=str(item["id"]),
                name=str(item.get("name", "")),
                description=str(item.get("description", "")),
                third_party=str(item.get("third_party", "")),
                kind=str(item.get("kind", "integration")),
                config=dict(item.get("config") or {}),
                avatar=str(item.get("avatar", "") or str(item.get("name", "") or "S")[:1].upper()),
                avatar_icon=str(item.get("avatar_icon", "") or ""),
                avatar_color=str(item.get("avatar_color", "") or ""),
                avatar_url=str(item.get("avatar_url", "") or ""),
                tool_name=(str(item.get("tool_name")) if item.get("tool_name") is not None else None),
                code=(str(item.get("code")) if item.get("code") is not None else None),
                instruction=str(item.get("instruction", "") or ""),
                owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
                company_id=str(item.get("company_id") or CATALOG_COMPANY_ID),
            )
        except Exception:
            return None

    @staticmethod
    def _serialize_item(s: Skill) -> dict:
        return {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "third_party": s.third_party,
            "kind": s.kind,
            "avatar": s.avatar,
            "avatar_icon": s.avatar_icon,
            "avatar_color": s.avatar_color,
            "avatar_url": s.avatar_url,
            "tool_name": s.tool_name,
            "config": dict(s.config or {}),
            "code": s.code,
            "instruction": s.instruction,
            "owner_id": s.owner_id,
            "company_id": s.company_id,
        }

    def list(self) -> list[Skill]:
        with self._lock:
            return list(self._items.values())

    def get(self, skill_id: str) -> Skill | None:
        with self._lock:
            return self._items.get(skill_id)

    def upsert(self, skill: Skill) -> Skill:
        with self._lock:
            self._items = self._merge_and_persist({skill.id: skill}, remove_ids=())
        return skill

    def delete(self, skill_id: str) -> None:
        with self._lock:
            self._items = self._merge_and_persist({}, remove_ids=(skill_id,))

    def _merge_and_persist(
        self, upserts: dict[str, Skill], remove_ids: tuple[str, ...]
    ) -> dict[str, Skill]:
        """Merge this change into the *current on-disk* state (not just this
        process's in-memory cache) under one lock acquisition, so a concurrent
        writer in another process/instance can't have its update silently
        overwritten (lost-update)."""

        def modify(current):
            raw_items = current if isinstance(current, list) else []
            merged = {str(d["id"]): d for d in raw_items if isinstance(d, dict) and "id" in d}
            for skill_id in remove_ids:
                merged.pop(skill_id, None)
            for skill_id, skill in upserts.items():
                merged[skill_id] = self._serialize_item(skill)
            return list(merged.values())

        new_raw = self._store.read_modify_write(modify)
        result: dict[str, Skill] = {}
        for item in new_raw:
            parsed = self._parse_item(item)
            if parsed is not None:
                result[parsed.id] = parsed
        return result
