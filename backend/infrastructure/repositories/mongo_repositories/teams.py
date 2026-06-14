from __future__ import annotations

from typing import Any

import pymongo

from backend.domain.models import DEFAULT_OWNER_ID, Team


class MongoTeamRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["teams"]
        self._col.create_index("id", unique=True, background=True)

    def _doc_to_team(self, item: dict[str, Any]) -> Team:
        return Team(
            id=str(item["id"]),
            name=str(item.get("name", "")),
            description=str(item.get("description", "")),
            agents=[str(x) for x in (item.get("agents") or [])],
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

    def _team_to_doc(self, t: Team) -> dict[str, Any]:
        return {
            "id": t.id,
            "_id": t.id,
            "name": t.name,
            "description": t.description,
            "agents": list(t.agents),
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

    def list(self) -> list[Team]:
        return [self._doc_to_team(doc) for doc in self._col.find()]

    def get(self, team_id: str) -> Team | None:
        doc = self._col.find_one({"id": team_id})
        return self._doc_to_team(doc) if doc else None

    def upsert(self, team: Team) -> Team:
        self._col.replace_one({"id": team.id}, self._team_to_doc(team), upsert=True)
        return team

    def delete(self, team_id: str) -> None:
        self._col.delete_one({"id": team_id})
