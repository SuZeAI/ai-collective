from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field


class TaskComment(BaseModel):
    id: str
    author_id: str = "default"
    content: str = ""
    created_at: str | None = None


class TaskSchema(BaseModel):
    id: str
    title: str
    description: str
    teamId: str
    status: str
    progress: int
    assignedAgents: list[str]
    startTime: str | None = None
    endTime: str | None = None
    owner_id: str = "default"
    priority: str = "medium"
    dueDate: str | None = None
    labels: list[str] = Field(default_factory=list)
    assigneeId: str | None = None
    comments: list[TaskComment] = Field(default_factory=list)
    projectId: str = ""
    issueType: str = "task"
    issueKey: str = ""          # read-only output; never accepted from the client
    epicId: str | None = None
    sprintId: str | None = None
    storyPoints: int | None = None

    @staticmethod
    def from_domain(t) -> "TaskSchema":
        def _to_utc_iso(value: datetime | None) -> str | None:
            if value is None:
                return None
            if value.tzinfo is None:
                value = value.replace(tzinfo=timezone.utc)
            else:
                value = value.astimezone(timezone.utc)
            return value.isoformat()

        priority = getattr(t, "priority", "medium")
        return TaskSchema(
            id=t.id,
            title=t.title,
            description=t.description,
            teamId=t.team_id,
            status=t.status.value if hasattr(t.status, "value") else str(t.status),
            progress=t.progress,
            assignedAgents=list(t.assigned_agents),
            startTime=_to_utc_iso(t.start_time),
            endTime=_to_utc_iso(t.end_time),
            owner_id=getattr(t, "owner_id", "default") or "default",
            priority=priority.value if hasattr(priority, "value") else str(priority),
            dueDate=_to_utc_iso(getattr(t, "due_date", None)),
            labels=list(getattr(t, "labels", []) or []),
            assigneeId=getattr(t, "assignee_id", None),
            comments=[TaskComment(**c) for c in (getattr(t, "comments", []) or [])],
            projectId=getattr(t, "project_id", "") or "",
            issueType=(
                it.value if hasattr(it := getattr(t, "issue_type", "task"), "value") else str(it)
            ),
            issueKey=getattr(t, "issue_key", "") or "",
            epicId=getattr(t, "epic_id", None),
            sprintId=getattr(t, "sprint_id", None),
            storyPoints=getattr(t, "story_points", None),
        )


class UpsertTaskRequest(BaseModel):
    id: str | None = None
    title: str
    description: str = ""
    teamId: str = ""
    status: str = "pending"
    progress: int = 0
    assignedAgents: list[str] = Field(default_factory=list)
    startTime: str | None = None
    endTime: str | None = None
    priority: str = "medium"
    dueDate: str | None = None
    labels: list[str] = Field(default_factory=list)
    assigneeId: str | None = None
    comments: list[TaskComment] = Field(default_factory=list)
    projectId: str = ""
    issueType: str = "task"
    epicId: str | None = None
    sprintId: str | None = None
    storyPoints: int | None = None
