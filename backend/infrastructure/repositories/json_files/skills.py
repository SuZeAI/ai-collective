from __future__ import annotations

import threading

from backend.domain.models import DEFAULT_OWNER_ID, Skill
from backend.infrastructure.repositories.json_store import JsonFileStore


class JsonSkillRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Skill] = {}
        for item in data:
            try:
                s = Skill(
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
                )
                self._items[s.id] = s
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write(
            [
                {
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
                }
                for s in self._items.values()
            ]
        )

    def list(self) -> list[Skill]:
        with self._lock:
            return list(self._items.values())

    def get(self, skill_id: str) -> Skill | None:
        with self._lock:
            return self._items.get(skill_id)

    def upsert(self, skill: Skill) -> Skill:
        with self._lock:
            self._items[skill.id] = skill
            self._persist()
        return skill

    def delete(self, skill_id: str) -> None:
        with self._lock:
            self._items.pop(skill_id, None)
            self._persist()
