from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends

from server.api.schemas.staff import StaffSchema, UpsertStaffRequest
from server.app.service.staff_service import StaffService
from server.api.deps import current_owner_id_dep, get_staff_service
from server.api.ownership import require_deletable, require_modifiable
from server.domain.enums import StaffStatus
from server.domain.models import Staff, is_owned_by
from server.domain.prompt.staff_system_prompt import build_staff_system_prompt


router = APIRouter(prefix="/staff", tags=["staff"])


@router.get("", response_model=list[StaffSchema])
def list_staff(
    service: StaffService = Depends(get_staff_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> list[StaffSchema]:
    # Batch-load skills once instead of N+1 per-staff lookups.
    return [
        StaffSchema.from_domain(staff, skills)
        for staff, skills in service.list_staff_with_skills()
        if is_owned_by(owner_id, staff.owner_id)
    ]


@router.post("", response_model=StaffSchema)
def upsert_staff(
    req: UpsertStaffRequest,
    service: StaffService = Depends(get_staff_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> StaffSchema:
    staff_id = req.id or f"agent_{uuid4().hex}"
    existing = service.try_get_staff(staff_id) if req.id else None
    require_modifiable(existing, owner_id, f"Staff '{staff_id}'")
    avatar = req.avatar or (req.name[:1].upper() if req.name else "A")

    staff = Staff(
        id=staff_id,
        name=req.name,
        role=req.role,
        description=req.description or f"{req.role} staff",
        skill_ids=req.skill_ids or [],
        status=StaffStatus(req.status),
        avatar=avatar,
        avatar_icon=(req.avatar_icon or "").strip(),
        avatar_color=(req.avatar_color or "").strip(),
        avatar_url=(req.avatar_url or "").strip(),
        system_prompt=(
            req.system_prompt.strip()
            if isinstance(req.system_prompt, str) and req.system_prompt.strip()
            else build_staff_system_prompt(
                name=req.name,
                role=req.role,
                description=req.description or f"{req.role} staff",
            )
        ),
        subagent_enabled=req.subagent_enabled,
        owner_id=existing.owner_id if existing else owner_id,
    )
    saved = service.upsert_staff(staff)
    skills = service.get_staff_skills(saved.id)
    return StaffSchema.from_domain(saved, skills)


@router.delete("/{staff_id}")
def delete_staff(
    staff_id: str,
    service: StaffService = Depends(get_staff_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> dict:
    existing = service.try_get_staff(staff_id)
    require_deletable(existing, owner_id, f"Staff '{staff_id}'")
    service.delete_staff(staff_id)
    return {"deleted": True}
