from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field


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
        )


class UpsertTaskRequest(BaseModel):
    id: str | None = None
    title: str
    description: str = ""
    teamId: str
    status: str = "pending"
    progress: int = 0
    assignedAgents: list[str] = Field(default_factory=list)
    startTime: str | None = None
    endTime: str | None = None
