from __future__ import annotations

from server.app.ports.repositories import SprintRepository
from server.app.service._helpers import get_or_raise
from server.domain.models import Sprint


class SprintService:
    def __init__(self, repo: SprintRepository):
        self._repo = repo

    def list_sprints(self) -> list[Sprint]:
        return self._repo.list()

    def try_get_sprint(self, sprint_id: str) -> Sprint | None:
        return self._repo.get(sprint_id)

    def get_sprint(self, sprint_id: str) -> Sprint:
        return get_or_raise(self.try_get_sprint, "Sprint", sprint_id)

    def upsert_sprint(self, sprint: Sprint) -> Sprint:
        return self._repo.upsert(sprint)

    def delete_sprint(self, sprint_id: str) -> None:
        get_or_raise(self.try_get_sprint, "Sprint", sprint_id)
        self._repo.delete(sprint_id)
