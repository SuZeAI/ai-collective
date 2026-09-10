from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends

from server.api.deps import current_owner_id_dep, get_epic_service, get_project_service
from server.api.ownership import require_deletable, require_modifiable
from server.api.schemas.epic import EpicSchema, UpsertEpicRequest
from server.app.service.epic_service import EpicService
from server.app.service.project_service import ProjectService
from server.domain.enums import TaskStatus
from server.domain.errors import NotFoundError
from server.domain.models import Epic, is_owned_by, is_visible_to
from server.infra.repositories._helpers import parse_iso_utc as _parse_iso

router = APIRouter(prefix="/epics", tags=["epics"])


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
    require_modifiable(existing, owner_id, f"Epic '{epic_id}'")

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
    require_deletable(existing, owner_id, f"Epic '{epic_id}'")
    service.delete_epic(epic_id)
    return {"deleted": True}
