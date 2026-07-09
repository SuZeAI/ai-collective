from __future__ import annotations

import io
import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse

from backend.api.deps import current_owner_id_dep, current_user_dep, get_document_library_service
from backend.api.routers.meetings import _ALLOWED_UPLOAD_TYPES, _MAX_UPLOAD_BYTES
from backend.api.schemas.library_document import (
    AttachToProjectRequest,
    IngestUrlRequest,
    LibraryDocumentSchema,
)
from backend.application.service.document_library_service import DocumentLibraryService
from backend.domain.errors import NotFoundError
from backend.domain.models import User, can_delete, is_visible_to
from backend.log import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/library", tags=["library"])


def _parse_tags(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [t.strip() for t in raw.split(",") if t.strip()]


def _validate_workspace_id(workspace_id: str) -> None:
    """Reject workspace ids that could escape the library's storage root.

    workspace_id becomes the FileStore scope_id (a single path segment); it
    must not contain path separators or traversal sequences.
    """
    if not workspace_id or "/" in workspace_id or "\\" in workspace_id or workspace_id in (".", ".."):
        raise HTTPException(status_code=400, detail="Invalid workspaceId.")


@router.get("/documents", response_model=list[LibraryDocumentSchema])
def list_documents(
    company_id: str | None = Query(default=None),
    service: DocumentLibraryService = Depends(get_document_library_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> list[LibraryDocumentSchema]:
    return [
        LibraryDocumentSchema.from_domain(d)
        for d in service.list_documents()
        if is_visible_to(owner_id, d.owner_id)
        and (company_id is None or d.company_id == company_id)
    ]


@router.post("/documents", response_model=LibraryDocumentSchema, status_code=201)
async def upload_document(
    companyId: str = Form(...),
    file: UploadFile = File(...),
    description: str | None = Form(default=None),
    tags: str | None = Form(default=None),
    service: DocumentLibraryService = Depends(get_document_library_service),
    current_user: User = Depends(current_user_dep),
    owner_id: str = Depends(current_owner_id_dep),
) -> LibraryDocumentSchema:
    _validate_workspace_id(companyId)
    if file.content_type not in _ALLOWED_UPLOAD_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{file.content_type}'.")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file.")
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File too large. Max 25 MB.")
    raw_name = os.path.basename(file.filename or "").strip()
    if not raw_name or raw_name in {".", ".."} or "/" in raw_name or "\\" in raw_name:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    doc = service.create_document(
        company_id=companyId,
        filename=raw_name,
        content_type=file.content_type,
        data=content,
        owner_id=owner_id,
        uploaded_by=current_user.id,
        description=(description or "").strip(),
        source="upload",
        tags=_parse_tags(tags),
    )
    return LibraryDocumentSchema.from_domain(doc)


@router.post("/documents/ingest-url", response_model=LibraryDocumentSchema, status_code=201)
async def ingest_url(
    req: IngestUrlRequest,
    service: DocumentLibraryService = Depends(get_document_library_service),
    current_user: User = Depends(current_user_dep),
    owner_id: str = Depends(current_owner_id_dep),
) -> LibraryDocumentSchema:
    import asyncio
    import re

    from backend.domain.tools._ssrf import BlockedURLError
    from backend.domain.tools.document_tools import _strip_html
    from backend.domain.tools.http import HTTPError, request

    _validate_workspace_id(req.workspaceId)

    def _fetch() -> str:
        raw = request("GET", req.url, raw=True, retries=2)
        if "<" in raw[:2000] and ">" in raw[:2000]:
            return _strip_html(raw)
        return raw.strip()

    try:
        text = await asyncio.to_thread(_fetch)
    except BlockedURLError as exc:
        raise HTTPException(status_code=400, detail=f"Blocked URL: {exc}")
    except HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch URL: {exc}")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Failed to fetch URL: {exc}")

    if not text:
        raise HTTPException(status_code=422, detail="Fetched page had no readable text.")

    name = (req.name or "").strip()
    if not name:
        slug = re.sub(r"[^a-zA-Z0-9._-]", "_", req.url.split("//", 1)[-1])[:60].strip("_") or "page"
        name = f"{slug}.md"
    if not os.path.splitext(name)[1]:
        name += ".md"

    doc = service.create_document(
        company_id=req.companyId,
        filename=name,
        content_type="text/markdown",
        data=text.encode("utf-8"),
        owner_id=owner_id,
        uploaded_by=current_user.id,
        description=(req.description or "").strip(),
        source="url",
        source_url=req.url,
        tags=list(req.tags or []),
    )
    return LibraryDocumentSchema.from_domain(doc)


@router.get("/documents/{doc_id}/download")
def download_document(
    doc_id: str,
    service: DocumentLibraryService = Depends(get_document_library_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> StreamingResponse:
    doc = service.get_document(doc_id)
    if not is_visible_to(owner_id, doc.owner_id):
        raise NotFoundError(f"Document {doc_id!r} not found")
    data = service.read_bytes(doc)
    if data is None:
        raise NotFoundError(f"Document bytes for {doc_id!r} not found")
    return StreamingResponse(
        io.BytesIO(data),
        media_type=doc.content_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{doc.name}"'},
    )


@router.post("/documents/{doc_id}/attach")
def attach_to_project(
    doc_id: str,
    req: AttachToProjectRequest,
    service: DocumentLibraryService = Depends(get_document_library_service),
    current_user: User = Depends(current_user_dep),
    owner_id: str = Depends(current_owner_id_dep),
) -> dict:
    doc = service.get_document(doc_id)
    if not is_visible_to(owner_id, doc.owner_id):
        raise NotFoundError(f"Document {doc_id!r} not found")
    record = service.attach_to_project(doc, req.taskId, current_user.id)
    return {"attached": True, "file": record}


@router.delete("/documents/{doc_id}")
def delete_document(
    doc_id: str,
    service: DocumentLibraryService = Depends(get_document_library_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> dict:
    existing = service.try_get_document(doc_id)
    if existing is None:
        return {"deleted": True}
    if not is_visible_to(owner_id, existing.owner_id):
        raise NotFoundError(f"Document {doc_id!r} not found")
    if not can_delete(owner_id, existing.owner_id):
        raise HTTPException(status_code=403, detail="Only the owner can delete this document.")
    service.delete_document(existing)
    return {"deleted": True}
