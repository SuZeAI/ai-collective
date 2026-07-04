from __future__ import annotations

import threading

from backend.domain.enums import IssueType, TaskPriority, TaskStatus
from backend.domain.models import DEFAULT_OWNER_ID, Task
from backend.infrastructure.repositories._helpers import parse_iso_utc
from backend.infrastructure.repositories.json_store import JsonFileStore


class JsonTaskRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Task] = {}
        for item in data:
            try:
                start_time_raw = item.get("startTime")
                end_time_raw = item.get("endTime")
                due_date_raw = item.get("dueDate")
                try:
                    priority = TaskPriority(str(item.get("priority", "medium")))
                except ValueError:
                    priority = TaskPriority.medium
                try:
                    issue_type = IssueType(str(item.get("issueType", "task")))
                except ValueError:
                    issue_type = IssueType.task
                story_points_raw = item.get("storyPoints")
                task = Task(
                    id=str(item["id"]),
                    title=str(item.get("title", "")),
                    description=str(item.get("description", "")),
                    department_id=str(item.get("teamId", "")),
                    status=TaskStatus(str(item.get("status", "pending"))),
                    progress=int(item.get("progress", 0)),
                    assigned_staff=[str(x) for x in (item.get("assignedAgents") or [])],
                    start_time=parse_iso_utc(str(start_time_raw)) if start_time_raw else None,
                    end_time=parse_iso_utc(str(end_time_raw)) if end_time_raw else None,
                    owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
                    priority=priority,
                    due_date=parse_iso_utc(str(due_date_raw)) if due_date_raw else None,
                    labels=[str(x) for x in (item.get("labels") or [])],
                    assignee_id=item.get("assigneeId") or None,
                    comments=[dict(c) for c in (item.get("comments") or [])],
                    project_id=str(item.get("projectId") or ""),
                    issue_type=issue_type,
                    issue_key=str(item.get("issueKey") or ""),
                    epic_id=item.get("epicId") or None,
                    sprint_id=item.get("sprintId") or None,
                    story_points=int(story_points_raw) if story_points_raw is not None else None,
                )
                self._items[task.id] = task
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write(
            [
                {
                    "id": t.id,
                    "title": t.title,
                    "description": t.description,
                    "teamId": t.department_id,
                    "status": t.status.value,
                    "progress": t.progress,
                    "assignedAgents": list(t.assigned_staff),
                    "startTime": t.start_time.isoformat() if t.start_time else None,
                    "endTime": t.end_time.isoformat() if t.end_time else None,
                    "owner_id": t.owner_id,
                    "priority": t.priority.value if hasattr(t.priority, "value") else str(t.priority),
                    "dueDate": t.due_date.isoformat() if t.due_date else None,
                    "labels": list(t.labels),
                    "assigneeId": t.assignee_id,
                    "comments": [dict(c) for c in t.comments],
                    "projectId": t.project_id,
                    "issueType": t.issue_type.value if hasattr(t.issue_type, "value") else str(t.issue_type),
                    "issueKey": t.issue_key,
                    "epicId": t.epic_id,
                    "sprintId": t.sprint_id,
                    "storyPoints": t.story_points,
                }
                for t in self._items.values()
            ]
        )

    def list(self) -> list[Task]:
        with self._lock:
            return list(self._items.values())

    def get(self, task_id: str) -> Task | None:
        with self._lock:
            return self._items.get(task_id)

    def upsert(self, task: Task) -> Task:
        with self._lock:
            self._items[task.id] = task
            self._persist()
        return task

    def delete(self, task_id: str) -> None:
        with self._lock:
            self._items.pop(task_id, None)
            self._persist()
