from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query

from server.api.avatars import sanitize_avatar_fields
from server.api.schemas.staff import (
    GenerateStaffRequest,
    GenerateStaffResponse,
    StaffSchema,
    UpsertStaffRequest,
)
from server.app.service.company_service import CompanyService
from server.app.service.llm_service import LLMService
from server.app.service.skill_service import SkillService
from server.app.service.staff_service import StaffService
from server.api.deps import (
    current_owner_id_dep,
    get_company_service,
    get_llm_service,
    get_skill_service,
    get_staff_service,
)
from server.api.ownership import require_deletable, require_modifiable
from server.domain.enums import StaffStatus
from server.domain.models import CATALOG_COMPANY_ID, Staff, is_visible_to
from server.domain.prompt.staff_system_prompt import build_staff_system_prompt
from server.share.log import get_logger


router = APIRouter(prefix="/staff", tags=["staff"])

_ROLE_FALLBACK = "AI Specialist"


def _build_staff_generate_system_prompt() -> str:
    return (
        "You design AI staff members (job personas) for a virtual company, based on the "
        "company's available skill/tool catalog and the user's request. Respond with a "
        "SINGLE JSON object and nothing else:\n"
        '{\n  "name": "<a plausible human name for this staff member>",\n'
        '  "role": "<concise job title>",\n  "description": "<what this staff member does, 1-2 sentences>",\n'
        '  "skillIds": ["<skill id>", ...]\n}\n\n'
        "Rules:\n- skillIds MUST only contain ids taken from the provided catalog. Pick the "
        "skills this staff member actually needs; it is fine to leave this empty if none fit.\n"
        "- The role should fit the chosen skills and the user's request.\n"
        "- Keep description concise and action-oriented."
    )


def _sanitize_staff_draft(raw: dict, known_skill_ids: set[str]) -> GenerateStaffResponse:
    skill_ids: list[str] = []
    raw_skill_ids = raw.get("skillIds")
    if isinstance(raw_skill_ids, list):
        for sid in raw_skill_ids:
            sid = str(sid)
            if sid in known_skill_ids and sid not in skill_ids:
                skill_ids.append(sid)
    return GenerateStaffResponse(
        name=str(raw.get("name") or "").strip() or "New Staff",
        role=str(raw.get("role") or "").strip() or _ROLE_FALLBACK,
        description=str(raw.get("description") or "").strip(),
        skillIds=skill_ids,
    )


@router.get("", response_model=list[StaffSchema])
def list_staff(
    company_id: str | None = Query(default=None),
    service: StaffService = Depends(get_staff_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> list[StaffSchema]:
    # Batch-load skills once instead of N+1 per-staff lookups.
    return [
        StaffSchema.from_domain(staff, skills)
        for staff, skills in service.list_staff_with_skills()
        if is_visible_to(owner_id, staff.owner_id)
        and (company_id is None or staff.company_id == company_id)
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
    avatar_icon, avatar_color, avatar_url = sanitize_avatar_fields(
        req.avatar_icon, req.avatar_color, req.avatar_url
    )

    staff = Staff(
        id=staff_id,
        name=req.name,
        role=req.role,
        description=req.description or f"{req.role} staff",
        skill_ids=req.skill_ids or [],
        status=StaffStatus(req.status),
        avatar=avatar,
        avatar_icon=avatar_icon,
        avatar_color=avatar_color,
        avatar_url=avatar_url,
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
        company_id=existing.company_id if existing else (req.company_id or CATALOG_COMPANY_ID),
    )
    saved = service.upsert_staff(staff)
    skills = service.get_staff_skills(saved.id)
    return StaffSchema.from_domain(saved, skills)


@router.post("/generate", response_model=GenerateStaffResponse)
async def generate_staff(
    req: GenerateStaffRequest,
    skill_service: SkillService = Depends(get_skill_service),
    llm_service: LLMService | None = Depends(get_llm_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> GenerateStaffResponse:
    if llm_service is None:
        raise HTTPException(status_code=503, detail="LLM provider is not configured")
    if not req.prompt.strip():
        raise HTTPException(status_code=422, detail="Prompt is required")

    catalog = [
        skill
        for skill in skill_service.list_skills()
        if is_visible_to(owner_id, skill.owner_id)
        and (req.company_id is None or skill.company_id == req.company_id)
    ]
    lines = [f"- id={skill.id} | {skill.name} ({skill.kind}): {skill.description or ''}" for skill in catalog]

    user = (
        "Available skill/tool catalog for this company:\n"
        + ("\n".join(lines) if lines else "(no skills registered yet)")
        + f"\n\nUser's request:\n{req.prompt.strip()}"
    )

    try:
        data = await llm_service.get_provider().generate_json(
            system=_build_staff_generate_system_prompt(), user=user
        )
    except Exception as exc:
        get_logger().exception("Staff generation failed")
        raise HTTPException(status_code=502, detail=f"Generation failed: {exc}")

    known_skill_ids = {skill.id for skill in catalog}
    return _sanitize_staff_draft(data if isinstance(data, dict) else {}, known_skill_ids)


@router.get("/{staff_id}/impact")
def get_staff_delete_impact(
    staff_id: str,
    company_service: CompanyService = Depends(get_company_service),
) -> dict:
    """Preview which companies/departments/projects/tasks a delete would affect."""
    return company_service.preview_staff_delete(staff_id)


@router.delete("/{staff_id}")
def delete_staff(
    staff_id: str,
    service: StaffService = Depends(get_staff_service),
    company_service: CompanyService = Depends(get_company_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> dict:
    existing = service.try_get_staff(staff_id)
    require_deletable(existing, owner_id, f"Staff '{staff_id}'")
    return company_service.delete_staff_cascade(staff_id, existing, owner_id)
