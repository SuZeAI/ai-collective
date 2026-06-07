from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pymongo

from backend.domain.models import DEFAULT_OWNER_ID, OfficeBuilderSession


class MongoOfficeBuilderSessionRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["office_builder_sessions"]
        self._col.create_index("id", unique=True, background=True)

    @staticmethod
    def _parse_dt(raw: Any) -> datetime:
        if isinstance(raw, datetime):
            return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
        try:
            return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except Exception:
            return datetime.now(timezone.utc)

    def _doc_to_session(self, item: dict[str, Any]) -> OfficeBuilderSession:
        return OfficeBuilderSession(
            id=str(item["id"]),
            title=str(item.get("title", "")),
            messages=[dict(m) for m in (item.get("messages") or [])],
            plan=dict(item["plan"]) if isinstance(item.get("plan"), dict) else None,
            created_at=self._parse_dt(item.get("createdAt")),
            updated_at=self._parse_dt(item.get("updatedAt")),
            workspace_id=str(item.get("workspaceId", "") or ""),
            owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
        )

    def _session_to_doc(self, s: OfficeBuilderSession) -> dict[str, Any]:
        return {
            "id": s.id,
            "_id": s.id,
            "title": s.title,
            "messages": list(s.messages),
            "plan": s.plan,
            "createdAt": s.created_at.isoformat(),
            "updatedAt": s.updated_at.isoformat(),
            "workspaceId": s.workspace_id,
            "owner_id": s.owner_id,
        }

    def list(self) -> list[OfficeBuilderSession]:
        return [self._doc_to_session(doc) for doc in self._col.find()]

    def get(self, session_id: str) -> OfficeBuilderSession | None:
        doc = self._col.find_one({"id": session_id})
        return self._doc_to_session(doc) if doc else None

    def upsert(self, session: OfficeBuilderSession) -> OfficeBuilderSession:
        self._col.replace_one({"id": session.id}, self._session_to_doc(session), upsert=True)
        return session

    def delete(self, session_id: str) -> None:
        self._col.delete_one({"id": session_id})
