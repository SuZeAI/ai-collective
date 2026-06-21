from __future__ import annotations

import threading
from datetime import datetime, timezone

from backend.domain.models import DEFAULT_OWNER_ID, LibraryDocument
from backend.infrastructure.repositories._helpers import parse_iso_utc
from backend.infrastructure.repositories.json_store import JsonFileStore


class JsonLibraryDocumentRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, LibraryDocument] = {}
        for item in data:
            try:
                doc = LibraryDocument(
                    id=str(item["id"]),
                    workspace_id=str(item.get("workspaceId", "")),
                    name=str(item.get("name", "")),
                    content_type=str(item.get("contentType", "") or ""),
                    size=int(item.get("size", 0) or 0),
                    rel_path=str(item.get("relPath", "")),
                    created_at=parse_iso_utc(str(item.get("createdAt", ""))) or datetime.now(timezone.utc),
                    description=str(item.get("description", "") or ""),
                    source=str(item.get("source", "upload") or "upload"),
                    source_url=str(item.get("sourceUrl", "") or ""),
                    tags=[str(t) for t in (item.get("tags") or [])],
                    uploaded_by=str(item.get("uploadedBy", "") or ""),
                    owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
                )
                self._items[doc.id] = doc
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write([
            {
                "id": d.id,
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
            for d in self._items.values()
        ])

    def list(self) -> list[LibraryDocument]:
        with self._lock:
            return list(self._items.values())

    def get(self, doc_id: str) -> LibraryDocument | None:
        with self._lock:
            return self._items.get(doc_id)

    def upsert(self, doc: LibraryDocument) -> LibraryDocument:
        with self._lock:
            self._items[doc.id] = doc
            self._persist()
        return doc

    def delete(self, doc_id: str) -> None:
        with self._lock:
            self._items.pop(doc_id, None)
            self._persist()
