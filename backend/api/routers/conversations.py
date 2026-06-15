from __future__ import annotations

import asyncio
import os
from uuid import uuid4
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from backend.api.deps import current_user_dep, get_conversation_service
from backend.api.schemas.common import (
    CreateMessageRequest,
    MessageSchema,
    ThreadFileSchema,
)
from backend.application.service.conversation_service import ConversationService
from backend.domain.models import Message, User
from backend.log import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/conversations", tags=["conversations"])

# Documents agents commonly need to work with. Executables are intentionally
# excluded — uploads land in a sandbox but should not be arbitrary binaries.
_ALLOWED_UPLOAD_TYPES = {
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/json",
    "application/pdf",
    "application/zip",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
}
_MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB


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


@router.get("/{task_id}/files", response_model=list[ThreadFileSchema])
def list_files(task_id: str) -> list[ThreadFileSchema]:
    """List files attached to a conversation (user uploads + agent outputs)."""
    from backend.infrastructure.sandbox.thread_files import list_thread_files

    return [ThreadFileSchema.from_record(r) for r in list_thread_files(task_id)]


@router.post("/{task_id}/files", response_model=ThreadFileSchema, status_code=201)
async def upload_file(
    task_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(current_user_dep),
) -> ThreadFileSchema:
    """Upload a document into a conversation's shared sandbox workspace.

    The file lands in ``{SANDBOX_WORKSPACE}/conv-<hash>/uploads/`` and is recorded
    so the orchestrator provisions the conversation sandbox and injects the
    sandbox tools for every agent in that chat. In docker/k8s mode the bytes are
    also pushed into the live sandbox and backed up to MinIO (best-effort).
    """
    if file.content_type not in _ALLOWED_UPLOAD_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{file.content_type}'.",
        )
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file.")
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File too large. Max 25 MB.")

    # Sanitize filename — strip any path components, reject traversal.
    raw_name = os.path.basename(file.filename or "").strip()
    if not raw_name or raw_name in {".", ".."} or "/" in raw_name or "\\" in raw_name:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    from backend.infrastructure.sandbox.sandbox_session import (
        ensure_conversation_workspace,
    )
    from backend.infrastructure.sandbox.thread_files import record_thread_file

    workspace = ensure_conversation_workspace(task_id)
    rel_path = f"uploads/{raw_name}"
    dest = os.path.join(workspace, rel_path)
    await asyncio.to_thread(_write_bytes, dest, content)

    record = record_thread_file(
        task_id,
        filename=raw_name,
        size=len(content),
        content_type=file.content_type,
        rel_path=rel_path,
        uploaded_by=current_user.id,
    )

    # Push into the live sandbox + back up to object storage (docker/k8s).
    # Best-effort: never fail the upload if these are unavailable.
    try:
        from backend.infrastructure.llm.sandbox_middleware import (
            push_upload_to_sandbox,
        )

        await asyncio.to_thread(push_upload_to_sandbox, task_id, rel_path, content)
    except Exception as exc:  # noqa: BLE001
        logger.warning("push_upload_to_sandbox failed for %s: %s", task_id, exc)

    return ThreadFileSchema.from_record(record)


def _write_bytes(path: str, content: bytes) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(content)
