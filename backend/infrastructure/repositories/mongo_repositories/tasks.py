from __future__ import annotations

from typing import Any

import pymongo

from backend.domain.enums import TaskPriority, TaskStatus
from backend.domain.models import DEFAULT_OWNER_ID, Task
from backend.infrastructure.repositories._helpers import parse_iso_utc


class MongoTaskRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["tasks"]
        self._col.create_index("id", unique=True, background=True)

    def _doc_to_task(self, item: dict[str, Any]) -> Task:
        try:
            priority = TaskPriority(str(item.get("priority", "medium")))
        except ValueError:
            priority = TaskPriority.medium
        return Task(
            id=str(item["id"]),
            title=str(item.get("title", "")),
            description=str(item.get("description", "")),
            team_id=str(item.get("teamId", "")),
            status=TaskStatus(str(item.get("status", "pending"))),
            progress=int(item.get("progress", 0)),
            assigned_agents=[str(x) for x in (item.get("assignedAgents") or [])],
            start_time=parse_iso_utc(str(item["startTime"])) if item.get("startTime") else None,
            end_time=parse_iso_utc(str(item["endTime"])) if item.get("endTime") else None,
            owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
            priority=priority,
            due_date=parse_iso_utc(str(item["dueDate"])) if item.get("dueDate") else None,
            labels=[str(x) for x in (item.get("labels") or [])],
            assignee_id=item.get("assigneeId") or None,
            comments=[dict(c) for c in (item.get("comments") or [])],
        )

    def _task_to_doc(self, t: Task) -> dict[str, Any]:
        return {
            "id": t.id,
            "_id": t.id,
            "title": t.title,
            "description": t.description,
            "teamId": t.team_id,
            "status": t.status.value,
            "progress": t.progress,
            "assignedAgents": list(t.assigned_agents),
            "startTime": t.start_time.isoformat() if t.start_time else None,
            "endTime": t.end_time.isoformat() if t.end_time else None,
            "owner_id": t.owner_id,
            "priority": t.priority.value if hasattr(t.priority, "value") else str(t.priority),
            "dueDate": t.due_date.isoformat() if t.due_date else None,
            "labels": list(t.labels),
            "assigneeId": t.assignee_id,
            "comments": [dict(c) for c in t.comments],
        }

    def list(self) -> list[Task]:
        return [self._doc_to_task(doc) for doc in self._col.find()]

    def get(self, task_id: str) -> Task | None:
        doc = self._col.find_one({"id": task_id})
        return self._doc_to_task(doc) if doc else None

    def upsert(self, task: Task) -> Task:
        self._col.replace_one({"id": task.id}, self._task_to_doc(task), upsert=True)
        return task

    def delete(self, task_id: str) -> None:
        self._col.delete_one({"id": task_id})
