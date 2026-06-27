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


class EpicSchema(BaseModel):
    id: str
    projectId: str
    key: str = ""
    title: str
    description: str = ""
    status: str = "pending"
    color: str = ""
    startDate: str | None = None
    dueDate: str | None = None
    owner_id: str = "default"

    @staticmethod
    def from_domain(e) -> "EpicSchema":
        status = getattr(e, "status", "pending")
        return EpicSchema(
            id=e.id,
            projectId=e.project_id,
            key=getattr(e, "key", "") or "",
            title=e.title,
            description=e.description,
            status=status.value if hasattr(status, "value") else str(status),
            color=getattr(e, "color", "") or "",
            startDate=_to_utc_iso(getattr(e, "start_date", None)),
            dueDate=_to_utc_iso(getattr(e, "due_date", None)),
            owner_id=getattr(e, "owner_id", "default") or "default",
        )


class UpsertEpicRequest(BaseModel):
    id: str | None = None
    projectId: str
    title: str
    description: str = ""
    status: str = "pending"
    color: str = ""
    startDate: str | None = None
    dueDate: str | None = None
