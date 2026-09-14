from __future__ import annotations

from server.app.ports.repositories import EpicRepository
from server.app.service._helpers import get_or_raise
from server.domain.models import Epic


class EpicService:
    def __init__(self, repo: EpicRepository):
        self._repo = repo

    def list_epics(self) -> list[Epic]:
        return self._repo.list()

    def try_get_epic(self, epic_id: str) -> Epic | None:
        return self._repo.get(epic_id)

    def get_epic(self, epic_id: str) -> Epic:
        return get_or_raise(self.try_get_epic, "Epic", epic_id)

    def upsert_epic(self, epic: Epic) -> Epic:
        return self._repo.upsert(epic)

    def delete_epic(self, epic_id: str) -> None:
        get_or_raise(self.try_get_epic, "Epic", epic_id)
        self._repo.delete(epic_id)
