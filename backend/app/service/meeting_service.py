from __future__ import annotations

from backend.app.ports.repositories import MeetingRepository
from backend.app.ports.staff_graph import GraphContextProvider
from backend.domain.models import Message


class MeetingService:
    def __init__(
        self,
        repo: MeetingRepository,
        graph_context_provider: GraphContextProvider | None = None,
    ):
        self._repo = repo
        self._graph_context_provider = graph_context_provider

    def list_messages(self, task_id: str | None = None) -> list[Message]:
        return self._repo.list(task_id=task_id)

    def add_message(self, message: Message) -> Message:
        saved = self._repo.add(message)
        if self._graph_context_provider and saved.task_id:
            self._graph_context_provider.ingest_message(
                conversation_id=saved.task_id,
                message_id=saved.id,
                speaker=saved.staff_id,
                content=saved.content,
                config=None,
            )
        return saved

    def delete_messages_by_task(self, task_id: str) -> None:
        return self._repo.delete_by_task(task_id)
