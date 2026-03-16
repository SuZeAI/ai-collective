from __future__ import annotations

from enum import Enum


class AgentStatus(str, Enum):
    active = "active"
    idle = "idle"
    thinking = "thinking"


class TaskStatus(str, Enum):
    pending = "pending"
    in_progress = "in-progress"
    paused = "paused"
    stopped = "stopped"
    completed = "completed"
