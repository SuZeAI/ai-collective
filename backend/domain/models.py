from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from backend.domain.enums import AgentStatus, TaskStatus


@dataclass(frozen=True, slots=True)
class Skill:
    id: str
    name: str
    description: str
    third_party: str
    kind: str  # e.g. "integration" | "custom-js"
    config: dict[str, Any]
    code: str | None = None


@dataclass(frozen=True, slots=True)
class Agent:
    id: str
    name: str
    role: str
    description: str
    skills: list[Skill]
    status: AgentStatus
    avatar: str
    system_prompt: str = ""


@dataclass(frozen=True, slots=True)
class Team:
    id: str
    name: str
    description: str
    agents: list[str]
    active_tasks: int


@dataclass(frozen=True, slots=True)
class Task:
    id: str
    title: str
    description: str
    team_id: str
    status: TaskStatus
    progress: int
    assigned_agents: list[str]


@dataclass(frozen=True, slots=True)
class Message:
    id: str
    agent_id: str
    content: str
    timestamp: datetime
    task_id: str | None = None


@dataclass(frozen=True, slots=True)
class Analytics:
    tasks_completed: int
    avg_completion_time: str
    team_efficiency: int
    agent_productivity: dict[str, int]


@dataclass(frozen=True, slots=True)
class ActivityFeedItem:
    id: str
    agent_id: str
    action: str
    time: str


@dataclass(frozen=True, slots=True)
class SimulationStep:
    agent: str
    msg: str
    delay_ms: int
    phase: int | None = None  # 1..4 (Planning/Execution/Review/Complete)
