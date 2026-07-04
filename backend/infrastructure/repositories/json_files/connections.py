from __future__ import annotations

import threading
from datetime import datetime, timezone

from backend.domain.models import DEFAULT_OWNER_ID, Connection
from backend.infrastructure.repositories.json_store import JsonFileStore


class JsonConnectionRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Connection] = {}
        for item in data:
            try:
                conn = Connection(
                    id=str(item["id"]),
                    platform=str(item.get("platform", "")),
                    name=str(item.get("name", "")),
                    config=dict(item.get("config", {})),
                    description=str(item.get("description", "")),
                    created_at=datetime.fromisoformat(item["created_at"]).replace(tzinfo=timezone.utc)
                    if item.get("created_at")
                    else datetime.now(timezone.utc),
                    enabled=bool(item.get("enabled", True)),
                    kind=str(item.get("kind", "outbound") or "outbound"),
                    company_id=str(item.get("company_id", "") or ""),
                    owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
                    routing_department_id=str(item.get("routing_department_id", "") or ""),
                    routing_staff_ids=list(item.get("routing_staff_ids") or []),
                )
                self._items[conn.id] = conn
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write(
            [
                {
                    "id": c.id,
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
                for c in self._items.values()
            ]
        )

    def list(self) -> list[Connection]:
        with self._lock:
            return list(self._items.values())

    def get(self, conn_id: str) -> Connection | None:
        with self._lock:
            return self._items.get(conn_id)

    def upsert(self, conn: Connection) -> Connection:
        with self._lock:
            self._items[conn.id] = conn
            self._persist()
        return conn

    def delete(self, conn_id: str) -> None:
        with self._lock:
            self._items.pop(conn_id, None)
            self._persist()
