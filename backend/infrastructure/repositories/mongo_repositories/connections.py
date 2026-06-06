from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pymongo

from backend.domain.models import ThirdPartyConnection


class MongoConnectionRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["connections"]
        self._col.create_index("id", unique=True, background=True)

    def _doc_to_conn(self, item: dict[str, Any]) -> ThirdPartyConnection:
        created_raw = item.get("created_at")
        if isinstance(created_raw, datetime):
            created_at = created_raw if created_raw.tzinfo else created_raw.replace(tzinfo=timezone.utc)
        else:
            try:
                created_at = datetime.fromisoformat(str(created_raw).replace("Z", "+00:00"))
            except Exception:
                created_at = datetime.now(timezone.utc)
        return ThirdPartyConnection(
            id=str(item["id"]),
            platform=str(item.get("platform", "")),
            name=str(item.get("name", "")),
            config=dict(item.get("config") or {}),
            description=str(item.get("description", "")),
            created_at=created_at,
        )

    def _conn_to_doc(self, c: ThirdPartyConnection) -> dict[str, Any]:
        return {
            "id": c.id,
            "_id": c.id,
            "platform": c.platform,
            "name": c.name,
            "config": dict(c.config),
            "description": c.description,
            "created_at": c.created_at.isoformat(),
        }

    def list(self) -> list[ThirdPartyConnection]:
        return [self._doc_to_conn(doc) for doc in self._col.find()]

    def get(self, conn_id: str) -> ThirdPartyConnection | None:
        doc = self._col.find_one({"id": conn_id})
        return self._doc_to_conn(doc) if doc else None

    def upsert(self, conn: ThirdPartyConnection) -> ThirdPartyConnection:
        self._col.replace_one({"id": conn.id}, self._conn_to_doc(conn), upsert=True)
        return conn

    def delete(self, conn_id: str) -> None:
        self._col.delete_one({"id": conn_id})
