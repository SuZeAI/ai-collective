from __future__ import annotations

from datetime import datetime
from pathlib import Path

from backend.domain.enums import AgentStatus, TaskStatus
from backend.domain.models import Agent, Skill, Team, Task, Message, Analytics, ActivityFeedItem
from backend.infrastructure.repositories.json_store import JsonFileStore


def _default_agent_system_prompt(*, name: str, role: str, description: str) -> str:
    return (
        f"You are {name}, working as a {role}. "
        f"Your mission: {description.strip() or f'perform the responsibilities of a {role}'}. "
        "Provide concise, practical, and high-quality outputs. "
        "When information is missing, ask targeted follow-up questions before acting."
    )


class JsonAgentRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Agent] = {}
        for item in data:
            try:
                agent = Agent(
                    id=str(item["id"]),
                    name=str(item.get("name", "")),
                    role=str(item.get("role", "")),
                    description=str(item.get("description", "")),
                    skill_ids=[str(x) for x in (item.get("skillIds") or [])],
                    status=AgentStatus(str(item.get("status", "idle"))),
                    avatar=str(item.get("avatar", "A")),
                    system_prompt=(
                        str(item.get("system_prompt", "")).strip()
                        or _default_agent_system_prompt(
                            name=str(item.get("name", "")),
                            role=str(item.get("role", "")),
                            description=str(item.get("description", "")),
                        )
                    ),
                )
                self._items[agent.id] = agent
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write(
            [
                {
                    "id": a.id,
                    "name": a.name,
                    "role": a.role,
                    "description": a.description,
                    "skillIds": list(a.skill_ids),
                    "status": a.status.value,
                    "avatar": a.avatar,
                    "system_prompt": a.system_prompt
                    or _default_agent_system_prompt(name=a.name, role=a.role, description=a.description),
                }
                for a in self._items.values()
            ]
        )

    def list(self) -> list[Agent]:
        return list(self._items.values())

    def get(self, agent_id: str) -> Agent | None:
        return self._items.get(agent_id)

    def upsert(self, agent: Agent) -> Agent:
        self._items[agent.id] = agent
        self._persist()
        return agent

    def delete(self, agent_id: str) -> None:
        self._items.pop(agent_id, None)
        self._persist()


class JsonSkillRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Skill] = {}
        for item in data:
            try:
                s = Skill(
                    id=str(item["id"]),
                    name=str(item.get("name", "")),
                    description=str(item.get("description", "")),
                    third_party=str(item.get("third_party", "")),
                    kind=str(item.get("kind", "integration")),
                    config=dict(item.get("config") or {}),
                    code=(str(item.get("code")) if item.get("code") is not None else None),
                )
                self._items[s.id] = s
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write(
            [
                {
                    "id": s.id,
                    "name": s.name,
                    "description": s.description,
                    "third_party": s.third_party,
                    "kind": s.kind,
                    "config": dict(s.config or {}),
                    "code": s.code,
                }
                for s in self._items.values()
            ]
        )

    def list(self) -> list[Skill]:
        return list(self._items.values())

    def get(self, skill_id: str) -> Skill | None:
        return self._items.get(skill_id)

    def upsert(self, skill: Skill) -> Skill:
        self._items[skill.id] = skill
        self._persist()
        return skill

    def delete(self, skill_id: str) -> None:
        self._items.pop(skill_id, None)
        self._persist()


class JsonTeamRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Team] = {}
        for item in data:
            try:
                team = Team(
                    id=str(item["id"]),
                    name=str(item.get("name", "")),
                    description=str(item.get("description", "")),
                    agents=[str(x) for x in (item.get("agents") or [])],
                    active_tasks=int(item.get("activeTasks", 0)),
                    mode=str(item.get("mode", "sequential")),
                    max_steps=int(item.get("maxSteps", 6)),
                )
                self._items[team.id] = team
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write(
            [
                {
                    "id": t.id,
                    "name": t.name,
                    "description": t.description,
                    "agents": list(t.agents),
                    "activeTasks": t.active_tasks,
                    "mode": t.mode,
                    "maxSteps": t.max_steps,
                }
                for t in self._items.values()
            ]
        )

    def list(self) -> list[Team]:
        return list(self._items.values())

    def get(self, team_id: str) -> Team | None:
        return self._items.get(team_id)

    def upsert(self, team: Team) -> Team:
        self._items[team.id] = team
        self._persist()
        return team

    def delete(self, team_id: str) -> None:
        self._items.pop(team_id, None)
        self._persist()


class JsonTaskRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Task] = {}
        for item in data:
            try:
                task = Task(
                    id=str(item["id"]),
                    title=str(item.get("title", "")),
                    description=str(item.get("description", "")),
                    team_id=str(item.get("teamId", "")),
                    status=TaskStatus(str(item.get("status", "pending"))),
                    progress=int(item.get("progress", 0)),
                    assigned_agents=[str(x) for x in (item.get("assignedAgents") or [])],
                )
                self._items[task.id] = task
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write(
            [
                {
                    "id": t.id,
                    "title": t.title,
                    "description": t.description,
                    "teamId": t.team_id,
                    "status": t.status.value,
                    "progress": t.progress,
                    "assignedAgents": list(t.assigned_agents),
                }
                for t in self._items.values()
            ]
        )

    def list(self) -> list[Task]:
        return list(self._items.values())

    def get(self, task_id: str) -> Task | None:
        return self._items.get(task_id)

    def upsert(self, task: Task) -> Task:
        self._items[task.id] = task
        self._persist()
        return task

    def delete(self, task_id: str) -> None:
        self._items.pop(task_id, None)
        self._persist()


class JsonConversationRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: list[Message] = []
        for item in data:
            try:
                ts = str(item.get("timestamp") or "")
                dt = datetime.fromisoformat(ts) if ts else datetime.utcnow().replace(microsecond=0)
                self._items.append(
                    Message(
                        id=str(item["id"]),
                        agent_id=str(item.get("agentId", "")),
                        content=str(item.get("content", "")),
                        timestamp=dt,
                        task_id=(str(item.get("taskId")) if item.get("taskId") is not None else None),
                    )
                )
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write(
            [
                {
                    "id": m.id,
                    "agentId": m.agent_id,
                    "content": m.content,
                    "timestamp": m.timestamp.isoformat(),
                    "taskId": m.task_id,
                }
                for m in self._items
            ]
        )

    def list(self, task_id: str | None = None) -> list[Message]:
        if task_id is None:
            return list(self._items)
        return [m for m in self._items if m.task_id == task_id]

    def add(self, message: Message) -> Message:
        self._items.append(message)
        self._persist()
        return message

    def delete_by_task(self, task_id: str) -> None:
        self._items = [m for m in self._items if m.task_id != task_id]
        self._persist()


class JsonAnalyticsRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        data = store.read()
        if not isinstance(data, dict):
            data = {}
        self._analytics = Analytics(
            tasks_completed=int(data.get("tasksCompleted", 0)),
            avg_completion_time=str(data.get("avgCompletionTime", "")),
            team_efficiency=int(data.get("teamEfficiency", 0)),
            agent_productivity={str(k): int(v) for k, v in (data.get("agentProductivity") or {}).items()},
        )

    def _persist(self) -> None:
        self._store.write(
            {
                "tasksCompleted": self._analytics.tasks_completed,
                "avgCompletionTime": self._analytics.avg_completion_time,
                "teamEfficiency": self._analytics.team_efficiency,
                "agentProductivity": dict(self._analytics.agent_productivity),
            }
        )

    def get(self) -> Analytics:
        return self._analytics

    def set(self, analytics: Analytics) -> Analytics:
        self._analytics = analytics
        self._persist()
        return analytics


class JsonActivityFeedRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: list[ActivityFeedItem] = []
        for item in data:
            try:
                self._items.append(
                    ActivityFeedItem(
                        id=str(item["id"]),
                        agent_id=str(item.get("agentId", "")),
                        action=str(item.get("action", "")),
                        time=str(item.get("time", "")),
                    )
                )
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write(
            [{"id": i.id, "agentId": i.agent_id, "action": i.action, "time": i.time} for i in self._items]
        )

    def list(self) -> list[ActivityFeedItem]:
        return list(self._items)

    def add(self, item: ActivityFeedItem) -> ActivityFeedItem:
        self._items.insert(0, item)
        self._persist()
        return item
