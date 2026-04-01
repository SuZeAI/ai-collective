from __future__ import annotations

from backend.application.ports.repositories import ConversationRepository
from backend.application.ports.agent_graph import GraphContextProvider
from backend.domain.models import Message


class ConversationService:
    def __init__(
        self,
        repo: ConversationRepository,
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
                speaker=saved.agent_id,
                content=saved.content,
                config=None,
            )
        return saved

    def delete_messages_by_task(self, task_id: str) -> None:
        return self._repo.delete_by_task(task_id)
