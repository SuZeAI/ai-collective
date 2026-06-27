from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pymongo

from backend.domain.enums import TaskStatus
from backend.domain.models import DEFAULT_OWNER_ID, Epic


def _parse_dt(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


class MongoEpicRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["epics"]
        self._col.create_index("id", unique=True, background=True)

    def _doc_to_epic(self, item: dict[str, Any]) -> Epic:
        try:
            status = TaskStatus(str(item.get("status", "pending")))
        except ValueError:
            status = TaskStatus.pending
        return Epic(
            id=str(item["id"]),
            project_id=str(item.get("projectId", "")),
            key=str(item.get("key", "")),
            title=str(item.get("title", "")),
            description=str(item.get("description", "")),
            status=status,
            color=str(item.get("color", "")),
            start_date=_parse_dt(item.get("startDate")),
            due_date=_parse_dt(item.get("dueDate")),
            owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
        )

    def _epic_to_doc(self, e: Epic) -> dict[str, Any]:
        return {
            "id": e.id,
            "_id": e.id,
            "projectId": e.project_id,
            "key": e.key,
            "title": e.title,
            "description": e.description,
            "status": e.status.value if hasattr(e.status, "value") else str(e.status),
            "color": e.color,
            "startDate": e.start_date.isoformat() if e.start_date else None,
            "dueDate": e.due_date.isoformat() if e.due_date else None,
            "owner_id": e.owner_id,
        }

    def list(self) -> list[Epic]:
        return [self._doc_to_epic(doc) for doc in self._col.find()]

    def get(self, epic_id: str) -> Epic | None:
        doc = self._col.find_one({"id": epic_id})
        return self._doc_to_epic(doc) if doc else None

    def upsert(self, epic: Epic) -> Epic:
        self._col.replace_one({"id": epic.id}, self._epic_to_doc(epic), upsert=True)
        return epic

    def delete(self, epic_id: str) -> None:
        self._col.delete_one({"id": epic_id})
