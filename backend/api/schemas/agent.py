from __future__ import annotations

from pydantic import BaseModel, Field


class SkillSchema(BaseModel):
    id: str
    name: str
    description: str = ""
    third_party: str = ""
    tool_name: str | None = None
    kind: str = "integration"
    config: dict = Field(default_factory=dict)
    avatar: str = ""
    avatar_icon: str = ""
    avatar_color: str = ""
    avatar_url: str = ""
    code: str | None = None

    @staticmethod
    def from_domain(s) -> "SkillSchema":
        return SkillSchema(
            id=s.id,
            name=s.name,
            description=s.description,
            third_party=s.third_party,
            tool_name=s.tool_name,
            kind=s.kind,
            config=dict(s.config or {}),
            avatar=getattr(s, "avatar", "") or "",
            avatar_icon=getattr(s, "avatar_icon", "") or "",
            avatar_color=getattr(s, "avatar_color", "") or "",
            avatar_url=getattr(s, "avatar_url", "") or "",
            code=s.code,
        )


class AgentSchema(BaseModel):
    id: str
    name: str
    role: str
    description: str
    skill_ids: list[str] = Field(default_factory=list)
    skills: list[SkillSchema] = Field(default_factory=list)
    status: str
    avatar: str
    avatar_icon: str = ""
    avatar_color: str = ""
    avatar_url: str = ""
    system_prompt: str = ""
    subagent_enabled: bool = False

    @staticmethod
    def from_domain(a, skills: list = None) -> "AgentSchema":
        return AgentSchema(
            id=a.id,
            name=a.name,
            role=a.role,
            description=a.description,
            skill_ids=list(getattr(a, "skill_ids", [])),
            skills=[SkillSchema.from_domain(s) for s in (skills or [])],
            status=a.status.value if hasattr(a.status, "value") else str(a.status),
            avatar=a.avatar,
            avatar_icon=getattr(a, "avatar_icon", "") or "",
            avatar_color=getattr(a, "avatar_color", "") or "",
            avatar_url=getattr(a, "avatar_url", "") or "",
            system_prompt=getattr(a, "system_prompt", "") or "",
            subagent_enabled=bool(getattr(a, "subagent_enabled", False)),
        )


class UpsertAgentRequest(BaseModel):
    id: str | None = None
    name: str
    role: str
    description: str = ""
    skill_ids: list[str] = Field(default_factory=list)
    status: str = "idle"
    avatar: str | None = None
    avatar_icon: str | None = None
    avatar_color: str | None = None
    avatar_url: str | None = None
    system_prompt: str | None = None
    subagent_enabled: bool = False
