from __future__ import annotations

from enum import Enum


class StaffStatus(str, Enum):
    active = "active"
    idle = "idle"
    thinking = "thinking"


class TaskStatus(str, Enum):
    pending = "pending"
    in_progress = "in-progress"
    in_review = "in-review"   # manual column between in-progress and completed
    paused = "paused"
    stopped = "stopped"
    completed = "completed"


class TaskPriority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class IssueType(str, Enum):
    epic = "epic"
    story = "story"
    task = "task"
    bug = "bug"
    subtask = "subtask"


class SprintStatus(str, Enum):
    planned = "planned"
    active = "active"
    completed = "completed"
