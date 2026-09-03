from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pymongo

from backend.domain.models import DEFAULT_OWNER_ID, Project


def _parse_dt(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


class MongoProjectRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["projects"]
        self._col.create_index("id", unique=True, background=True)

    def _doc_to_project(self, item: dict[str, Any]) -> Project:
        return Project(
            id=str(item["id"]),
            key=str(item.get("key", "")).upper(),
            name=str(item.get("name", "")),
            description=str(item.get("description", "")),
            lead_id=str(item.get("leadId", "")),
            planner_staff_id=str(item.get("plannerAgentId", "")),
            planner_system_prompt=str(item.get("plannerSystemPrompt", "")),
            issue_counter=int(item.get("issueCounter", 0)),
            created_at=_parse_dt(item.get("createdAt")),
            avatar=str(item.get("avatar", "")),
            avatar_icon=str(item.get("avatar_icon", "")),
            avatar_color=str(item.get("avatar_color", "")),
            avatar_url=str(item.get("avatar_url", "")),
            owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
            company_id=str(item.get("companyId", "")),
        )

    def _project_to_doc(self, p: Project) -> dict[str, Any]:
        return {
            "id": p.id,
            "_id": p.id,
            "key": p.key,
            "name": p.name,
            "description": p.description,
            "leadId": p.lead_id,
            "plannerAgentId": p.planner_staff_id,
            "plannerSystemPrompt": p.planner_system_prompt,
            "issueCounter": p.issue_counter,
            "createdAt": p.created_at.isoformat() if p.created_at else None,
            "avatar": p.avatar,
            "avatar_icon": p.avatar_icon,
            "avatar_color": p.avatar_color,
            "avatar_url": p.avatar_url,
            "owner_id": p.owner_id,
            "companyId": p.company_id,
        }

    def list(self) -> list[Project]:
        return [self._doc_to_project(doc) for doc in self._col.find()]

    def get(self, project_id: str) -> Project | None:
        doc = self._col.find_one({"id": project_id})
        return self._doc_to_project(doc) if doc else None

    def upsert(self, project: Project) -> Project:
        # Preserve the server-side counter on replace: never let a stale
        # in-memory issue_counter overwrite a value advanced by a concurrent
        # allocate_issue_number call.
        existing = self._col.find_one({"id": project.id}, {"issueCounter": 1})
        doc = self._project_to_doc(project)
        if existing is not None:
            doc["issueCounter"] = int(existing.get("issueCounter", project.issue_counter))
        self._col.replace_one({"id": project.id}, doc, upsert=True)
        return project

    def delete(self, project_id: str) -> None:
        self._col.delete_one({"id": project_id})

    def allocate_issue_number(self, project_id: str) -> int:
        """Atomically increment and return the project's issue counter."""
        doc = self._col.find_one_and_update(
            {"id": project_id},
            {"$inc": {"issueCounter": 1}},
            return_document=pymongo.ReturnDocument.AFTER,
        )
        if doc is None:
            raise KeyError(project_id)
        return int(doc.get("issueCounter", 1))
