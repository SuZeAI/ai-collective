from __future__ import annotations

import asyncio
import os
from uuid import uuid4
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from backend.api.deps import (
    current_owner_id_dep,
    current_user_dep,
    get_meeting_service,
    get_task_service,
)
from backend.api.schemas.common import (
    CreateMessageRequest,
    MessageSchema,
    MeetingFileSchema,
)
from backend.app.service.meeting_service import MeetingService
from backend.app.service.task_service import TaskService
from backend.domain.errors import NotFoundError
from backend.domain.models import Message, User, is_owned_by, is_visible_to
from backend.log import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/meetings", tags=["conversations"])

# Documents staff commonly need to work with. Executables are intentionally
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


def _require_task_access(task_service: TaskService, task_id: str, owner_id: str) -> None:
    """Raise 404 unless task_id exists and is visible to owner_id.

    Without this, any caller who knows/enumerates a task_id could read or
    inject messages and download files for tasks they don't own.
    """
    try:
        task = task_service.get_task(task_id)
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")
    if not is_visible_to(owner_id, task.owner_id):
        raise HTTPException(status_code=404, detail="Task not found")


@router.get("", response_model=list[MessageSchema])
def list_messages(
    task_id: str | None = Query(default=None),
    service: MeetingService = Depends(get_meeting_service),
    task_service: TaskService = Depends(get_task_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> list[MessageSchema]:
    if task_id is not None:
        _require_task_access(task_service, task_id, owner_id)
        messages = service.list_messages(task_id=task_id)
    else:
        # No task_id: scope to tasks this owner can see rather than returning
        # every message across every owner's conversations.
        visible_task_ids = {t.id for t in task_service.list_tasks() if is_owned_by(owner_id, t.owner_id)}
        messages = [m for m in service.list_messages(task_id=None) if m.task_id in visible_task_ids]
    return [MessageSchema.from_domain(m) for m in messages]


@router.post("", response_model=MessageSchema)
def add_message(
    req: CreateMessageRequest,
    service: MeetingService = Depends(get_meeting_service),
    task_service: TaskService = Depends(get_task_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> MessageSchema:
    if req.taskId:
        _require_task_access(task_service, req.taskId, owner_id)
    message = Message(
        id=f"m_{uuid4().hex}",
        staff_id=req.staffId,
        content=req.content,
        timestamp=datetime.now(timezone.utc).replace(microsecond=0),
        task_id=req.taskId,
    )
    saved = service.add_message(message)
    return MessageSchema.from_domain(saved)


@router.get("/{task_id}/files", response_model=list[MeetingFileSchema])
def list_files(
    task_id: str,
    task_service: TaskService = Depends(get_task_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> list[MeetingFileSchema]:
    """List files attached to a conversation (user uploads + staff outputs)."""
    from backend.infrastructure.sandbox.thread_files import list_thread_files

    _require_task_access(task_service, task_id, owner_id)
    return [MeetingFileSchema.from_record(r) for r in list_thread_files(task_id)]


@router.get("/{task_id}/files/download")
def download_file(
    task_id: str,
    rel_path: str = Query(...),
    task_service: TaskService = Depends(get_task_service),
    owner_id: str = Depends(current_owner_id_dep),
):
    """Download a file attached to a conversation by its rel_path.

    Reads via the FileStore (host dir in local mode, MinIO in s3 mode). The
    rel_path is confined to the conversation's ``uploads/`` directory.
    """
    import io
    from fastapi.responses import StreamingResponse

    from backend.infrastructure.sandbox.sandbox_session import conversation_thread_id
    from backend.infrastructure.sandbox.thread_files import list_thread_files
    from backend.infrastructure.storage.file_store import get_file_store

    _require_task_access(task_service, task_id, owner_id)

    norm = os.path.normpath(rel_path)
    if norm.startswith("..") or os.path.isabs(norm) or not norm.startswith("uploads" + os.sep):
        raise HTTPException(status_code=400, detail="Invalid rel_path.")

    record = next((r for r in list_thread_files(task_id) if r.get("rel_path") == rel_path), None)
    thread_id = conversation_thread_id(task_id)
    data = get_file_store("sandbox").get(thread_id, rel_path)
    if data is None:
        raise HTTPException(status_code=404, detail="File not found.")
    filename = (record or {}).get("filename") or os.path.basename(rel_path)
    content_type = (record or {}).get("content_type") or "application/octet-stream"
    return StreamingResponse(
        io.BytesIO(data),
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{task_id}/files", response_model=MeetingFileSchema, status_code=201)
async def upload_file(
    task_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(current_user_dep),
    task_service: TaskService = Depends(get_task_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> MeetingFileSchema:
    """Upload a document into a conversation's shared sandbox workspace.

    The file lands in ``{SANDBOX_WORKSPACE}/conv-<hash>/uploads/`` and is recorded
    so the orchestrator provisions the conversation sandbox and injects the
    sandbox tools for every staff in that chat. In k8s mode the bytes are also
    pushed into the live sandbox and backed up to MinIO (best-effort).
    """
    _require_task_access(task_service, task_id, owner_id)
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

    # Push into the live sandbox + back up to object storage (k8s mode).
    # Best-effort: never fail the upload if these are unavailable.
    try:
        from backend.infrastructure.llm.sandbox_middleware import (
            push_upload_to_sandbox,
        )

        await asyncio.to_thread(push_upload_to_sandbox, task_id, rel_path, content)
    except Exception as exc:  # noqa: BLE001
        logger.warning("push_upload_to_sandbox failed for %s: %s", task_id, exc)

    return MeetingFileSchema.from_record(record)


def _write_bytes(path: str, content: bytes) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(content)
