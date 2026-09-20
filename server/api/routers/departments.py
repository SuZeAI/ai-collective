from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query

from server.api.avatars import sanitize_avatar_fields
from server.api.deps import (
    current_owner_id_dep,
    get_company_service,
    get_llm_service,
    get_staff_service,
    get_meeting_service,
    get_department_service,
)
from server.api.ownership import require_deletable, require_modifiable
from server.api.schemas.department import (
    DepartmentSchema,
    GenerateDepartmentRequest,
    GenerateDepartmentResponse,
    UpsertDepartmentRequest,
)
from server.app.service.company_service import CompanyService
from server.app.service.department_activation import activate_department_staff, seed_department_kickoff_messages
from server.app.service.llm_service import LLMService
from server.app.service.staff_service import StaffService
from server.app.service.meeting_service import MeetingService
from server.app.service.department_service import DepartmentService
from server.domain.models import CATALOG_COMPANY_ID, Department, is_visible_to
from server.share.log import get_logger

_DEPARTMENT_MODES = {"sequential", "mesh", "ring", "supervisor", "tree"}


def _build_department_generate_system_prompt() -> str:
    return (
        "You design departments (teams) of AI staff for a virtual company. Given the "
        "company's available staff roster and the user's request, respond with a SINGLE "
        "JSON object and nothing else:\n"
        '{\n  "name": "<short department name>",\n  "description": "<what this department does>",\n'
        '  "mode": "sequential|mesh|ring|supervisor|tree",\n  "maxSteps": <integer 1-10>,\n'
        '  "staffIds": ["<staff id>", ...]\n}\n\n'
        "Rules:\n"
        "- staffIds MUST only contain ids taken from the provided roster. Choose the staff "
        "members best suited to the user's request (usually 2-6 people); it is fine to leave "
        "this empty if the roster has nobody suitable.\n"
        "- Pick mode based on how the chosen staff should collaborate: sequential for a linear "
        "pipeline, mesh for free-form group discussion, ring for round-robin handoff, "
        "supervisor when one member should direct the others, tree for a hierarchical breakdown.\n"
        "- Keep name short and description concise."
    )


def _sanitize_department_draft(raw: dict, known_staff_ids: set[str]) -> GenerateDepartmentResponse:
    mode = str(raw.get("mode") or "sequential").strip().lower()
    if mode not in _DEPARTMENT_MODES:
        mode = "sequential"
    try:
        max_steps = int(raw.get("maxSteps") or 6)
    except (TypeError, ValueError):
        max_steps = 6
    max_steps = max(1, min(10, max_steps))
    staff_ids: list[str] = []
    raw_staff_ids = raw.get("staffIds")
    if isinstance(raw_staff_ids, list):
        for sid in raw_staff_ids:
            sid = str(sid)
            if sid in known_staff_ids and sid not in staff_ids:
                staff_ids.append(sid)
    return GenerateDepartmentResponse(
        name=str(raw.get("name") or "").strip() or "New Department",
        description=str(raw.get("description") or "").strip(),
        mode=mode,
        maxSteps=max_steps,
        staffIds=staff_ids,
    )


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


@router.post("/generate", response_model=GenerateDepartmentResponse)
async def generate_department(
    req: GenerateDepartmentRequest,
    staff_service: StaffService = Depends(get_staff_service),
    llm_service: LLMService | None = Depends(get_llm_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> GenerateDepartmentResponse:
    if llm_service is None:
        raise HTTPException(status_code=503, detail="LLM provider is not configured")
    if not req.prompt.strip():
        raise HTTPException(status_code=422, detail="Prompt is required")

    roster = [
        staff
        for staff in staff_service.list_staff()
        if is_visible_to(owner_id, staff.owner_id)
        and (req.company_id is None or staff.company_id == req.company_id)
    ]
    lines = [
        f"- id={staff.id} | {staff.name} ({staff.role}): {staff.description or ''} "
        f"[skills: {', '.join(s.name for s in staff_service.get_staff_skills(staff.id)) or 'none'}]"
        for staff in roster
    ]

    user = (
        "Available staff roster for this company:\n"
        + ("\n".join(lines) if lines else "(no staff hired yet)")
        + f"\n\nUser's request:\n{req.prompt.strip()}"
    )

    try:
        data = await llm_service.get_provider().generate_json(
            system=_build_department_generate_system_prompt(), user=user
        )
    except Exception as exc:
        get_logger().exception("Department generation failed")
        raise HTTPException(status_code=502, detail=f"Generation failed: {exc}")

    known_staff_ids = {staff.id for staff in roster}
    return _sanitize_department_draft(data if isinstance(data, dict) else {}, known_staff_ids)


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
