from __future__ import annotations

from typing import Any

import pymongo

from backend.domain.enums import AgentStatus
from backend.domain.models import DEFAULT_OWNER_ID, Agent
from backend.infrastructure.repositories._helpers import default_agent_system_prompt


def _doc_to_agent(item: dict[str, Any]) -> Agent:
    return Agent(
        id=str(item["id"]),
        name=str(item.get("name", "")),
        role=str(item.get("role", "")),
        description=str(item.get("description", "")),
        skill_ids=[str(x) for x in (item.get("skillIds") or [])],
        status=AgentStatus(str(item.get("status", "idle"))),
        avatar=str(item.get("avatar", "A")),
        avatar_icon=str(item.get("avatar_icon", "") or ""),
        avatar_color=str(item.get("avatar_color", "") or ""),
        avatar_url=str(item.get("avatar_url", "") or ""),
        system_prompt=(
            str(item.get("system_prompt", "")).strip()
            or default_agent_system_prompt(
                name=str(item.get("name", "")),
                role=str(item.get("role", "")),
                description=str(item.get("description", "")),
            )
        ),
        subagent_enabled=bool(item.get("subagent_enabled", False)),
        owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
    )


def _agent_to_doc(a: Agent) -> dict[str, Any]:
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
        or default_agent_system_prompt(name=a.name, role=a.role, description=a.description),
        "subagent_enabled": a.subagent_enabled,
        "owner_id": a.owner_id,
    }


class MongoAgentRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["agents"]
        self._col.create_index("id", unique=True, background=True)

    def list(self) -> list[Agent]:
        return [_doc_to_agent(doc) for doc in self._col.find()]

    def get(self, agent_id: str) -> Agent | None:
        doc = self._col.find_one({"id": agent_id})
        return _doc_to_agent(doc) if doc else None

    def upsert(self, agent: Agent) -> Agent:
        self._col.replace_one({"id": agent.id}, _agent_to_doc(agent), upsert=True)
        return agent

    def delete(self, agent_id: str) -> None:
        self._col.delete_one({"id": agent_id})
