from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    detail: str


class HealthResponse(BaseModel):
    status: str = "ok"


class MessageSchema(BaseModel):
    id: str
    agentId: str
    content: str
    timestamp: str
    taskId: str | None = None

    @staticmethod
    def from_domain(m) -> "MessageSchema":
        return MessageSchema(
            id=m.id,
            agentId=m.agent_id,
            content=m.content,
            timestamp=m.timestamp.isoformat(),
            taskId=m.task_id,
        )


class CreateMessageRequest(BaseModel):
    agentId: str
    content: str
    taskId: str | None = None


class SimulationPlanRequest(BaseModel):
    task_description: str = Field(min_length=1)


class SimulationStepSchema(BaseModel):
    agent: str
    msg: str
    delay_ms: int
    phase: int | None = None


class SimulationPlanResponse(BaseModel):
    steps: list[SimulationStepSchema]
