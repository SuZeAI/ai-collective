from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class DepartmentSchema(BaseModel):
    id: str
    name: str
    description: str
    staff: list[str]
    activeTasks: int
    avatar: str = ""
    avatar_icon: str = ""
    avatar_color: str = ""
    avatar_url: str = ""
    mode: str = "sequential"
    maxSteps: int = 6
    owner_id: str = "default"
    company_id: str = "__default__"
    flow: dict[str, Any] | None = None

    @staticmethod
    def from_domain(t) -> "DepartmentSchema":
        return DepartmentSchema(
            id=t.id,
            name=t.name,
            description=t.description,
            staff=list(t.staff),
            activeTasks=t.active_tasks,
            avatar=getattr(t, "avatar", "") or "",
            avatar_icon=getattr(t, "avatar_icon", "") or "",
            avatar_color=getattr(t, "avatar_color", "") or "",
            avatar_url=getattr(t, "avatar_url", "") or "",
            mode=t.mode,
            maxSteps=t.max_steps,
            owner_id=getattr(t, "owner_id", "default") or "default",
            company_id=getattr(t, "company_id", "__default__") or "__default__",
            flow=getattr(t, "flow", None),
        )


class UpsertDepartmentRequest(BaseModel):
    id: str | None = None
    name: str
    description: str = ""
    staff: list[str]
    activeTasks: int = 0
    avatar: str | None = None
    avatar_icon: str | None = None
    avatar_color: str | None = None
    avatar_url: str | None = None
    mode: str = "sequential"
    maxSteps: int = 6
    company_id: str | None = None
    flow: dict[str, Any] | None = None
