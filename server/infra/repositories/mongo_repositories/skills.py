from __future__ import annotations

from typing import Any

import pymongo

from server.domain.models import DEFAULT_OWNER_ID, Skill


class MongoSkillRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["skills"]
        self._col.create_index("id", unique=True, background=True)

    def _doc_to_skill(self, item: dict[str, Any]) -> Skill:
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
        )

    def _skill_to_doc(self, s: Skill) -> dict[str, Any]:
        return {
            "id": s.id,
            "_id": s.id,
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

    def list(self) -> list[Skill]:
        return [self._doc_to_skill(doc) for doc in self._col.find()]

    def get(self, skill_id: str) -> Skill | None:
        doc = self._col.find_one({"id": skill_id})
        return self._doc_to_skill(doc) if doc else None

    def upsert(self, skill: Skill) -> Skill:
        self._col.replace_one({"id": skill.id}, self._skill_to_doc(skill), upsert=True)
        return skill

    def delete(self, skill_id: str) -> None:
        self._col.delete_one({"id": skill_id})
