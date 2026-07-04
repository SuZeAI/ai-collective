from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pymongo

from backend.domain.models import DEFAULT_OWNER_ID, Connection


class MongoConnectionRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["connections"]
        self._col.create_index("id", unique=True, background=True)

    def _doc_to_conn(self, item: dict[str, Any]) -> Connection:
        created_raw = item.get("created_at")
        if isinstance(created_raw, datetime):
            created_at = created_raw if created_raw.tzinfo else created_raw.replace(tzinfo=timezone.utc)
        else:
            try:
                created_at = datetime.fromisoformat(str(created_raw).replace("Z", "+00:00"))
            except Exception:
                created_at = datetime.now(timezone.utc)
        return Connection(
            id=str(item["id"]),
            platform=str(item.get("platform", "")),
            name=str(item.get("name", "")),
            config=dict(item.get("config") or {}),
            description=str(item.get("description", "")),
            created_at=created_at,
            enabled=bool(item.get("enabled", True)),
            kind=str(item.get("kind", "outbound") or "outbound"),
            company_id=str(item.get("company_id", "") or ""),
            owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
            routing_department_id=str(item.get("routing_department_id", "") or ""),
            routing_staff_ids=list(item.get("routing_staff_ids") or []),
        )

    def _conn_to_doc(self, c: Connection) -> dict[str, Any]:
        return {
            "id": c.id,
            "_id": c.id,
            "platform": c.platform,
            "name": c.name,
            "config": dict(c.config),
            "description": c.description,
            "created_at": c.created_at.isoformat(),
            "enabled": c.enabled,
            "kind": c.kind,
            "company_id": c.company_id,
            "owner_id": c.owner_id,
            "routing_department_id": c.routing_department_id,
            "routing_staff_ids": list(c.routing_staff_ids),
        }

    def list(self) -> list[Connection]:
        return [self._doc_to_conn(doc) for doc in self._col.find()]

    def get(self, conn_id: str) -> Connection | None:
        doc = self._col.find_one({"id": conn_id})
        return self._doc_to_conn(doc) if doc else None

    def upsert(self, conn: Connection) -> Connection:
        self._col.replace_one({"id": conn.id}, self._conn_to_doc(conn), upsert=True)
        return conn

    def delete(self, conn_id: str) -> None:
        self._col.delete_one({"id": conn_id})
