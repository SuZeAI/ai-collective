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


class ThreadFileSchema(BaseModel):
    id: str
    conversationId: str
    filename: str
    size: int
    contentType: str | None = None
    relPath: str
    uploadedBy: str = "user"
    producedByAgent: str | None = None
    createdAt: str

    @staticmethod
    def from_record(rec: dict) -> "ThreadFileSchema":
        return ThreadFileSchema(
            id=rec.get("id", ""),
            conversationId=rec.get("conversation_id", ""),
            filename=rec.get("filename", ""),
            size=rec.get("size", 0),
            contentType=rec.get("content_type"),
            relPath=rec.get("rel_path", ""),
            uploadedBy=rec.get("uploaded_by", "user"),
            producedByAgent=rec.get("produced_by_agent"),
            createdAt=rec.get("created_at", ""),
        )


class SimulationPlanRequest(BaseModel):
    task_description: str = Field(min_length=1)


class SimulationStepSchema(BaseModel):
    agent: str
    msg: str
    delay_ms: int
    phase: int | None = None


class SimulationPlanResponse(BaseModel):
    steps: list[SimulationStepSchema]
