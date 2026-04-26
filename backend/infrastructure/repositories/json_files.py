from __future__ import annotations

import threading
from datetime import datetime, timezone
from pathlib import Path

from backend.domain.enums import AgentStatus, TaskStatus
from backend.domain.models import Agent, Skill, Team, Task, Message, Analytics, ActivityFeedItem, Workspace, PlatformHook, ThirdPartyConnection
from backend.infrastructure.repositories.json_store import JsonFileStore


def _parse_iso_utc(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


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
        self._lock = threading.RLock()
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
                    avatar_icon=str(item.get("avatar_icon", "") or ""),
                    avatar_color=str(item.get("avatar_color", "") or ""),
                    avatar_url=str(item.get("avatar_url", "") or ""),
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
                    "avatar_icon": a.avatar_icon,
                    "avatar_color": a.avatar_color,
                    "avatar_url": a.avatar_url,
                    "system_prompt": a.system_prompt
                    or _default_agent_system_prompt(name=a.name, role=a.role, description=a.description),
                }
                for a in self._items.values()
            ]
        )

    def list(self) -> list[Agent]:
        with self._lock:
            return list(self._items.values())

    def get(self, agent_id: str) -> Agent | None:
        with self._lock:
            return self._items.get(agent_id)

    def upsert(self, agent: Agent) -> Agent:
        with self._lock:
            self._items[agent.id] = agent
            self._persist()
        return agent

    def delete(self, agent_id: str) -> None:
        with self._lock:
            self._items.pop(agent_id, None)
            self._persist()


class JsonSkillRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
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
                    avatar=str(item.get("avatar", "") or str(item.get("name", "") or "S")[:1].upper()),
                    avatar_icon=str(item.get("avatar_icon", "") or ""),
                    avatar_color=str(item.get("avatar_color", "") or ""),
                    avatar_url=str(item.get("avatar_url", "") or ""),
                    tool_name=(str(item.get("tool_name")) if item.get("tool_name") is not None else None),
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
                    "avatar": s.avatar,
                    "avatar_icon": s.avatar_icon,
                    "avatar_color": s.avatar_color,
                    "avatar_url": s.avatar_url,
                    "tool_name": s.tool_name,
                    "config": dict(s.config or {}),
                    "code": s.code,
                }
                for s in self._items.values()
            ]
        )

    def list(self) -> list[Skill]:
        with self._lock:
            return list(self._items.values())

    def get(self, skill_id: str) -> Skill | None:
        with self._lock:
            return self._items.get(skill_id)

    def upsert(self, skill: Skill) -> Skill:
        with self._lock:
            self._items[skill.id] = skill
            self._persist()
        return skill

    def delete(self, skill_id: str) -> None:
        with self._lock:
            self._items.pop(skill_id, None)
            self._persist()


class JsonTeamRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
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
                    avatar=str(item.get("avatar", "") or str(item.get("name", "") or "T")[:1].upper()),
                    avatar_icon=str(item.get("avatar_icon", "") or ""),
                    avatar_color=str(item.get("avatar_color", "") or ""),
                    avatar_url=str(item.get("avatar_url", "") or ""),
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
                    "avatar": t.avatar,
                    "avatar_icon": t.avatar_icon,
                    "avatar_color": t.avatar_color,
                    "avatar_url": t.avatar_url,
                    "mode": t.mode,
                    "maxSteps": t.max_steps,
                }
                for t in self._items.values()
            ]
        )

    def list(self) -> list[Team]:
        with self._lock:
            return list(self._items.values())

    def get(self, team_id: str) -> Team | None:
        with self._lock:
            return self._items.get(team_id)

    def upsert(self, team: Team) -> Team:
        with self._lock:
            self._items[team.id] = team
            self._persist()
        return team

    def delete(self, team_id: str) -> None:
        with self._lock:
            self._items.pop(team_id, None)
            self._persist()


class JsonTaskRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Task] = {}
        for item in data:
            try:
                start_time_raw = item.get("startTime")
                end_time_raw = item.get("endTime")
                task = Task(
                    id=str(item["id"]),
                    title=str(item.get("title", "")),
                    description=str(item.get("description", "")),
                    team_id=str(item.get("teamId", "")),
                    status=TaskStatus(str(item.get("status", "pending"))),
                    progress=int(item.get("progress", 0)),
                    assigned_agents=[str(x) for x in (item.get("assignedAgents") or [])],
                    start_time=_parse_iso_utc(str(start_time_raw)) if start_time_raw else None,
                    end_time=_parse_iso_utc(str(end_time_raw)) if end_time_raw else None,
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
                    "startTime": t.start_time.isoformat() if t.start_time else None,
                    "endTime": t.end_time.isoformat() if t.end_time else None,
                }
                for t in self._items.values()
            ]
        )

    def list(self) -> list[Task]:
        with self._lock:
            return list(self._items.values())

    def get(self, task_id: str) -> Task | None:
        with self._lock:
            return self._items.get(task_id)

    def upsert(self, task: Task) -> Task:
        with self._lock:
            self._items[task.id] = task
            self._persist()
        return task

    def delete(self, task_id: str) -> None:
        with self._lock:
            self._items.pop(task_id, None)
            self._persist()


class JsonConversationRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: list[Message] = []
        for item in data:
            try:
                ts = str(item.get("timestamp") or "")
                dt = _parse_iso_utc(ts) if ts else datetime.now(timezone.utc).replace(microsecond=0)
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
        with self._lock:
            if task_id is None:
                return list(self._items)
            return [m for m in self._items if m.task_id == task_id]

    def add(self, message: Message) -> Message:
        with self._lock:
            self._items.append(message)
            self._persist()
        return message

    def delete_by_task(self, task_id: str) -> None:
        with self._lock:
            self._items = [m for m in self._items if m.task_id != task_id]
            self._persist()


class JsonAnalyticsRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
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
        with self._lock:
            return self._analytics

    def set(self, analytics: Analytics) -> Analytics:
        with self._lock:
            self._analytics = analytics
            self._persist()
        return analytics


class JsonWorkspaceRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, Workspace] = {}
        for item in data:
            try:
                hooks = [
                    PlatformHook(
                        id=str(h["id"]),
                        platform=str(h.get("platform", "")),
                        name=str(h.get("name", "")),
                        config=dict(h.get("config") or {}),
                        description=str(h.get("description", "")),
                        enabled=bool(h.get("enabled", True)),
                    )
                    for h in (item.get("platformHooks") or [])
                ]
                ws = Workspace(
                    id=str(item["id"]),
                    name=str(item.get("name", "")),
                    description=str(item.get("description", "")),
                    team_ids=[str(x) for x in (item.get("teamIds") or [])],
                    platform_hooks=hooks,
                    created_at=_parse_iso_utc(str(item.get("createdAt", ""))) or datetime.now(timezone.utc),
                    avatar=str(item.get("avatar", "") or str(item.get("name", "") or "W")[:1].upper()),
                    avatar_icon=str(item.get("avatar_icon", "") or ""),
                    avatar_color=str(item.get("avatar_color", "") or ""),
                    avatar_url=str(item.get("avatar_url", "") or ""),
                    primary_team_id=str(item.get("primaryTeamId", "")),
                )
                self._items[ws.id] = ws
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write([
            {
                "id": w.id,
                "name": w.name,
                "description": w.description,
                "teamIds": list(w.team_ids),
                "primaryTeamId": w.primary_team_id,
                "platformHooks": [
                    {
                        "id": h.id,
                        "platform": h.platform,
                        "name": h.name,
                        "config": dict(h.config),
                        "description": h.description,
                        "enabled": h.enabled,
                    }
                    for h in w.platform_hooks
                ],
                "createdAt": w.created_at.isoformat(),
                "avatar": w.avatar,
                "avatar_icon": w.avatar_icon,
                "avatar_color": w.avatar_color,
                "avatar_url": w.avatar_url,
            }
            for w in self._items.values()
        ])

    def list(self) -> list[Workspace]:
        with self._lock:
            return list(self._items.values())

    def get(self, workspace_id: str) -> Workspace | None:
        with self._lock:
            return self._items.get(workspace_id)

    def upsert(self, workspace: Workspace) -> Workspace:
        with self._lock:
            self._items[workspace.id] = workspace
            self._persist()
        return workspace

    def delete(self, workspace_id: str) -> None:
        with self._lock:
            self._items.pop(workspace_id, None)
            self._persist()


class JsonActivityFeedRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
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
        with self._lock:
            return list(self._items)

    def add(self, item: ActivityFeedItem) -> ActivityFeedItem:
        with self._lock:
            self._items.insert(0, item)
            self._persist()
        return item


class JsonConnectionRepository:
    def __init__(self, store: JsonFileStore):
        self._store = store
        self._lock = threading.RLock()
        data = store.read()
        if not isinstance(data, list):
            data = []
        self._items: dict[str, ThirdPartyConnection] = {}
        for item in data:
            try:
                conn = ThirdPartyConnection(
                    id=str(item["id"]),
                    platform=str(item.get("platform", "")),
                    name=str(item.get("name", "")),
                    config=dict(item.get("config", {})),
                    description=str(item.get("description", "")),
                    created_at=datetime.fromisoformat(item["created_at"]).replace(tzinfo=timezone.utc)
                    if item.get("created_at")
                    else datetime.now(timezone.utc),
                )
                self._items[conn.id] = conn
            except Exception:
                continue

    def _persist(self) -> None:
        self._store.write(
            [
                {
                    "id": c.id,
                    "platform": c.platform,
                    "name": c.name,
                    "config": dict(c.config),
                    "description": c.description,
                    "created_at": c.created_at.isoformat(),
                }
                for c in self._items.values()
            ]
        )

    def list(self) -> list[ThirdPartyConnection]:
        with self._lock:
            return list(self._items.values())

    def get(self, conn_id: str) -> ThirdPartyConnection | None:
        with self._lock:
            return self._items.get(conn_id)

    def upsert(self, conn: ThirdPartyConnection) -> ThirdPartyConnection:
        with self._lock:
            self._items[conn.id] = conn
            self._persist()
        return conn

    def delete(self, conn_id: str) -> None:
        with self._lock:
            self._items.pop(conn_id, None)
            self._persist()
