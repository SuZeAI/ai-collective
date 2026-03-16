from __future__ import annotations

from dataclasses import replace
from datetime import datetime

from backend.domain.models import Agent, Team, Task, Message, Analytics


class InMemoryAgentRepository:
    def __init__(self, initial: list[Agent]):
        self._items: dict[str, Agent] = {a.id: a for a in initial}

    def list(self) -> list[Agent]:
        return list(self._items.values())

    def get(self, agent_id: str) -> Agent | None:
        return self._items.get(agent_id)

    def upsert(self, agent: Agent) -> Agent:
        self._items[agent.id] = agent
        return agent

    def delete(self, agent_id: str) -> None:
        self._items.pop(agent_id, None)


class InMemoryTeamRepository:
    def __init__(self, initial: list[Team]):
        self._items: dict[str, Team] = {t.id: t for t in initial}

    def list(self) -> list[Team]:
        return list(self._items.values())

    def get(self, team_id: str) -> Team | None:
        return self._items.get(team_id)

    def upsert(self, team: Team) -> Team:
        self._items[team.id] = team
        return team

    def delete(self, team_id: str) -> None:
        self._items.pop(team_id, None)


class InMemoryTaskRepository:
    def __init__(self, initial: list[Task]):
        self._items: dict[str, Task] = {t.id: t for t in initial}

    def list(self) -> list[Task]:
        return list(self._items.values())

    def get(self, task_id: str) -> Task | None:
        return self._items.get(task_id)

    def upsert(self, task: Task) -> Task:
        self._items[task.id] = task
        return task

    def delete(self, task_id: str) -> None:
        self._items.pop(task_id, None)


class InMemoryConversationRepository:
    def __init__(self, initial: list[Message]):
        self._items: list[Message] = list(initial)

    def list(self, task_id: str | None = None) -> list[Message]:
        if task_id is None:
            return list(self._items)
        return [m for m in self._items if m.task_id == task_id]

    def add(self, message: Message) -> Message:
        self._items.append(message)
        return message


class InMemoryAnalyticsRepository:
    def __init__(self, initial: Analytics):
        self._analytics = initial

    def get(self) -> Analytics:
        return self._analytics

    def set(self, analytics: Analytics) -> Analytics:
        self._analytics = analytics
        return analytics
