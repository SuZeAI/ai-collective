from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends

from server.api.deps import current_owner_id_dep, get_staff_service, get_meeting_service, get_department_service
from server.api.ownership import require_deletable, require_modifiable
from server.api.schemas.department import DepartmentSchema, UpsertDepartmentRequest
from server.app.service.department_activation import activate_department_staff, seed_department_kickoff_messages
from server.app.service.staff_service import StaffService
from server.app.service.meeting_service import MeetingService
from server.app.service.department_service import DepartmentService
from server.domain.models import Department, is_owned_by


router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("", response_model=list[DepartmentSchema])
def list_departments(
    service: DepartmentService = Depends(get_department_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> list[DepartmentSchema]:
    return [
        DepartmentSchema.from_domain(t)
        for t in service.list_departments()
        if is_owned_by(owner_id, t.owner_id)
    ]


@router.post("", response_model=DepartmentSchema)
def upsert_department(
    req: UpsertDepartmentRequest,
    service: DepartmentService = Depends(get_department_service),
    staff_service: StaffService = Depends(get_staff_service),
    conv_service: MeetingService = Depends(get_meeting_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> DepartmentSchema:
    department_id = req.id or f"team_{uuid4().hex}"
    is_new_team = req.id is None
    existing = service.try_get_department(department_id) if req.id else None
    require_modifiable(existing, owner_id, f"Department '{department_id}'")
    active_tasks = req.activeTasks
    if is_new_team and req.staff:
        # A newly created department starts in active mode.
        active_tasks = max(1, req.activeTasks)

    department = Department(
        id=department_id,
        name=req.name,
        description=req.description or "Custom department",
        staff=list(req.staff),
        active_tasks=active_tasks,
        avatar=((req.avatar or "").strip() or req.name[:1].upper() or "T"),
        avatar_icon=(req.avatar_icon or "").strip(),
        avatar_color=(req.avatar_color or "").strip(),
        avatar_url=(req.avatar_url or "").strip(),
        mode=req.mode or "sequential",
        max_steps=req.maxSteps or 6,
        owner_id=existing.owner_id if existing else owner_id,
        flow=req.flow if req.flow is not None else (existing.flow if existing else None),
    )
    saved = service.upsert_department(department)

    if is_new_team:
        activate_department_staff(saved.staff, staff_service)
        seed_department_kickoff_messages(saved, staff_service, conv_service)

    return DepartmentSchema.from_domain(saved)


@router.delete("/{department_id}")
def delete_department(
    department_id: str,
    service: DepartmentService = Depends(get_department_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> dict:
    existing = service.try_get_department(department_id)
    require_deletable(existing, owner_id, f"Department '{department_id}'")
    service.delete_department(department_id)
    return {"deleted": True}
