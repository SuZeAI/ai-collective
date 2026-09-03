from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pymongo

from backend.domain.enums import SprintStatus
from backend.domain.models import DEFAULT_OWNER_ID, Sprint


def _parse_dt(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


class MongoSprintRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["sprints"]
        self._col.create_index("id", unique=True, background=True)

    def _doc_to_sprint(self, item: dict[str, Any]) -> Sprint:
        try:
            status = SprintStatus(str(item.get("status", "planned")))
        except ValueError:
            status = SprintStatus.planned
        return Sprint(
            id=str(item["id"]),
            project_id=str(item.get("projectId", "")),
            name=str(item.get("name", "")),
            goal=str(item.get("goal", "")),
            status=status,
            start_date=_parse_dt(item.get("startDate")),
            end_date=_parse_dt(item.get("endDate")),
            owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
        )

    def _sprint_to_doc(self, s: Sprint) -> dict[str, Any]:
        return {
            "id": s.id,
            "_id": s.id,
            "projectId": s.project_id,
            "name": s.name,
            "goal": s.goal,
            "status": s.status.value if hasattr(s.status, "value") else str(s.status),
            "startDate": s.start_date.isoformat() if s.start_date else None,
            "endDate": s.end_date.isoformat() if s.end_date else None,
            "owner_id": s.owner_id,
        }

    def list(self) -> list[Sprint]:
        return [self._doc_to_sprint(doc) for doc in self._col.find()]

    def get(self, sprint_id: str) -> Sprint | None:
        doc = self._col.find_one({"id": sprint_id})
        return self._doc_to_sprint(doc) if doc else None

    def upsert(self, sprint: Sprint) -> Sprint:
        self._col.replace_one({"id": sprint.id}, self._sprint_to_doc(sprint), upsert=True)
        return sprint

    def delete(self, sprint_id: str) -> None:
        self._col.delete_one({"id": sprint_id})
