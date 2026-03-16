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


class UpsertSkillRequest(BaseModel):
    id: str | None = None
    name: str
    description: str = ""
    third_party: str = ""
    kind: str = "integration"
    config: dict = Field(default_factory=dict)
    code: str | None = None
