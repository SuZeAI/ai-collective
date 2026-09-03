from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pymongo

from backend.domain.models import DEFAULT_OWNER_ID, Company


class MongoCompanyRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["companies"]
        self._col.create_index("id", unique=True, background=True)

    def _doc_to_workspace(self, item: dict[str, Any]) -> Company:
        created_raw = item.get("createdAt")
        if isinstance(created_raw, datetime):
            created_at = created_raw if created_raw.tzinfo else created_raw.replace(tzinfo=timezone.utc)
        else:
            try:
                created_at = datetime.fromisoformat(str(created_raw).replace("Z", "+00:00"))
            except Exception:
                created_at = datetime.now(timezone.utc)
        return Company(
            id=str(item["id"]),
            name=str(item.get("name", "")),
            description=str(item.get("description", "")),
            department_ids=[str(x) for x in (item.get("teamIds") or [])],
            created_at=created_at,
            avatar=str(item.get("avatar", "") or str(item.get("name", "") or "W")[:1].upper()),
            avatar_icon=str(item.get("avatar_icon", "") or ""),
            avatar_color=str(item.get("avatar_color", "") or ""),
            avatar_url=str(item.get("avatar_url", "") or ""),
            primary_department_id=str(item.get("primaryTeamId", "")),
            type=str(item.get("type", "") or "general"),
            owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
        )

    def _workspace_to_doc(self, w: Company) -> dict[str, Any]:
        return {
            "id": w.id,
            "_id": w.id,
            "name": w.name,
            "description": w.description,
            "teamIds": list(w.department_ids),
            "primaryTeamId": w.primary_department_id,
            "createdAt": w.created_at.isoformat(),
            "type": w.type,
            "avatar": w.avatar,
            "avatar_icon": w.avatar_icon,
            "avatar_color": w.avatar_color,
            "avatar_url": w.avatar_url,
            "owner_id": w.owner_id,
        }

    def list(self) -> list[Company]:
        return [self._doc_to_workspace(doc) for doc in self._col.find()]

    def get(self, company_id: str) -> Company | None:
        doc = self._col.find_one({"id": company_id})
        return self._doc_to_workspace(doc) if doc else None

    def upsert(self, workspace: Company) -> Company:
        self._col.replace_one({"id": workspace.id}, self._workspace_to_doc(workspace), upsert=True)
        return workspace

    def delete(self, company_id: str) -> None:
        self._col.delete_one({"id": company_id})
