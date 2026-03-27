from __future__ import annotations

from typing import Any, Literal

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
        fallback_avatar = (getattr(s, "avatar", "") or getattr(s, "name", "") or "S")[:1].upper()
        return SkillSchema(
            id=s.id,
            name=s.name,
            description=s.description,
            third_party=s.third_party,
            tool_name=s.tool_name,
            kind=s.kind,
            config=dict(s.config or {}),
            avatar=fallback_avatar,
            avatar_icon=getattr(s, "avatar_icon", "") or "",
            avatar_color=getattr(s, "avatar_color", "") or "",
            avatar_url=getattr(s, "avatar_url", "") or "",
            code=s.code,
        )


class UpsertSkillRequest(BaseModel):
    id: str | None = None
    name: str
    description: str = ""
    third_party: str = ""
    tool_name: str | None = None
    kind: str = "integration"
    config: dict = Field(default_factory=dict)
    avatar: str | None = None
    avatar_icon: str | None = None
    avatar_color: str | None = None
    avatar_url: str | None = None
    code: str | None = None


class SkillToolConfigFieldSchema(BaseModel):
    key: str
    label: str
    input: Literal["text", "textarea", "select", "boolean"] = "text"
    required: bool = False
    default: Any = None
    placeholder: str = ""
    options: list[str] = Field(default_factory=list)
    rows: int | None = None
    description: str = ""


class SkillToolPresetSchema(BaseModel):
    tool_name: str
    label: str
    third_party: str
    config_fields: list[SkillToolConfigFieldSchema] = Field(default_factory=list)
