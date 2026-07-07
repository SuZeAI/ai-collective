from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel


def _to_utc_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat()


class ProjectSchema(BaseModel):
    id: str
    key: str
    name: str
    description: str = ""
    leadId: str = ""
    plannerStaffId: str = ""
    plannerSystemPrompt: str = ""
    issueCounter: int = 0
    createdAt: str | None = None
    avatar: str = ""
    avatar_icon: str = ""
    avatar_color: str = ""
    avatar_url: str = ""
    owner_id: str = "default"

    @staticmethod
    def from_domain(p) -> "ProjectSchema":
        return ProjectSchema(
            id=p.id,
            key=p.key,
            name=p.name,
            description=p.description,
            leadId=getattr(p, "lead_id", "") or "",
            plannerStaffId=getattr(p, "planner_staff_id", "") or "",
            plannerSystemPrompt=getattr(p, "planner_system_prompt", "") or "",
            issueCounter=getattr(p, "issue_counter", 0) or 0,
            createdAt=_to_utc_iso(getattr(p, "created_at", None)),
            avatar=getattr(p, "avatar", "") or "",
            avatar_icon=getattr(p, "avatar_icon", "") or "",
            avatar_color=getattr(p, "avatar_color", "") or "",
            avatar_url=getattr(p, "avatar_url", "") or "",
            owner_id=getattr(p, "owner_id", "default") or "default",
        )


class UpsertProjectRequest(BaseModel):
    id: str | None = None
    key: str
    name: str
    description: str = ""
    leadId: str = ""
    plannerStaffId: str = ""
    plannerSystemPrompt: str = ""
    avatar: str = ""
    avatar_icon: str = ""
    avatar_color: str = ""
    avatar_url: str = ""
