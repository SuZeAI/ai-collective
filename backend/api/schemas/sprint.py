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


class SprintSchema(BaseModel):
    id: str
    projectId: str
    name: str
    goal: str = ""
    status: str = "planned"
    startDate: str | None = None
    endDate: str | None = None
    owner_id: str = "default"

    @staticmethod
    def from_domain(s) -> "SprintSchema":
        status = getattr(s, "status", "planned")
        return SprintSchema(
            id=s.id,
            projectId=s.project_id,
            name=s.name,
            goal=getattr(s, "goal", "") or "",
            status=status.value if hasattr(status, "value") else str(status),
            startDate=_to_utc_iso(getattr(s, "start_date", None)),
            endDate=_to_utc_iso(getattr(s, "end_date", None)),
            owner_id=getattr(s, "owner_id", "default") or "default",
        )


class UpsertSprintRequest(BaseModel):
    id: str | None = None
    projectId: str
    name: str
    goal: str = ""
    status: str = "planned"
    startDate: str | None = None
    endDate: str | None = None
