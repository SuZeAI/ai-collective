from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from backend.domain.enums import AgentStatus, IssueType, SprintStatus, TaskPriority, TaskStatus

# Ownership scoping: every user-creatable entity carries an owner_id.
# "default" marks shared/system-seeded items visible to everyone;
# "guest" is the shared scope for unauthenticated (guest-mode) visitors.
DEFAULT_OWNER_ID = "default"
GUEST_OWNER_ID = "guest"


def is_visible_to(owner_id: str, entity_owner_id: str) -> bool:
    """An entity is visible to a user if it is shared ("default") or theirs.

    Used for access control (read/copy): a user may still *read* shared
    "default" items so the marketplace can clone them into their own scope.
    """
    return entity_owner_id in (DEFAULT_OWNER_ID, owner_id)


def is_owned_by(owner_id: str, entity_owner_id: str) -> bool:
    """Strict ownership: True only when the user created the entity.

    The per-user list pages use this so shared "default" items no longer
    appear there — they are discovered and cloned via the Marketplace.
    (The admin account acts in the DEFAULT_OWNER_ID scope, so it still sees
    every default item through this same check.)
    """
    return entity_owner_id == owner_id


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
    instruction: str = ""  # User-facing guide: how to get an API key / enable / use this skill


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
    mode: str = "sequential"  # "sequential" | "mesh" | "ring" | "supervisor" | "tree" | "custom"
    max_steps: int = 6
    owner_id: str = DEFAULT_OWNER_ID
    # For mode == "custom": the user-drawn flow graph (React Flow nodes/edges +
    # positions). Stored opaquely so the editor can restore the layout, and the
    # edges drive the custom orchestrator. None for every other mode.
    flow: dict[str, Any] | None = None


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
    # Jira-style project fields.
    priority: TaskPriority = TaskPriority.medium
    due_date: datetime | None = None
    labels: list[str] = field(default_factory=list)
    # Single staff (agent id) responsible when a task is assigned to a person
    # rather than a whole department. team_id may be empty in that case.
    assignee_id: str | None = None
    # User-authored comment thread, kept separate from the agent live-chat
    # transcript. Each item: {id, author_id, content, created_at}.
    comments: list[dict[str, Any]] = field(default_factory=list)
    # Jira-style organisation fields. A Task IS the "Issue" in the UI; the
    # domain name stays Task so the run engine / queue / registry are untouched.
    project_id: str = ""
    issue_type: IssueType = IssueType.task
    issue_key: str = ""              # "NUC-42", assigned once at create time
    epic_id: str | None = None
    sprint_id: str | None = None
    story_points: int | None = None


@dataclass(frozen=True, slots=True)
class Project:
    """A Jira-style project: a container for issues with its own key namespace."""
    id: str
    key: str                         # "NUC" — uppercase, unique within owner scope
    name: str
    description: str = ""
    lead_id: str = ""                # agent id acting as project lead
    planner_agent_id: str = ""       # which Agent is the configurable "planner"
    planner_system_prompt: str = ""  # optional override of the planner agent's prompt
    issue_counter: int = 0           # monotonic source of the "-N" suffix in issue keys
    created_at: datetime | None = None
    avatar: str = ""
    avatar_icon: str = ""
    avatar_color: str = ""
    avatar_url: str = ""
    owner_id: str = DEFAULT_OWNER_ID


@dataclass(frozen=True, slots=True)
class Epic:
    id: str
    project_id: str
    key: str                         # uses the same project counter (e.g. NUC-1)
    title: str
    description: str = ""
    status: TaskStatus = TaskStatus.pending
    color: str = ""
    start_date: datetime | None = None
    due_date: datetime | None = None
    owner_id: str = DEFAULT_OWNER_ID


@dataclass(frozen=True, slots=True)
class Sprint:
    id: str
    project_id: str
    name: str
    goal: str = ""
    status: SprintStatus = SprintStatus.planned
    start_date: datetime | None = None
    end_date: datetime | None = None
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
class LibraryDocument:
    """A document in a Business Unit's shared document library ("Kho tài liệu").

    Bytes live in the FileStore (``library/<workspace_id>/<rel_path>``); this is the
    metadata record. ``source`` is "upload" | "url" | "project".
    """
    id: str
    workspace_id: str
    name: str
    content_type: str
    size: int
    rel_path: str
    created_at: datetime
    description: str = ""
    source: str = "upload"
    source_url: str = ""
    tags: list[str] = field(default_factory=list)
    uploaded_by: str = ""
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
    agent_name: str = ""     # AI staff member that made the call; "" if unattributed
    team_id: str = ""        # department/team the run belongs to; "" if unattributed


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
