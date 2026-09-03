from __future__ import annotations


from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    detail: str


class HealthResponse(BaseModel):
    status: str = "ok"


class MessageSchema(BaseModel):
    id: str
    staffId: str
    content: str
    timestamp: str
    taskId: str | None = None

    @staticmethod
    def from_domain(m) -> "MessageSchema":
        return MessageSchema(
            id=m.id,
            staffId=m.staff_id,
            content=m.content,
            timestamp=m.timestamp.isoformat(),
            taskId=m.task_id,
        )


class CreateMessageRequest(BaseModel):
    staffId: str
    content: str
    taskId: str | None = None


class MeetingFileSchema(BaseModel):
    id: str
    conversationId: str
    filename: str
    size: int
    contentType: str | None = None
    relPath: str
    uploadedBy: str = "user"
    producedByStaff: str | None = None
    createdAt: str

    @staticmethod
    def from_record(rec: dict) -> "MeetingFileSchema":
        return MeetingFileSchema(
            id=rec.get("id", ""),
            conversationId=rec.get("conversation_id", ""),
            filename=rec.get("filename", ""),
            size=rec.get("size", 0),
            contentType=rec.get("content_type"),
            relPath=rec.get("rel_path", ""),
            uploadedBy=rec.get("uploaded_by", "user"),
            producedByStaff=rec.get("produced_by_agent"),
            createdAt=rec.get("created_at", ""),
        )


class SimulationPlanRequest(BaseModel):
    task_description: str = Field(min_length=1)


class SimulationStepSchema(BaseModel):
    staff: str
    msg: str
    delay_ms: int
    phase: int | None = None


class SimulationPlanResponse(BaseModel):
    steps: list[SimulationStepSchema]
