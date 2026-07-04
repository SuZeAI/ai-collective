from __future__ import annotations

from typing import Any

import pymongo

from backend.domain.enums import StaffStatus
from backend.domain.models import DEFAULT_OWNER_ID, Staff
from backend.infrastructure.repositories._helpers import default_staff_system_prompt


def _doc_to_agent(item: dict[str, Any]) -> Staff:
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


def _agent_to_doc(a: Staff) -> dict[str, Any]:
    return {
        "id": a.id,
        "_id": a.id,
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


class MongoStaffRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["agents"]
        self._col.create_index("id", unique=True, background=True)

    def list(self) -> list[Staff]:
        return [_doc_to_agent(doc) for doc in self._col.find()]

    def get(self, staff_id: str) -> Staff | None:
        doc = self._col.find_one({"id": staff_id})
        return _doc_to_agent(doc) if doc else None

    def upsert(self, staff: Staff) -> Staff:
        self._col.replace_one({"id": staff.id}, _agent_to_doc(staff), upsert=True)
        return staff

    def delete(self, staff_id: str) -> None:
        self._col.delete_one({"id": staff_id})
