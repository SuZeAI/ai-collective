from __future__ import annotations

from backend.application.ports.repositories import SprintRepository
from backend.domain.errors import NotFoundError
from backend.domain.models import Sprint


class SprintService:
    def __init__(self, repo: SprintRepository):
        self._repo = repo

    def list_sprints(self) -> list[Sprint]:
        return self._repo.list()

    def get_sprint(self, sprint_id: str) -> Sprint:
        sprint = self._repo.get(sprint_id)
        if not sprint:
            raise NotFoundError(f"Sprint '{sprint_id}' not found")
        return sprint

    def upsert_sprint(self, sprint: Sprint) -> Sprint:
        return self._repo.upsert(sprint)

    def delete_sprint(self, sprint_id: str) -> None:
        if not self._repo.get(sprint_id):
            raise NotFoundError(f"Sprint '{sprint_id}' not found")
        self._repo.delete(sprint_id)
