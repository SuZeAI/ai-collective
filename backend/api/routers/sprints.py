from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from backend.api.deps import current_owner_id_dep, get_sprint_service
from backend.api.schemas.sprint import SprintSchema, UpsertSprintRequest
from backend.application.service.sprint_service import SprintService
from backend.domain.enums import SprintStatus
from backend.domain.errors import NotFoundError
from backend.domain.models import Sprint, can_delete, can_modify, is_owned_by, is_visible_to

router = APIRouter(prefix="/sprints", tags=["sprints"])


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


@router.get("", response_model=list[SprintSchema])
def list_sprints(
    service: SprintService = Depends(get_sprint_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> list[SprintSchema]:
    return [
        SprintSchema.from_domain(s)
        for s in service.list_sprints()
        if is_owned_by(owner_id, s.owner_id)
    ]


@router.post("", response_model=SprintSchema)
def upsert_sprint(
    req: UpsertSprintRequest,
    service: SprintService = Depends(get_sprint_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> SprintSchema:
    sprint_id = req.id or f"sprint_{uuid4().hex}"
    existing = service.try_get_sprint(sprint_id) if req.id else None
    if existing is not None and not is_visible_to(owner_id, existing.owner_id):
        raise NotFoundError(f"Sprint '{sprint_id}' not found")
    if existing is not None and not can_modify(owner_id, existing.owner_id):
        raise HTTPException(
            status_code=403,
            detail="Only the default (admin) account can edit shared default items",
        )

    try:
        status = SprintStatus(req.status)
    except ValueError:
        status = SprintStatus.planned

    sprint = Sprint(
        id=sprint_id,
        project_id=req.projectId,
        name=req.name,
        goal=req.goal,
        status=status,
        start_date=_parse_iso(req.startDate),
        end_date=_parse_iso(req.endDate),
        owner_id=existing.owner_id if existing else owner_id,
    )
    saved = service.upsert_sprint(sprint)
    return SprintSchema.from_domain(saved)


@router.delete("/{sprint_id}")
def delete_sprint(
    sprint_id: str,
    service: SprintService = Depends(get_sprint_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> dict:
    existing = service.try_get_sprint(sprint_id)
    if existing is not None and not is_visible_to(owner_id, existing.owner_id):
        raise NotFoundError(f"Sprint '{sprint_id}' not found")
    if existing is not None and not can_delete(owner_id, existing.owner_id):
        raise HTTPException(
            status_code=403,
            detail="Only the default (admin) account can delete shared default items",
        )
    service.delete_sprint(sprint_id)
    return {"deleted": True}
