from __future__ import annotations

from pydantic import BaseModel, Field

from backend.api.schemas.workspace import WorkspaceSchema


# ─── Plan (the LLM-generated org blueprint) ─────────────────────────────────

class SkillPlan(BaseModel):
    name: str
    description: str = ""
    tool_name: str | None = None  # must reference an available tool, or None


class HumanPlan(BaseModel):
    name: str
    role: str
    description: str = ""
    skills: list[SkillPlan] = Field(default_factory=list)


class DepartmentPlan(BaseModel):
    name: str
    description: str = ""
    mode: str = "sequential"  # sequential | mesh | ring | supervisor | tree
    humans: list[HumanPlan] = Field(default_factory=list)


class OfficePlan(BaseModel):
    name: str
    description: str = ""
    # software | marketing | research | general — chosen by the user before
    # creating; stored on the workspace as its company type.
    company_type: str = "general"
    departments: list[DepartmentPlan] = Field(default_factory=list)


# ─── Chat (iterative plan refinement) ───────────────────────────────────────

class OfficeChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class OfficeBuilderChatRequest(BaseModel):
    messages: list[OfficeChatMessage]
    plan: OfficePlan | None = None  # current draft, if any


class OfficeBuilderChatResponse(BaseModel):
    reply: str
    plan: OfficePlan | None = None


# ─── Sessions (persisted chat history) ──────────────────────────────────────

class OfficeBuilderSessionSchema(BaseModel):
    id: str
    title: str
    messages: list[OfficeChatMessage] = Field(default_factory=list)
    plan: OfficePlan | None = None
    createdAt: str
    updatedAt: str
    workspaceId: str = ""
    owner_id: str = "default"

    @staticmethod
    def from_domain(s) -> "OfficeBuilderSessionSchema":
        return OfficeBuilderSessionSchema(
            id=s.id,
            title=s.title,
            messages=[OfficeChatMessage.model_validate(m) for m in s.messages],
            plan=OfficePlan.model_validate(s.plan) if s.plan else None,
            createdAt=s.created_at.isoformat(),
            updatedAt=s.updated_at.isoformat(),
            workspaceId=s.workspace_id,
            owner_id=getattr(s, "owner_id", "default") or "default",
        )


class OfficeBuilderSessionSummarySchema(BaseModel):
    id: str
    title: str
    messageCount: int
    hasPlan: bool
    createdAt: str
    updatedAt: str
    workspaceId: str = ""
    owner_id: str = "default"

    @staticmethod
    def from_domain(s) -> "OfficeBuilderSessionSummarySchema":
        return OfficeBuilderSessionSummarySchema(
            id=s.id,
            title=s.title,
            messageCount=len(s.messages),
            hasPlan=bool(s.plan),
            createdAt=s.created_at.isoformat(),
            updatedAt=s.updated_at.isoformat(),
            workspaceId=s.workspace_id,
            owner_id=getattr(s, "owner_id", "default") or "default",
        )


class UpsertOfficeBuilderSessionRequest(BaseModel):
    id: str | None = None
    title: str = ""
    messages: list[OfficeChatMessage] = Field(default_factory=list)
    plan: OfficePlan | None = None
    workspaceId: str = ""


# ─── Apply (materialize the plan) ───────────────────────────────────────────

class ApplyOfficePlanRequest(BaseModel):
    plan: OfficePlan


class ApplyOfficePlanResponse(BaseModel):
    workspace: WorkspaceSchema
    team_ids: list[str] = Field(default_factory=list)
    agent_ids: list[str] = Field(default_factory=list)
    skill_ids: list[str] = Field(default_factory=list)
    reused_skill_ids: list[str] = Field(default_factory=list)
