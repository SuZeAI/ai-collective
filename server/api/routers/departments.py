from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, Query

from server.api.avatars import sanitize_avatar_fields
from server.api.deps import (
    current_owner_id_dep,
    get_company_service,
    get_staff_service,
    get_meeting_service,
    get_department_service,
)
from server.api.ownership import require_deletable, require_modifiable
from server.api.schemas.department import DepartmentSchema, UpsertDepartmentRequest
from server.app.service.company_service import CompanyService
from server.app.service.department_activation import activate_department_staff, seed_department_kickoff_messages
from server.app.service.staff_service import StaffService
from server.app.service.meeting_service import MeetingService
from server.app.service.department_service import DepartmentService
from server.domain.models import CATALOG_COMPANY_ID, Department, is_visible_to


router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("", response_model=list[DepartmentSchema])
def list_departments(
    company_id: str | None = Query(default=None),
    service: DepartmentService = Depends(get_department_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> list[DepartmentSchema]:
    return [
        DepartmentSchema.from_domain(t)
        for t in service.list_departments()
        if is_visible_to(owner_id, t.owner_id)
        and (company_id is None or t.company_id == company_id)
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

    avatar_icon, avatar_color, avatar_url = sanitize_avatar_fields(
        req.avatar_icon, req.avatar_color, req.avatar_url
    )
    department = Department(
        id=department_id,
        name=req.name,
        description=req.description or "Custom department",
        staff=list(req.staff),
        active_tasks=active_tasks,
        avatar=((req.avatar or "").strip() or req.name[:1].upper() or "T"),
        avatar_icon=avatar_icon,
        avatar_color=avatar_color,
        avatar_url=avatar_url,
        mode=req.mode or "sequential",
        max_steps=req.maxSteps or 6,
        owner_id=existing.owner_id if existing else owner_id,
        company_id=existing.company_id if existing else (req.company_id or CATALOG_COMPANY_ID),
        flow=req.flow if req.flow is not None else (existing.flow if existing else None),
    )
    saved = service.upsert_department(department)

    if is_new_team:
        activate_department_staff(saved.staff, staff_service)
        seed_department_kickoff_messages(saved, staff_service, conv_service)

    return DepartmentSchema.from_domain(saved)


@router.get("/{department_id}/impact")
def get_department_delete_impact(
    department_id: str,
    company_service: CompanyService = Depends(get_company_service),
) -> dict:
    """Preview which companies a delete would affect (staff are never touched)."""
    return company_service.preview_department_delete(department_id)


@router.delete("/{department_id}")
def delete_department(
    department_id: str,
    service: DepartmentService = Depends(get_department_service),
    company_service: CompanyService = Depends(get_company_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> dict:
    existing = service.try_get_department(department_id)
    require_deletable(existing, owner_id, f"Department '{department_id}'")
    return company_service.delete_department_cascade(department_id, existing, owner_id)
