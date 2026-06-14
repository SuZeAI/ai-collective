from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class TeamSchema(BaseModel):
    id: str
    name: str
    description: str
    agents: list[str]
    activeTasks: int
    avatar: str = ""
    avatar_icon: str = ""
    avatar_color: str = ""
    avatar_url: str = ""
    mode: str = "sequential"
    maxSteps: int = 6
    owner_id: str = "default"
    flow: dict[str, Any] | None = None

    @staticmethod
    def from_domain(t) -> "TeamSchema":
        return TeamSchema(
            id=t.id,
            name=t.name,
            description=t.description,
            agents=list(t.agents),
            activeTasks=t.active_tasks,
            avatar=getattr(t, "avatar", "") or "",
            avatar_icon=getattr(t, "avatar_icon", "") or "",
            avatar_color=getattr(t, "avatar_color", "") or "",
            avatar_url=getattr(t, "avatar_url", "") or "",
            mode=t.mode,
            maxSteps=t.max_steps,
            owner_id=getattr(t, "owner_id", "default") or "default",
            flow=getattr(t, "flow", None),
        )


class UpsertTeamRequest(BaseModel):
    id: str | None = None
    name: str
    description: str = ""
    agents: list[str]
    activeTasks: int = 0
    avatar: str | None = None
    avatar_icon: str | None = None
    avatar_color: str | None = None
    avatar_url: str | None = None
    mode: str = "sequential"
    maxSteps: int = 6
    flow: dict[str, Any] | None = None
