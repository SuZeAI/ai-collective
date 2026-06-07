from __future__ import annotations

import threading
from datetime import datetime, timezone

from backend.domain.models import DEFAULT_OWNER_ID, PlatformHook, Workspace
from backend.infrastructure.repositories._helpers import parse_iso_utc
from backend.infrastructure.repositories.json_store import JsonFileStore


class JsonWorkspaceRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Workspace] = {}
        for item in data:
            try:
                hooks = [
                    PlatformHook(
                        id=str(h["id"]),
                        platform=str(h.get("platform", "")),
                        name=str(h.get("name", "")),
                        config=dict(h.get("config") or {}),
                        description=str(h.get("description", "")),
                        enabled=bool(h.get("enabled", True)),
                    )
                    for h in (item.get("platformHooks") or [])
                ]
                ws = Workspace(
                    id=str(item["id"]),
                    name=str(item.get("name", "")),
                    description=str(item.get("description", "")),
                    team_ids=[str(x) for x in (item.get("teamIds") or [])],
                    platform_hooks=hooks,
                    created_at=parse_iso_utc(str(item.get("createdAt", ""))) or datetime.now(timezone.utc),
                    avatar=str(item.get("avatar", "") or str(item.get("name", "") or "W")[:1].upper()),
                    avatar_icon=str(item.get("avatar_icon", "") or ""),
                    avatar_color=str(item.get("avatar_color", "") or ""),
                    avatar_url=str(item.get("avatar_url", "") or ""),
                    primary_team_id=str(item.get("primaryTeamId", "")),
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
                "teamIds": list(w.team_ids),
                "primaryTeamId": w.primary_team_id,
                "platformHooks": [
                    {
                        "id": h.id,
                        "platform": h.platform,
                        "name": h.name,
                        "config": dict(h.config),
                        "description": h.description,
                        "enabled": h.enabled,
                    }
                    for h in w.platform_hooks
                ],
                "createdAt": w.created_at.isoformat(),
                "avatar": w.avatar,
                "avatar_icon": w.avatar_icon,
                "avatar_color": w.avatar_color,
                "avatar_url": w.avatar_url,
                "owner_id": w.owner_id,
            }
            for w in self._items.values()
        ])

    def list(self) -> list[Workspace]:
        with self._lock:
            return list(self._items.values())

    def get(self, workspace_id: str) -> Workspace | None:
        with self._lock:
            return self._items.get(workspace_id)

    def upsert(self, workspace: Workspace) -> Workspace:
        with self._lock:
            self._items[workspace.id] = workspace
            self._persist()
        return workspace

    def delete(self, workspace_id: str) -> None:
        with self._lock:
            self._items.pop(workspace_id, None)
            self._persist()
