from __future__ import annotations

from uuid import uuid4
from dataclasses import replace
from datetime import datetime, timezone
import time
from fastapi import APIRouter, Depends, HTTPException

from backend.api.deps import current_owner_id_dep, get_staff_service, get_meeting_service, get_department_service
from backend.api.schemas.department import DepartmentSchema, UpsertTeamRequest
from backend.app.service.staff_service import StaffService
from backend.app.service.meeting_service import MeetingService
from backend.app.service.department_service import DepartmentService
from backend.domain.enums import StaffStatus
from backend.domain.errors import NotFoundError
from backend.domain.models import Message, Department, can_delete, can_modify, is_owned_by, is_visible_to


router = APIRouter(prefix="/departments", tags=["departments"])


def _activate_department_staff(staff_ids: list[str], staff_service: StaffService) -> None:
    by_id = {s.id: s for s in staff_service.list_staff()}
    for staff_id in staff_ids:
        staff = by_id.get(staff_id)
        if staff is None:
            continue
        if staff.status != StaffStatus.active:
            staff_service.upsert_staff(replace(staff, status=StaffStatus.active))


def _seed_department_kickoff_messages(department: Department, staff_service: StaffService, conv_service: MeetingService) -> None:
    if not department.staff:
        return

    by_id = {s.id: s for s in staff_service.list_staff()}
    roster = [by_id[staff_id] for staff_id in department.staff if staff_id in by_id]
    if not roster:
        return

    lines = [
        f"Department {department.name} is now active. Let's align on goals and deliverables.",
        "I will break down responsibilities and coordinate the first execution cycle.",
        "Acknowledged. I am ready and starting my assigned part now.",
    ]
    base_ts = int(time.time() * 1000)
    task_ref = f"department:{department.id}"

    for idx, text in enumerate(lines):
        speaker = roster[idx % len(roster)]
        conv_service.add_message(
            Message(
                id=f"m{base_ts + idx}",
                staff_id=speaker.id,
                content=text,
                timestamp=datetime.now(timezone.utc).replace(microsecond=0),
                task_id=task_ref,
            )
        )


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
    req: UpsertTeamRequest,
    service: DepartmentService = Depends(get_department_service),
    staff_service: StaffService = Depends(get_staff_service),
    conv_service: MeetingService = Depends(get_meeting_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> DepartmentSchema:
    department_id = req.id or f"team_{uuid4().hex}"
    is_new_team = req.id is None
    existing = service.try_get_department(department_id) if req.id else None
    if existing is not None and not is_visible_to(owner_id, existing.owner_id):
        raise NotFoundError(f"Department '{department_id}' not found")
    if existing is not None and not can_modify(owner_id, existing.owner_id):
        raise HTTPException(status_code=403, detail="Only the default (admin) account can edit shared default items")
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
        _activate_department_staff(saved.staff, staff_service)
        _seed_department_kickoff_messages(saved, staff_service, conv_service)

    return DepartmentSchema.from_domain(saved)


@router.delete("/{department_id}")
def delete_department(
    department_id: str,
    service: DepartmentService = Depends(get_department_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> dict:
    existing = service.try_get_department(department_id)
    if existing is not None and not is_visible_to(owner_id, existing.owner_id):
        raise NotFoundError(f"Department '{department_id}' not found")
    if existing is not None and not can_delete(owner_id, existing.owner_id):
        raise HTTPException(status_code=403, detail="Only the default (admin) account can delete shared default items")
    service.delete_department(department_id)
    return {"deleted": True}
