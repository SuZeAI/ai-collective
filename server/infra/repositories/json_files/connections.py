from __future__ import annotations

import threading
from datetime import datetime, timezone

from server.domain.models import DEFAULT_OWNER_ID, Connection
from server.infra.repositories.json_store import JsonFileStore


class JsonConnectionRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Connection] = {}
        for item in data:
            parsed = self._parse_item(item)
            if parsed is not None:
                self._items[parsed.id] = parsed

    @staticmethod
    def _parse_item(item: dict) -> Connection | None:
        try:
            return Connection(
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
        except Exception:
            return None

    @staticmethod
    def _serialize_item(c: Connection) -> dict:
        return {
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

    def list(self) -> list[Connection]:
        with self._lock:
            return list(self._items.values())

    def get(self, conn_id: str) -> Connection | None:
        with self._lock:
            return self._items.get(conn_id)

    def upsert(self, conn: Connection) -> Connection:
        with self._lock:
            self._items = self._merge_and_persist({conn.id: conn}, remove_ids=())
        return conn

    def delete(self, conn_id: str) -> None:
        with self._lock:
            self._items = self._merge_and_persist({}, remove_ids=(conn_id,))

    def _merge_and_persist(
        self, upserts: dict[str, Connection], remove_ids: tuple[str, ...]
    ) -> dict[str, Connection]:
        """Merge this change into the *current on-disk* state (not just this
        process's in-memory cache) under one lock acquisition, so a concurrent
        writer in another process/instance can't have its update silently
        overwritten (lost-update)."""

        def modify(current):
            raw_items = current if isinstance(current, list) else []
            merged = {str(d["id"]): d for d in raw_items if isinstance(d, dict) and "id" in d}
            for conn_id in remove_ids:
                merged.pop(conn_id, None)
            for conn_id, conn in upserts.items():
                merged[conn_id] = self._serialize_item(conn)
            return list(merged.values())

        new_raw = self._store.read_modify_write(modify)
        result: dict[str, Connection] = {}
        for item in new_raw:
            parsed = self._parse_item(item)
            if parsed is not None:
                result[parsed.id] = parsed
        return result
