from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pymongo

from backend.domain.models import DEFAULT_OWNER_ID, LibraryDocument


class MongoLibraryDocumentRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["library_documents"]
        self._col.create_index("id", unique=True, background=True)
        self._col.create_index("workspaceId", background=True)

    def _doc_to_model(self, item: dict[str, Any]) -> LibraryDocument:
        created_raw = item.get("createdAt")
        if isinstance(created_raw, datetime):
            created_at = created_raw if created_raw.tzinfo else created_raw.replace(tzinfo=timezone.utc)
        else:
            try:
                created_at = datetime.fromisoformat(str(created_raw).replace("Z", "+00:00"))
            except Exception:
                created_at = datetime.now(timezone.utc)
        return LibraryDocument(
            id=str(item["id"]),
            workspace_id=str(item.get("workspaceId", "")),
            name=str(item.get("name", "")),
            content_type=str(item.get("contentType", "") or ""),
            size=int(item.get("size", 0) or 0),
            rel_path=str(item.get("relPath", "")),
            created_at=created_at,
            description=str(item.get("description", "") or ""),
            source=str(item.get("source", "upload") or "upload"),
            source_url=str(item.get("sourceUrl", "") or ""),
            tags=[str(t) for t in (item.get("tags") or [])],
            uploaded_by=str(item.get("uploadedBy", "") or ""),
            owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
        )

    def _model_to_doc(self, d: LibraryDocument) -> dict[str, Any]:
        return {
            "id": d.id,
            "_id": d.id,
            "workspaceId": d.workspace_id,
            "name": d.name,
            "contentType": d.content_type,
            "size": d.size,
            "relPath": d.rel_path,
            "createdAt": d.created_at.isoformat(),
            "description": d.description,
            "source": d.source,
            "sourceUrl": d.source_url,
            "tags": list(d.tags),
            "uploadedBy": d.uploaded_by,
            "owner_id": d.owner_id,
        }

    def list(self) -> list[LibraryDocument]:
        return [self._doc_to_model(doc) for doc in self._col.find()]

    def get(self, doc_id: str) -> LibraryDocument | None:
        doc = self._col.find_one({"id": doc_id})
        return self._doc_to_model(doc) if doc else None

    def upsert(self, doc: LibraryDocument) -> LibraryDocument:
        self._col.replace_one({"id": doc.id}, self._model_to_doc(doc), upsert=True)
        return doc

    def delete(self, doc_id: str) -> None:
        self._col.delete_one({"id": doc_id})
