from __future__ import annotations

from uuid import uuid4
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query

from backend.api.deps import get_conversation_service
from backend.api.schemas.common import CreateMessageRequest, MessageSchema
from backend.application.service.conversation_service import ConversationService
from backend.domain.models import Message


router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=list[MessageSchema])
def list_messages(
    task_id: str | None = Query(default=None),
    service: ConversationService = Depends(get_conversation_service),
) -> list[MessageSchema]:
    return [MessageSchema.from_domain(m) for m in service.list_messages(task_id=task_id)]


@router.post("", response_model=MessageSchema)
def add_message(req: CreateMessageRequest, service: ConversationService = Depends(get_conversation_service)) -> MessageSchema:
    message = Message(
        id=f"m_{uuid4().hex}",
        agent_id=req.agentId,
        content=req.content,
        timestamp=datetime.now(timezone.utc).replace(microsecond=0),
        task_id=req.taskId,
    )
    saved = service.add_message(message)
    return MessageSchema.from_domain(saved)
