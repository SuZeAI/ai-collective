from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from backend.api.deps import current_owner_id_dep, get_epic_service, get_project_service
from backend.api.schemas.epic import EpicSchema, UpsertEpicRequest
from backend.application.service.epic_service import EpicService
from backend.application.service.project_service import ProjectService
from backend.domain.enums import TaskStatus
from backend.domain.errors import NotFoundError
from backend.domain.models import Epic, can_delete, can_modify, is_owned_by, is_visible_to

router = APIRouter(prefix="/epics", tags=["epics"])


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


@router.get("", response_model=list[EpicSchema])
def list_epics(
    service: EpicService = Depends(get_epic_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> list[EpicSchema]:
    return [
        EpicSchema.from_domain(e)
        for e in service.list_epics()
        if is_owned_by(owner_id, e.owner_id)
    ]


@router.post("", response_model=EpicSchema)
def upsert_epic(
    req: UpsertEpicRequest,
    service: EpicService = Depends(get_epic_service),
    project_service: ProjectService = Depends(get_project_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> EpicSchema:
    epic_id = req.id or f"epic_{uuid4().hex}"
    existing = service.try_get_epic(epic_id) if req.id else None
    if existing is not None and not is_visible_to(owner_id, existing.owner_id):
        raise NotFoundError(f"Epic '{epic_id}' not found")
    if existing is not None and not can_modify(owner_id, existing.owner_id):
        raise HTTPException(
            status_code=403,
            detail="Only the default (admin) account can edit shared default items",
        )

    try:
        status = TaskStatus(req.status)
    except ValueError:
        status = TaskStatus.pending

    if existing is not None:
        key = existing.key
    else:
        project = project_service.get_project(req.projectId)
        if not is_visible_to(owner_id, project.owner_id):
            raise NotFoundError(f"Project '{req.projectId}' not found")
        key = f"{project.key}-{project_service.allocate_issue_number(req.projectId)}"

    epic = Epic(
        id=epic_id,
        project_id=req.projectId,
        key=key,
        title=req.title,
        description=req.description,
        status=status,
        color=req.color,
        start_date=_parse_iso(req.startDate),
        due_date=_parse_iso(req.dueDate),
        owner_id=existing.owner_id if existing else owner_id,
    )
    saved = service.upsert_epic(epic)
    return EpicSchema.from_domain(saved)


@router.delete("/{epic_id}")
def delete_epic(
    epic_id: str,
    service: EpicService = Depends(get_epic_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> dict:
    existing = service.try_get_epic(epic_id)
    if existing is not None and not is_visible_to(owner_id, existing.owner_id):
        raise NotFoundError(f"Epic '{epic_id}' not found")
    if existing is not None and not can_delete(owner_id, existing.owner_id):
        raise HTTPException(
            status_code=403,
            detail="Only the default (admin) account can delete shared default items",
        )
    service.delete_epic(epic_id)
    return {"deleted": True}
