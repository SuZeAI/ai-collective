from __future__ import annotations

import threading
from datetime import datetime, timezone

from backend.domain.models import DEFAULT_OWNER_ID, OfficeBuilderSession
from backend.infra.repositories._helpers import parse_iso_utc
from backend.infra.repositories.json_store import JsonFileStore


class JsonOfficeBuilderSessionRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, OfficeBuilderSession] = {}
        for item in data:
            parsed = self._parse_item(item)
            if parsed is not None:
                self._items[parsed.id] = parsed

    @staticmethod
    def _parse_item(item: dict) -> OfficeBuilderSession | None:
        try:
            now = datetime.now(timezone.utc)
            return OfficeBuilderSession(
                id=str(item["id"]),
                title=str(item.get("title", "")),
                messages=[dict(m) for m in (item.get("messages") or [])],
                plan=dict(item["plan"]) if isinstance(item.get("plan"), dict) else None,
                created_at=parse_iso_utc(str(item.get("createdAt", ""))) or now,
                updated_at=parse_iso_utc(str(item.get("updatedAt", ""))) or now,
                company_id=str(item.get("workspaceId", "") or ""),
                owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
            )
        except Exception:
            return None

    @staticmethod
    def _serialize_item(s: OfficeBuilderSession) -> dict:
        return {
            "id": s.id,
            "title": s.title,
            "messages": list(s.messages),
            "plan": s.plan,
            "createdAt": s.created_at.isoformat(),
            "updatedAt": s.updated_at.isoformat(),
            "workspaceId": s.company_id,
            "owner_id": s.owner_id,
        }

    def list(self) -> list[OfficeBuilderSession]:
        with self._lock:
            return list(self._items.values())

    def get(self, session_id: str) -> OfficeBuilderSession | None:
        with self._lock:
            return self._items.get(session_id)

    def upsert(self, session: OfficeBuilderSession) -> OfficeBuilderSession:
        with self._lock:
            self._items = self._merge_and_persist({session.id: session}, remove_ids=())
        return session

    def delete(self, session_id: str) -> None:
        with self._lock:
            self._items = self._merge_and_persist({}, remove_ids=(session_id,))

    def _merge_and_persist(
        self, upserts: dict[str, OfficeBuilderSession], remove_ids: tuple[str, ...]
    ) -> dict[str, OfficeBuilderSession]:
        """Merge this change into the *current on-disk* state (not just this
        process's in-memory cache) under one lock acquisition, so a concurrent
        writer in another process/instance can't have its update silently
        overwritten (lost-update)."""

        def modify(current):
            raw_items = current if isinstance(current, list) else []
            merged = {str(d["id"]): d for d in raw_items if isinstance(d, dict) and "id" in d}
            for session_id in remove_ids:
                merged.pop(session_id, None)
            for session_id, session in upserts.items():
                merged[session_id] = self._serialize_item(session)
            return list(merged.values())

        new_raw = self._store.read_modify_write(modify)
        result: dict[str, OfficeBuilderSession] = {}
        for item in new_raw:
            parsed = self._parse_item(item)
            if parsed is not None:
                result[parsed.id] = parsed
        return result
