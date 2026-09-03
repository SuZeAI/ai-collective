from __future__ import annotations

import os
from datetime import datetime, timezone
from uuid import uuid4

from backend.domain.errors import NotFoundError
from backend.domain.models import DEFAULT_OWNER_ID, LibraryDocument
from backend.log import get_logger

logger = get_logger(__name__)

_LIBRARY_NAMESPACE = "library"


def _safe_name(name: str) -> str:
    base = os.path.basename((name or "").strip())
    base = base.replace("\\", "_").replace("/", "_")
    return base or "document"


class DocumentLibraryService:
    """CRUD + byte handling for the per-Business-Unit document library.

    Metadata lives in the repository; bytes go through the FileStore ``library``
    namespace (scope = workspace id) so the local⇄s3 switch is shared with chat files.
    Ownership filtering is enforced in the router (mirrors CompanyService).
    """

    def __init__(self, repo) -> None:
        self._repo = repo

    @property
    def _store(self):
        from backend.infrastructure.storage.file_store import get_file_store

        return get_file_store(_LIBRARY_NAMESPACE)

    # ── reads ───────────────────────────────────────────────────────────────────

    def list_documents(self) -> list[LibraryDocument]:
        return self._repo.list()

    def try_get_document(self, doc_id: str) -> LibraryDocument | None:
        return self._repo.get(doc_id)

    def get_document(self, doc_id: str) -> LibraryDocument:
        doc = self.try_get_document(doc_id)
        if doc is None:
            raise NotFoundError(f"Document {doc_id!r} not found")
        return doc

    def read_bytes(self, doc: LibraryDocument) -> bytes | None:
        return self._store.get(doc.company_id, doc.rel_path)

    # ── writes ───────────────────────────────────────────────────────────────────

    def create_document(
        self,
        *,
        company_id: str,
        filename: str,
        content_type: str,
        data: bytes,
        owner_id: str,
        uploaded_by: str,
        description: str = "",
        source: str = "upload",
        source_url: str = "",
        tags: list[str] | None = None,
    ) -> LibraryDocument:
        doc_id = f"doc_{uuid4().hex}"
        name = _safe_name(filename)
        rel_path = f"{doc_id}/{name}"
        self._store.put(company_id, rel_path, data)
        doc = LibraryDocument(
            id=doc_id,
            company_id=company_id,
            name=name,
            content_type=content_type or "application/octet-stream",
            size=len(data),
            rel_path=rel_path,
            created_at=datetime.now(timezone.utc),
            description=description or "",
            source=source,
            source_url=source_url or "",
            tags=list(tags or []),
            uploaded_by=uploaded_by or "",
            owner_id=owner_id or DEFAULT_OWNER_ID,
        )
        return self._repo.upsert(doc)

    def delete_document(self, doc: LibraryDocument) -> None:
        try:
            self._store.delete(doc.company_id, doc.rel_path)
        except Exception as exc:  # noqa: BLE001
            logger.warning("library byte delete failed for %s: %s", doc.id, exc)
        self._repo.delete(doc.id)

    def attach_to_project(self, doc: LibraryDocument, task_id: str, uploaded_by: str) -> dict:
        """Copy a library document into a Project's conversation workspace.

        The bytes land in ``uploads/`` and are recorded so the orchestrator
        provisions the sandbox + document tools for that chat (same path as a
        direct upload). Returns the thread-file record.
        """
        data = self.read_bytes(doc)
        if data is None:
            raise NotFoundError(f"Document bytes for {doc.id!r} not found")

        from backend.infrastructure.sandbox.sandbox_session import ensure_conversation_workspace
        from backend.infrastructure.sandbox.thread_files import record_thread_file

        workspace = ensure_conversation_workspace(task_id)
        rel_path = f"uploads/{doc.name}"
        dest = os.path.join(workspace, rel_path)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "wb") as fh:
            fh.write(data)

        record = record_thread_file(
            task_id,
            filename=doc.name,
            size=len(data),
            content_type=doc.content_type,
            rel_path=rel_path,
            uploaded_by=uploaded_by or doc.uploaded_by or "user",
        )
        try:
            from backend.infrastructure.llm.sandbox_middleware import push_upload_to_sandbox

            push_upload_to_sandbox(task_id, rel_path, data)
        except Exception as exc:  # noqa: BLE001
            logger.warning("attach_to_project push failed for %s: %s", task_id, exc)
        return record
