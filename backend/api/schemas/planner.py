from __future__ import annotations

from pydantic import BaseModel, Field


class DraftIssue(BaseModel):
    title: str
    type: str = "task"          # story | task | bug | subtask
    description: str = ""
    storyPoints: int | None = None
    epicHint: str = ""


class PlannerDecomposeRequest(BaseModel):
    projectId: str
    epicId: str | None = None
    description: str
    count: int = 8


class PlannerDecomposeResponse(BaseModel):
    issues: list[DraftIssue] = Field(default_factory=list)


class PlannerCommitRequest(BaseModel):
    projectId: str
    epicId: str | None = None
    sprintId: str | None = None
    departmentId: str = ""
    issues: list[DraftIssue] = Field(default_factory=list)
