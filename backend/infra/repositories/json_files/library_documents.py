from __future__ import annotations

import threading
from datetime import datetime, timezone

from backend.domain.models import DEFAULT_OWNER_ID, LibraryDocument
from backend.infra.repositories._helpers import parse_iso_utc
from backend.infra.repositories.json_store import JsonFileStore


class JsonLibraryDocumentRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, LibraryDocument] = {}
        for item in data:
            parsed = self._parse_item(item)
            if parsed is not None:
                self._items[parsed.id] = parsed

    @staticmethod
    def _parse_item(item: dict) -> LibraryDocument | None:
        try:
            return LibraryDocument(
                id=str(item["id"]),
                company_id=str(item.get("workspaceId", "")),
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
        except Exception:
            return None

    @staticmethod
    def _serialize_item(d: LibraryDocument) -> dict:
        return {
            "id": d.id,
            "workspaceId": d.company_id,
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
        with self._lock:
            return list(self._items.values())

    def get(self, doc_id: str) -> LibraryDocument | None:
        with self._lock:
            return self._items.get(doc_id)

    def upsert(self, doc: LibraryDocument) -> LibraryDocument:
        with self._lock:
            self._items = self._merge_and_persist({doc.id: doc}, remove_ids=())
        return doc

    def delete(self, doc_id: str) -> None:
        with self._lock:
            self._items = self._merge_and_persist({}, remove_ids=(doc_id,))

    def _merge_and_persist(
        self, upserts: dict[str, LibraryDocument], remove_ids: tuple[str, ...]
    ) -> dict[str, LibraryDocument]:
        """Merge this change into the *current on-disk* state (not just this
        process's in-memory cache) under one lock acquisition, so a concurrent
        writer in another process/instance can't have its update silently
        overwritten (lost-update)."""

        def modify(current):
            raw_items = current if isinstance(current, list) else []
            merged = {str(d["id"]): d for d in raw_items if isinstance(d, dict) and "id" in d}
            for doc_id in remove_ids:
                merged.pop(doc_id, None)
            for doc_id, doc in upserts.items():
                merged[doc_id] = self._serialize_item(doc)
            return list(merged.values())

        new_raw = self._store.read_modify_write(modify)
        result: dict[str, LibraryDocument] = {}
        for item in new_raw:
            parsed = self._parse_item(item)
            if parsed is not None:
                result[parsed.id] = parsed
        return result
