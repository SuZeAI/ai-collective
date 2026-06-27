from __future__ import annotations

from typing import Any
from pydantic import BaseModel


class PlatformHookSchema(BaseModel):
    id: str
    platform: str
    name: str
    config: dict[str, Any] = {}
    description: str = ""
    enabled: bool = True

    @staticmethod
    def from_domain(h) -> "PlatformHookSchema":
        return PlatformHookSchema(
            id=h.id,
            platform=h.platform,
            name=h.name,
            config=dict(h.config or {}),
            description=h.description,
            enabled=h.enabled,
        )


class CompanySchema(BaseModel):
    id: str
    name: str
    description: str
    departmentIds: list[str]
    primaryDepartmentId: str
    platformHooks: list[PlatformHookSchema]
    createdAt: str
    type: str = "general"
    avatar: str = ""
    avatar_icon: str = ""
    avatar_color: str = ""
    avatar_url: str = ""
    owner_id: str = "default"

    @staticmethod
    def from_domain(w) -> "CompanySchema":
        return CompanySchema(
            id=w.id,
            name=w.name,
            description=w.description,
            departmentIds=list(w.department_ids),
            primaryDepartmentId=w.primary_department_id or "",
            platformHooks=[PlatformHookSchema.from_domain(h) for h in w.platform_hooks],
            createdAt=w.created_at.isoformat(),
            type=getattr(w, "type", "general") or "general",
            avatar=w.avatar or "",
            avatar_icon=w.avatar_icon or "",
            avatar_color=w.avatar_color or "",
            avatar_url=w.avatar_url or "",
            owner_id=getattr(w, "owner_id", "default") or "default",
        )


class UpsertPlatformHookRequest(BaseModel):
    id: str | None = None
    platform: str
    name: str
    config: dict[str, Any] = {}
    description: str = ""
    enabled: bool = True


class UpsertWorkspaceRequest(BaseModel):
    id: str | None = None
    name: str
    description: str = ""
    departmentIds: list[str] = []
    primaryDepartmentId: str = ""
    platformHooks: list[UpsertPlatformHookRequest] = []
    type: str | None = None
    avatar: str | None = None
    avatar_icon: str | None = None
    avatar_color: str | None = None
    avatar_url: str | None = None
