from __future__ import annotations

from backend.application.ports.repositories import EpicRepository
from backend.domain.errors import NotFoundError
from backend.domain.models import Epic


class EpicService:
    def __init__(self, repo: EpicRepository):
        self._repo = repo

    def list_epics(self) -> list[Epic]:
        return self._repo.list()

    def get_epic(self, epic_id: str) -> Epic:
        epic = self._repo.get(epic_id)
        if not epic:
            raise NotFoundError(f"Epic '{epic_id}' not found")
        return epic

    def upsert_epic(self, epic: Epic) -> Epic:
        return self._repo.upsert(epic)

    def delete_epic(self, epic_id: str) -> None:
        if not self._repo.get(epic_id):
            raise NotFoundError(f"Epic '{epic_id}' not found")
        self._repo.delete(epic_id)
