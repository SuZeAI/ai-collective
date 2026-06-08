from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from backend.domain.enums import AgentStatus, TaskStatus

# Ownership scoping: every user-creatable entity carries an owner_id.
# "default" marks shared/system-seeded items visible to everyone;
# "guest" is the shared scope for unauthenticated (guest-mode) visitors.
DEFAULT_OWNER_ID = "default"
GUEST_OWNER_ID = "guest"


def is_visible_to(owner_id: str, entity_owner_id: str) -> bool:
    """An entity is visible to a user if it is shared ("default") or theirs."""
    return entity_owner_id in (DEFAULT_OWNER_ID, owner_id)


def can_delete(owner_id: str, entity_owner_id: str) -> bool:
    """Deleting is owner-only: shared "default" items can only be deleted by
    the default (admin) account itself — never by regular users or guests."""
    return entity_owner_id == owner_id


# Editing shared "default" items follows the same owner-only rule as deleting.
# (Task status transitions — start/pause/stop — are exempted at the router.)
can_modify = can_delete


@dataclass(frozen=True, slots=True)
class Skill:
    id: str
    name: str
    description: str
    third_party: str
    kind: str  # e.g. "integration" | "custom-js"
    config: dict[str, Any]
    avatar: str = ""
    avatar_icon: str = ""
    avatar_color: str = ""
    avatar_url: str = ""
    tool_name: str | None = None  # Linked tool (e.g. "websearch", "browser", "bash")
    code: str | None = None
    owner_id: str = DEFAULT_OWNER_ID


@dataclass(frozen=True, slots=True)
class Agent:
    id: str
    name: str
    role: str
    description: str
    skill_ids: list[str]
    status: AgentStatus
    avatar: str
    avatar_icon: str = ""
    avatar_color: str = ""
    avatar_url: str = ""
    system_prompt: str = ""
    subagent_enabled: bool = False
    owner_id: str = DEFAULT_OWNER_ID


@dataclass(frozen=True, slots=True)
class Team:
    id: str
    name: str
    description: str
    agents: list[str]
    active_tasks: int
    avatar: str = ""
    avatar_icon: str = ""
    avatar_color: str = ""
    avatar_url: str = ""
    mode: str = "sequential"  # "sequential" or "mesh"
    max_steps: int = 6
    owner_id: str = DEFAULT_OWNER_ID


@dataclass(frozen=True, slots=True)
class Task:
    id: str
    title: str
    description: str
    team_id: str
    status: TaskStatus
    progress: int
    assigned_agents: list[str]
    start_time: datetime | None = None
    end_time: datetime | None = None
    owner_id: str = DEFAULT_OWNER_ID


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
class PlatformHook:
    id: str
    platform: str       # "telegram" | "discord" | "slack" | "teams" | "whatsapp_business" | ...
    name: str
    config: dict[str, Any]   # platform-specific tokens/keys
    description: str = ""
    enabled: bool = True


@dataclass(frozen=True, slots=True)
class Workspace:
    id: str
    name: str
    description: str
    team_ids: list[str]
    platform_hooks: list[PlatformHook]
    created_at: datetime
    avatar: str = ""
    avatar_icon: str = ""
    avatar_color: str = ""
    avatar_url: str = ""
    primary_team_id: str = ""
    owner_id: str = DEFAULT_OWNER_ID


@dataclass(frozen=True, slots=True)
class OfficeBuilderSession:
    """A saved Office Builder chat session (history + draft plan)."""
    id: str
    title: str
    messages: list[dict[str, Any]]   # [{"role": "user"|"assistant", "content": str}]
    plan: dict[str, Any] | None      # draft OfficePlan, if one has been generated
    created_at: datetime
    updated_at: datetime
    workspace_id: str = ""           # set once the plan has been applied
    owner_id: str = DEFAULT_OWNER_ID


@dataclass(frozen=True, slots=True)
class ThirdPartyConnection:
    id: str
    platform: str
    name: str
    config: dict[str, Any]
    created_at: datetime
    description: str = ""


@dataclass
class ToolResult:
    """Result returned from tool operations"""
    success: bool
    data: dict[str, Any] | None = None
    message: str | None = None


@dataclass(frozen=True, slots=True)
class SimulationStep:
    agent: str
    msg: str
    delay_ms: int
    phase: int | None = None  # 1..4 (Planning/Execution/Review/Complete)


@dataclass(frozen=True, slots=True)
class TokenUsageRecord:
    """One LLM invocation's token usage, recorded for admin monitoring."""
    id: str
    provider: str            # "anthropic" | "openai" | "google" | "open_weight"
    model: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    user_id: str             # who triggered the call; "system" for background work
    timestamp: datetime


@dataclass(frozen=True, slots=True)
class ModelPricing:
    """Admin-editable price card for one model (USD per 1M tokens)."""
    model: str
    provider: str
    input_price_per_million: float
    output_price_per_million: float


@dataclass
class User:
    id: str
    name: str
    email: str
    hashed_password: str = field(repr=False)
    role: str = "user"
    joined_at: str = ""
    avatar: str = ""
    provider: str = "local"   # "local" | "google" | "github" | ...
    provider_id: str = field(default="", repr=False)  # OAuth provider's unique user ID (e.g. Google sub)
