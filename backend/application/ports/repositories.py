from __future__ import annotations

from typing import Protocol

from backend.domain.memory.knowledge_graph import ConversationKnowledgeGraph
from backend.domain.models import Agent, Skill, Team, Task, Message, Analytics, ActivityFeedItem


class AgentRepository(Protocol):
    def list(self) -> list[Agent]:
        ...

    def get(self, agent_id: str) -> Agent | None:
        ...

    def upsert(self, agent: Agent) -> Agent:
        ...

    def delete(self, agent_id: str) -> None:
        ...


class SkillRepository(Protocol):
    def list(self) -> list[Skill]:
        ...

    def get(self, skill_id: str) -> Skill | None:
        ...

    def upsert(self, skill: Skill) -> Skill:
        ...

    def delete(self, skill_id: str) -> None:
        ...


class TeamRepository(Protocol):
    def list(self) -> list[Team]:
        ...

    def get(self, team_id: str) -> Team | None:
        ...

    def upsert(self, team: Team) -> Team:
        ...

    def delete(self, team_id: str) -> None:
        ...


class TaskRepository(Protocol):
    def list(self) -> list[Task]:
        ...

    def get(self, task_id: str) -> Task | None:
        ...

    def upsert(self, task: Task) -> Task:
        ...

    def delete(self, task_id: str) -> None:
        ...


class ConversationRepository(Protocol):
    def list(self, task_id: str | None = None) -> list[Message]:
        ...

    def add(self, message: Message) -> Message:
        ...

    def delete_by_task(self, task_id: str) -> None:
        ...


class AnalyticsRepository(Protocol):
    def get(self) -> Analytics:
        ...

    def set(self, analytics: Analytics) -> Analytics:
        ...


class ActivityFeedRepository(Protocol):
    def list(self) -> list[ActivityFeedItem]:
        ...

    def add(self, item: ActivityFeedItem) -> ActivityFeedItem:
        ...


class GraphKnowledgeRepository(Protocol):
    def get(self, conversation_id: str) -> ConversationKnowledgeGraph | None:
        ...

    def upsert(self, graph: ConversationKnowledgeGraph) -> ConversationKnowledgeGraph:
        ...

    def delete(self, conversation_id: str) -> None:
        ...

    def append_event(self, conversation_id: str, event: dict[str, object]) -> None:
        ...
