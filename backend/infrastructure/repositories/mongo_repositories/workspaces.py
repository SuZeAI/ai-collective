from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pymongo

from backend.domain.models import DEFAULT_OWNER_ID, PlatformHook, Workspace


class MongoWorkspaceRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["workspaces"]
        self._col.create_index("id", unique=True, background=True)

    def _doc_to_workspace(self, item: dict[str, Any]) -> Workspace:
        hooks = [
            PlatformHook(
                id=str(h["id"]),
                platform=str(h.get("platform", "")),
                name=str(h.get("name", "")),
                config=dict(h.get("config") or {}),
                description=str(h.get("description", "")),
                enabled=bool(h.get("enabled", True)),
            )
            for h in (item.get("platformHooks") or [])
        ]
        created_raw = item.get("createdAt")
        if isinstance(created_raw, datetime):
            created_at = created_raw if created_raw.tzinfo else created_raw.replace(tzinfo=timezone.utc)
        else:
            try:
                created_at = datetime.fromisoformat(str(created_raw).replace("Z", "+00:00"))
            except Exception:
                created_at = datetime.now(timezone.utc)
        return Workspace(
            id=str(item["id"]),
            name=str(item.get("name", "")),
            description=str(item.get("description", "")),
            team_ids=[str(x) for x in (item.get("teamIds") or [])],
            platform_hooks=hooks,
            created_at=created_at,
            avatar=str(item.get("avatar", "") or str(item.get("name", "") or "W")[:1].upper()),
            avatar_icon=str(item.get("avatar_icon", "") or ""),
            avatar_color=str(item.get("avatar_color", "") or ""),
            avatar_url=str(item.get("avatar_url", "") or ""),
            primary_team_id=str(item.get("primaryTeamId", "")),
            owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
        )

    def _workspace_to_doc(self, w: Workspace) -> dict[str, Any]:
        return {
            "id": w.id,
            "_id": w.id,
            "name": w.name,
            "description": w.description,
            "teamIds": list(w.team_ids),
            "primaryTeamId": w.primary_team_id,
            "platformHooks": [
                {
                    "id": h.id,
                    "platform": h.platform,
                    "name": h.name,
                    "config": dict(h.config),
                    "description": h.description,
                    "enabled": h.enabled,
                }
                for h in w.platform_hooks
            ],
            "createdAt": w.created_at.isoformat(),
            "avatar": w.avatar,
            "avatar_icon": w.avatar_icon,
            "avatar_color": w.avatar_color,
            "avatar_url": w.avatar_url,
            "owner_id": w.owner_id,
        }

    def list(self) -> list[Workspace]:
        return [self._doc_to_workspace(doc) for doc in self._col.find()]

    def get(self, workspace_id: str) -> Workspace | None:
        doc = self._col.find_one({"id": workspace_id})
        return self._doc_to_workspace(doc) if doc else None

    def upsert(self, workspace: Workspace) -> Workspace:
        self._col.replace_one({"id": workspace.id}, self._workspace_to_doc(workspace), upsert=True)
        return workspace

    def delete(self, workspace_id: str) -> None:
        self._col.delete_one({"id": workspace_id})
