from __future__ import annotations

from pydantic import BaseModel

from server.domain.models import DEFAULT_OWNER_ID, LibraryDocument


class LibraryDocumentSchema(BaseModel):
    id: str
    companyId: str
    name: str
    contentType: str
    size: int
    relPath: str
    createdAt: str
    description: str = ""
    source: str = "upload"
    sourceUrl: str = ""
    tags: list[str] = []
    uploadedBy: str = ""
    owner_id: str = DEFAULT_OWNER_ID

    @staticmethod
    def from_domain(d: LibraryDocument) -> "LibraryDocumentSchema":
        return LibraryDocumentSchema(
            id=d.id,
            companyId=d.company_id,
            name=d.name,
            contentType=d.content_type,
            size=d.size,
            relPath=d.rel_path,
            createdAt=d.created_at.isoformat(),
            description=d.description,
            source=d.source,
            sourceUrl=d.source_url,
            tags=list(d.tags),
            uploadedBy=d.uploaded_by,
            owner_id=getattr(d, "owner_id", DEFAULT_OWNER_ID) or DEFAULT_OWNER_ID,
        )


class IngestUrlRequest(BaseModel):
    companyId: str
    url: str
    name: str | None = None
    description: str | None = None
    tags: list[str] | None = None


class AttachToProjectRequest(BaseModel):
    taskId: str
