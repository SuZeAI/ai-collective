from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from server.api.schemas.company import CompanySchema
from server.domain import office_builder as domain_plan


# ─── Plan (the LLM-generated org blueprint) ─────────────────────────────────
# Wire-format mirror of server.domain.office_builder's plain dataclasses — the
# app/domain layers only ever see the domain shapes; these Pydantic models exist
# solely to validate/(de)serialize the HTTP request and response bodies.

class SkillPlan(BaseModel):
    name: str
    description: str = ""
    tool_name: str | None = None  # must reference an available tool, or None
    existing_id: str | None = None  # reuse this existing skill instead of creating one
    config: dict[str, Any] = Field(default_factory=dict)  # non-secret tool param values, pre-filled by the LLM

    def to_domain(self) -> domain_plan.SkillPlan:
        return domain_plan.SkillPlan(
            name=self.name,
            description=self.description,
            tool_name=self.tool_name,
            existing_id=self.existing_id,
            config=dict(self.config),
        )

    @staticmethod
    def from_domain(p: domain_plan.SkillPlan) -> "SkillPlan":
        return SkillPlan(
            name=p.name,
            description=p.description,
            tool_name=p.tool_name,
            existing_id=p.existing_id,
            config=dict(p.config),
        )


class StaffPlan(BaseModel):
    name: str
    role: str
    description: str = ""
    skills: list[SkillPlan] = Field(default_factory=list)
    existing_id: str | None = None  # reuse this existing staff member instead of creating one

    def to_domain(self) -> domain_plan.StaffPlan:
        return domain_plan.StaffPlan(
            name=self.name,
            role=self.role,
            description=self.description,
            skills=[s.to_domain() for s in self.skills],
            existing_id=self.existing_id,
        )

    @staticmethod
    def from_domain(p: domain_plan.StaffPlan) -> "StaffPlan":
        return StaffPlan(
            name=p.name,
            role=p.role,
            description=p.description,
            skills=[SkillPlan.from_domain(s) for s in p.skills],
            existing_id=p.existing_id,
        )


class DepartmentPlan(BaseModel):
    name: str
    description: str = ""
    mode: str = "sequential"  # sequential | mesh | ring | supervisor | tree
    staff: list[StaffPlan] = Field(default_factory=list)
    existing_id: str | None = None  # reuse this existing department instead of creating one

    def to_domain(self) -> domain_plan.DepartmentPlan:
        return domain_plan.DepartmentPlan(
            name=self.name,
            description=self.description,
            mode=self.mode,
            staff=[s.to_domain() for s in self.staff],
            existing_id=self.existing_id,
        )

    @staticmethod
    def from_domain(p: domain_plan.DepartmentPlan) -> "DepartmentPlan":
        return DepartmentPlan(
            name=p.name,
            description=p.description,
            mode=p.mode,
            staff=[StaffPlan.from_domain(s) for s in p.staff],
            existing_id=p.existing_id,
        )


class OfficePlan(BaseModel):
    name: str
    description: str = ""
    # software | marketing | research | general — chosen by the user before
    # creating; stored on the workspace as its company type.
    company_type: str = "general"
    departments: list[DepartmentPlan] = Field(default_factory=list)

    def to_domain(self) -> domain_plan.OfficePlan:
        return domain_plan.OfficePlan(
            name=self.name,
            description=self.description,
            company_type=self.company_type,
            departments=[d.to_domain() for d in self.departments],
        )

    @staticmethod
    def from_domain(p: domain_plan.OfficePlan) -> "OfficePlan":
        return OfficePlan(
            name=p.name,
            description=p.description,
            company_type=p.company_type,
            departments=[DepartmentPlan.from_domain(d) for d in p.departments],
        )


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
    companyId: str = ""
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
            companyId=s.company_id,
            owner_id=getattr(s, "owner_id", "default") or "default",
        )


class OfficeBuilderSessionSummarySchema(BaseModel):
    id: str
    title: str
    messageCount: int
    hasPlan: bool
    createdAt: str
    updatedAt: str
    companyId: str = ""
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
            companyId=s.company_id,
            owner_id=getattr(s, "owner_id", "default") or "default",
        )


class UpsertOfficeBuilderSessionRequest(BaseModel):
    id: str | None = None
    title: str = ""
    messages: list[OfficeChatMessage] = Field(default_factory=list)
    plan: OfficePlan | None = None
    companyId: str = ""


# ─── Apply (materialize the plan) ───────────────────────────────────────────

class ApplyOfficePlanRequest(BaseModel):
    plan: OfficePlan


class ApplyOfficePlanResponse(BaseModel):
    company: CompanySchema
    department_ids: list[str] = Field(default_factory=list)
    staff_ids: list[str] = Field(default_factory=list)
    skill_ids: list[str] = Field(default_factory=list)
    reused_skill_ids: list[str] = Field(default_factory=list)
    reused_staff_ids: list[str] = Field(default_factory=list)
    reused_department_ids: list[str] = Field(default_factory=list)
