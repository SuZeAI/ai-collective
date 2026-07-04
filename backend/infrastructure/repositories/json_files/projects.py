from __future__ import annotations

import threading
from datetime import datetime, timezone

from backend.domain.models import DEFAULT_OWNER_ID, Project
from backend.infrastructure.repositories._helpers import parse_iso_utc
from backend.infrastructure.repositories.json_store import JsonFileStore


class JsonProjectRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Project] = {}
        for item in data:
            try:
                created_raw = item.get("createdAt")
                project = Project(
                    id=str(item["id"]),
                    key=str(item.get("key", "")).upper(),
                    name=str(item.get("name", "")),
                    description=str(item.get("description", "")),
                    lead_id=str(item.get("leadId", "")),
                    planner_staff_id=str(item.get("plannerAgentId", "")),
                    planner_system_prompt=str(item.get("plannerSystemPrompt", "")),
                    issue_counter=int(item.get("issueCounter", 0)),
                    created_at=parse_iso_utc(str(created_raw)) if created_raw else None,
                    avatar=str(item.get("avatar", "")),
                    avatar_icon=str(item.get("avatar_icon", "")),
                    avatar_color=str(item.get("avatar_color", "")),
                    avatar_url=str(item.get("avatar_url", "")),
                    owner_id=str(item.get("owner_id") or DEFAULT_OWNER_ID),
                )
                self._items[project.id] = project
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write(
            [
                {
                    "id": p.id,
                    "key": p.key,
                    "name": p.name,
                    "description": p.description,
                    "leadId": p.lead_id,
                    "plannerAgentId": p.planner_staff_id,
                    "plannerSystemPrompt": p.planner_system_prompt,
                    "issueCounter": p.issue_counter,
                    "createdAt": p.created_at.isoformat() if p.created_at else None,
                    "avatar": p.avatar,
                    "avatar_icon": p.avatar_icon,
                    "avatar_color": p.avatar_color,
                    "avatar_url": p.avatar_url,
                    "owner_id": p.owner_id,
                }
                for p in self._items.values()
            ]
        )

    def list(self) -> list[Project]:
        with self._lock:
            return list(self._items.values())

    def get(self, project_id: str) -> Project | None:
        with self._lock:
            return self._items.get(project_id)

    def upsert(self, project: Project) -> Project:
        with self._lock:
            self._items[project.id] = project
            self._persist()
        return project

    def delete(self, project_id: str) -> None:
        with self._lock:
            self._items.pop(project_id, None)
            self._persist()

    def allocate_issue_number(self, project_id: str) -> int:
        """Atomically increment and return the project's issue counter."""
        import dataclasses

        with self._lock:
            project = self._items.get(project_id)
            if project is None:
                raise KeyError(project_id)
            next_number = project.issue_counter + 1
            self._items[project_id] = dataclasses.replace(project, issue_counter=next_number)
            self._persist()
            return next_number
