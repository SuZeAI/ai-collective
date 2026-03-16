from __future__ import annotations

from pydantic import BaseModel, Field


class TaskSchema(BaseModel):
    id: str
    title: str
    description: str
    teamId: str
    status: str
    progress: int
    assignedAgents: list[str]

    @staticmethod
    def from_domain(t) -> "TaskSchema":
        return TaskSchema(
            id=t.id,
            title=t.title,
            description=t.description,
            teamId=t.team_id,
            status=t.status.value if hasattr(t.status, "value") else str(t.status),
            progress=t.progress,
            assignedAgents=list(t.assigned_agents),
        )


class UpsertTaskRequest(BaseModel):
    id: str | None = None
    title: str
    description: str = ""
    teamId: str
    status: str = "pending"
    progress: int = 0
    assignedAgents: list[str] = Field(default_factory=list)
