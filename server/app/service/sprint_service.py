from __future__ import annotations

from server.app.ports.repositories import SprintRepository
from server.domain.errors import NotFoundError
from server.domain.models import Sprint


class SprintService:
    def __init__(self, repo: SprintRepository):
        self._repo = repo

    def list_sprints(self) -> list[Sprint]:
        return self._repo.list()

    def try_get_sprint(self, sprint_id: str) -> Sprint | None:
        return self._repo.get(sprint_id)

    def get_sprint(self, sprint_id: str) -> Sprint:
        sprint = self.try_get_sprint(sprint_id)
        if not sprint:
            raise NotFoundError(f"Sprint '{sprint_id}' not found")
        return sprint

    def upsert_sprint(self, sprint: Sprint) -> Sprint:
        return self._repo.upsert(sprint)

    def delete_sprint(self, sprint_id: str) -> None:
        if not self.try_get_sprint(sprint_id):
            raise NotFoundError(f"Sprint '{sprint_id}' not found")
        self._repo.delete(sprint_id)
