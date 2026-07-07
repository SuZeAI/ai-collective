from __future__ import annotations

import threading
from datetime import datetime, timezone

from backend.domain.models import DEFAULT_OWNER_ID, Company
from backend.infrastructure.repositories._helpers import parse_iso_utc
from backend.infrastructure.repositories.json_store import JsonFileStore


class JsonCompanyRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Company] = {}
        for item in data:
            try:
                ws = Company(
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
                self._items[ws.id] = ws
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write([
            {
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
            for w in self._items.values()
        ])

    def list(self) -> list[Company]:
        with self._lock:
            return list(self._items.values())

    def get(self, company_id: str) -> Company | None:
        with self._lock:
            return self._items.get(company_id)

    def upsert(self, workspace: Company) -> Company:
        with self._lock:
            self._items[workspace.id] = workspace
            self._persist()
        return workspace

    def delete(self, company_id: str) -> None:
        with self._lock:
            self._items.pop(company_id, None)
            self._persist()
