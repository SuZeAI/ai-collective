from __future__ import annotations

import threading

from backend.domain.models import DEFAULT_OWNER_ID, Project
from backend.infra.repositories._helpers import parse_iso_utc
from backend.infra.repositories.json_store import JsonFileStore


class JsonProjectRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Project] = {}
        for item in data:
            parsed = self._parse_item(item)
            if parsed is not None:
                self._items[parsed.id] = parsed

    @staticmethod
    def _parse_item(item: dict) -> Project | None:
        try:
            created_raw = item.get("createdAt")
            return Project(
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
                company_id=str(item.get("companyId", "")),
            )
        except Exception:
            return None

    @staticmethod
    def _serialize_item(p: Project) -> dict:
        return {
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
            "companyId": p.company_id,
        }

    def list(self) -> list[Project]:
        with self._lock:
            return list(self._items.values())

    def get(self, project_id: str) -> Project | None:
        with self._lock:
            return self._items.get(project_id)

    def upsert(self, project: Project) -> Project:
        with self._lock:
            self._items = self._merge_and_persist({project.id: project}, remove_ids=())
        return project

    def delete(self, project_id: str) -> None:
        with self._lock:
            self._items = self._merge_and_persist({}, remove_ids=(project_id,))

    def _merge_and_persist(
        self, upserts: dict[str, Project], remove_ids: tuple[str, ...]
    ) -> dict[str, Project]:
        """Merge this change into the *current on-disk* state (not just this
        process's in-memory cache) under one lock acquisition, so a concurrent
        writer in another process/instance can't have its update silently
        overwritten (lost-update)."""

        def modify(current):
            raw_items = current if isinstance(current, list) else []
            merged = {str(d["id"]): d for d in raw_items if isinstance(d, dict) and "id" in d}
            for project_id in remove_ids:
                merged.pop(project_id, None)
            for project_id, project in upserts.items():
                merged[project_id] = self._serialize_item(project)
            return list(merged.values())

        new_raw = self._store.read_modify_write(modify)
        result: dict[str, Project] = {}
        for item in new_raw:
            parsed = self._parse_item(item)
            if parsed is not None:
                result[parsed.id] = parsed
        return result

    def allocate_issue_number(self, project_id: str) -> int:
        """Atomically increment and return the project's issue counter.

        Reads+increments the *current on-disk* counter under one lock
        acquisition so two concurrent callers (or two app instances) never
        hand out the same issue number.
        """
        import dataclasses

        with self._lock:
            next_number_holder: list[int] = []

            def modify(current):
                raw_items = current if isinstance(current, list) else []
                merged = {str(d["id"]): d for d in raw_items if isinstance(d, dict) and "id" in d}
                raw_project = merged.get(project_id)
                if raw_project is None:
                    raise KeyError(project_id)
                project = self._parse_item(raw_project)
                if project is None:
                    raise KeyError(project_id)
                next_number = project.issue_counter + 1
                next_number_holder.append(next_number)
                merged[project_id] = self._serialize_item(dataclasses.replace(project, issue_counter=next_number))
                return list(merged.values())

            new_raw = self._store.read_modify_write(modify)
            self._items = {}
            for item in new_raw:
                parsed = self._parse_item(item)
                if parsed is not None:
                    self._items[parsed.id] = parsed
            return next_number_holder[0]
