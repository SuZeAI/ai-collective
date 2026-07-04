from __future__ import annotations

import threading
from datetime import datetime, timezone

from backend.domain.models import DEFAULT_OWNER_ID, OfficeBuilderSession
from backend.infrastructure.repositories._helpers import parse_iso_utc
from backend.infrastructure.repositories.json_store import JsonFileStore


class JsonOfficeBuilderSessionRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, OfficeBuilderSession] = {}
        for item in data:
            try:
                now = datetime.now(timezone.utc)
                session = OfficeBuilderSession(
                    id=str(item["id"]),
                    title=str(item.get("title", "")),
                    messages=[dict(m) for m in (item.get("messages") or [])],
                    plan=dict(item["plan"]) if isinstance(item.get("plan"), dict) else None,
                    created_at=parse_iso_utc(str(item.get("createdAt", ""))) or now,
                    updated_at=parse_iso_utc(str(item.get("updatedAt", ""))) or now,
                    company_id=str(item.get("workspaceId", "") or ""),
                    owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
                )
                self._items[session.id] = session
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write([
            {
                "id": s.id,
                "title": s.title,
                "messages": list(s.messages),
                "plan": s.plan,
                "createdAt": s.created_at.isoformat(),
                "updatedAt": s.updated_at.isoformat(),
                "workspaceId": s.company_id,
                "owner_id": s.owner_id,
            }
            for s in self._items.values()
        ])

    def list(self) -> list[OfficeBuilderSession]:
        with self._lock:
            return list(self._items.values())

    def get(self, session_id: str) -> OfficeBuilderSession | None:
        with self._lock:
            return self._items.get(session_id)

    def upsert(self, session: OfficeBuilderSession) -> OfficeBuilderSession:
        with self._lock:
            self._items[session.id] = session
            self._persist()
        return session

    def delete(self, session_id: str) -> None:
        with self._lock:
            self._items.pop(session_id, None)
            self._persist()
