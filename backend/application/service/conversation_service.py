from __future__ import annotations

from backend.application.ports.repositories import ConversationRepository
from backend.domain.models import Message


class ConversationService:
    def __init__(self, repo: ConversationRepository):
        self._repo = repo

    def list_messages(self, task_id: str | None = None) -> list[Message]:
        return self._repo.list(task_id=task_id)

    def add_message(self, message: Message) -> Message:
        return self._repo.add(message)

    def delete_messages_by_task(self, task_id: str) -> None:
        return self._repo.delete_by_task(task_id)
