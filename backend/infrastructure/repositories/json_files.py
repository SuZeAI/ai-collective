from __future__ import annotations

from datetime import datetime
from pathlib import Path

from backend.domain.enums import AgentStatus, TaskStatus
from backend.domain.models import Agent, Skill, Team, Task, Message, Analytics, ActivityFeedItem
from backend.infrastructure.repositories.json_store import JsonFileStore


class JsonAgentRepository:
    def __init__(self, store: JsonFileStore, seed: list[Agent]):
        self._store = store
        data = store.read()
        if not isinstance(data, list):
            data = [
                {
                    "id": a.id,
                    "name": a.name,
                    "role": a.role,
                    "description": a.description,
                    "skills": [
                        {
                            "id": s.id,
                            "name": s.name,
                            "description": s.description,
                            "third_party": s.third_party,
                            "kind": s.kind,
                            "config": dict(s.config or {}),
                            "code": s.code,
                        }
                        for s in (getattr(a, "skills", None) or [])
                    ],
                    "status": a.status.value,
                    "avatar": a.avatar,
                }
                for a in seed
            ]
            store.write(data)
        self._items: dict[str, Agent] = {}
        for item in data:
            try:
                raw_skills = item.get("skills") or []
                skills: list[Skill] = []
                if isinstance(raw_skills, list):
                    for i, s in enumerate(raw_skills):
                        if not isinstance(s, dict):
                            continue
                        skill_id = str(s.get("id") or f"{item.get('id', 'a')}-s{i+1}")
                        skills.append(
                            Skill(
                                id=skill_id,
                                name=str(s.get("name", "")),
                                description=str(s.get("description", "")),
                                third_party=str(s.get("third_party", "")),
                                kind=str(s.get("kind", "integration")),
                                config=dict(s.get("config") or {}),
                                code=(str(s.get("code")) if s.get("code") is not None else None),
                            )
                        )
                agent = Agent(
                    id=str(item["id"]),
                    name=str(item.get("name", "")),
                    role=str(item.get("role", "")),
                    description=str(item.get("description", "")),
                    skills=skills,
                    status=AgentStatus(str(item.get("status", "idle"))),
                    avatar=str(item.get("avatar", "A")),
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
                    "skills": [
                        {
                            "id": s.id,
                            "name": s.name,
                            "description": s.description,
                            "third_party": s.third_party,
                            "kind": s.kind,
                            "config": dict(s.config or {}),
                            "code": s.code,
                        }
                        for s in (getattr(a, "skills", None) or [])
                    ],
                    "status": a.status.value,
                    "avatar": a.avatar,
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
    def __init__(self, store: JsonFileStore, seed: list[Skill]):
        self._store = store
        data = store.read()
        if not isinstance(data, list):
            data = [
                {
                    "id": s.id,
                    "name": s.name,
                    "description": s.description,
                    "third_party": s.third_party,
                    "kind": s.kind,
                    "config": dict(s.config or {}),
                    "code": s.code,
                }
                for s in seed
            ]
            store.write(data)

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
    def __init__(self, store: JsonFileStore, seed: list[Team]):
        self._store = store
        data = store.read()
        if not isinstance(data, list):
            data = [
                {
                    "id": t.id,
                    "name": t.name,
                    "description": t.description,
                    "agents": list(t.agents),
                    "activeTasks": t.active_tasks,
                }
                for t in seed
            ]
            store.write(data)
        self._items: dict[str, Team] = {}
        for item in data:
            try:
                team = Team(
                    id=str(item["id"]),
                    name=str(item.get("name", "")),
                    description=str(item.get("description", "")),
                    agents=[str(x) for x in (item.get("agents") or [])],
                    active_tasks=int(item.get("activeTasks", 0)),
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
    def __init__(self, store: JsonFileStore, seed: list[Task]):
        self._store = store
        data = store.read()
        if not isinstance(data, list):
            data = [
                {
                    "id": t.id,
                    "title": t.title,
                    "description": t.description,
                    "teamId": t.team_id,
                    "status": t.status.value,
                    "progress": t.progress,
                    "assignedAgents": list(t.assigned_agents),
                }
                for t in seed
            ]
            store.write(data)
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
    def __init__(self, store: JsonFileStore, seed: list[Message]):
        self._store = store
        data = store.read()
        if not isinstance(data, list):
            data = [
                {
                    "id": m.id,
                    "agentId": m.agent_id,
                    "content": m.content,
                    "timestamp": m.timestamp.isoformat(),
                    "taskId": m.task_id,
                }
                for m in seed
            ]
            store.write(data)
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


class JsonAnalyticsRepository:
    def __init__(self, store: JsonFileStore, seed: Analytics):
        self._store = store
        data = store.read()
        if not isinstance(data, dict):
            data = {
                "tasksCompleted": seed.tasks_completed,
                "avgCompletionTime": seed.avg_completion_time,
                "teamEfficiency": seed.team_efficiency,
                "agentProductivity": dict(seed.agent_productivity),
            }
            store.write(data)
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
    def __init__(self, store: JsonFileStore, seed: list[ActivityFeedItem]):
        self._store = store
        data = store.read()
        if not isinstance(data, list):
            data = [
                {"id": i.id, "agentId": i.agent_id, "action": i.action, "time": i.time}
                for i in seed
            ]
            store.write(data)
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
