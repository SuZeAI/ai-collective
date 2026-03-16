from __future__ import annotations

from pydantic import BaseModel, Field


class SkillSchema(BaseModel):
    id: str
    name: str
    description: str = ""
    third_party: str = ""
    kind: str = "integration"
    config: dict = Field(default_factory=dict)
    code: str | None = None

    @staticmethod
    def from_domain(s) -> "SkillSchema":
        return SkillSchema(
            id=s.id,
            name=s.name,
            description=s.description,
            third_party=s.third_party,
            kind=s.kind,
            config=dict(s.config or {}),
            code=s.code,
        )


class AgentSchema(BaseModel):
    id: str
    name: str
    role: str
    description: str
    skills: list[SkillSchema] = Field(default_factory=list)
    status: str
    avatar: str

    @staticmethod
    def from_domain(a) -> "AgentSchema":
        return AgentSchema(
            id=a.id,
            name=a.name,
            role=a.role,
            description=a.description,
            skills=[SkillSchema.from_domain(s) for s in (getattr(a, "skills", None) or [])],
            status=a.status.value if hasattr(a.status, "value") else str(a.status),
            avatar=a.avatar,
        )


class UpsertSkillRequest(BaseModel):
    id: str | None = None
    name: str
    description: str = ""
    third_party: str = ""
    kind: str = "integration"
    config: dict = Field(default_factory=dict)
    code: str | None = None


class UpsertAgentRequest(BaseModel):
    id: str | None = None
    name: str
    role: str
    description: str = ""
    skills: list[UpsertSkillRequest] = Field(default_factory=list)
    status: str = "idle"
    avatar: str | None = None
