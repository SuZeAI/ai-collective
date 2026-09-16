from __future__ import annotations

import threading
from datetime import datetime, timezone

from server.domain.models import DEFAULT_OWNER_ID, Company
from server.infra.repositories._helpers import parse_iso_utc
from server.infra.repositories.json_store import JsonFileStore


class JsonCompanyRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Company] = {}
        for item in data:
            parsed = self._parse_item(item)
            if parsed is not None:
                self._items[parsed.id] = parsed

    @staticmethod
    def _parse_item(item: dict) -> Company | None:
        try:
            return Company(
                id=str(item["id"]),
                name=str(item.get("name", "")),
                description=str(item.get("description", "")),
                department_ids=[str(x) for x in (item.get("teamIds") or [])],
                created_at=parse_iso_utc(str(item.get("createdAt", ""))) or datetime.now(timezone.utc),
                avatar=str(item.get("avatar", "") or str(item.get("name", "") or "W")[:1].upper()),
                avatar_icon=str(item.get("avatar_icon", "") or ""),
                avatar_color=str(item.get("avatar_color", "") or ""),
                avatar_url=str(item.get("avatar_url", "") or ""),
                primary_department_id=str(item.get("primaryTeamId", "")),
                type=str(item.get("type", "") or "general"),
                owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
            )
        except Exception:
            return None

    @staticmethod
    def _serialize_item(w: Company) -> dict:
        return {
            "id": w.id,
            "name": w.name,
            "description": w.description,
            "teamIds": list(w.department_ids),
            "primaryTeamId": w.primary_department_id,
            "createdAt": w.created_at.isoformat(),
            "type": w.type,
            "avatar": w.avatar,
            "avatar_icon": w.avatar_icon,
            "avatar_color": w.avatar_color,
            "avatar_url": w.avatar_url,
            "owner_id": w.owner_id,
        }

    def list(self) -> list[Company]:
        with self._lock:
            return list(self._items.values())

    def get(self, company_id: str) -> Company | None:
        with self._lock:
            return self._items.get(company_id)

    def upsert(self, company: Company) -> Company:
        with self._lock:
            self._items = self._merge_and_persist({company.id: company}, remove_ids=())
        return company

    def delete(self, company_id: str) -> None:
        with self._lock:
            self._items = self._merge_and_persist({}, remove_ids=(company_id,))

    def _merge_and_persist(
        self, upserts: dict[str, Company], remove_ids: tuple[str, ...]
    ) -> dict[str, Company]:
        """Merge this change into the *current on-disk* state (not just this
        process's in-memory cache) under one lock acquisition, so a concurrent
        writer in another process/instance can't have its update silently
        overwritten (lost-update)."""

        def modify(current):
            raw_items = current if isinstance(current, list) else []
            merged = {str(d["id"]): d for d in raw_items if isinstance(d, dict) and "id" in d}
            for company_id in remove_ids:
                merged.pop(company_id, None)
            for company_id, company in upserts.items():
                merged[company_id] = self._serialize_item(company)
            return list(merged.values())

        new_raw = self._store.read_modify_write(modify)
        result: dict[str, Company] = {}
        for item in new_raw:
            parsed = self._parse_item(item)
            if parsed is not None:
                result[parsed.id] = parsed
        return result
