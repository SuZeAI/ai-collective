from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query

from server.api.avatars import sanitize_avatar_fields
from server.api.deps import current_owner_id_dep, get_company_service, get_llm_service, get_skill_service
from server.api.ownership import require_deletable, require_modifiable
from server.api.schemas.skill import (
    GenerateSkillRequest,
    GenerateSkillResponse,
    SkillSchema,
    SkillToolPresetSchema,
    UpsertSkillRequest,
    merge_config_preserving_secrets,
)
from server.app.service.company_service import CompanyService
from server.app.service.llm_service import LLMService
from server.app.service.skill_service import SkillService
from server.domain.models import CATALOG_COMPANY_ID, Skill, is_visible_to
from server.share.log import get_logger


router = APIRouter(prefix="/skills", tags=["skills"])


def _build_skill_generate_system_prompt(tool_names: list[str]) -> str:
    tools_text = ", ".join(tool_names)
    return (
        "You design skills (tool integrations) that AI staff can use, chosen from a fixed "
        "registry of available tool types. Respond with a SINGLE JSON object and nothing else:\n"
        '{\n  "name": "<short skill name>",\n  "description": "<what this skill lets staff do>",\n'
        '  "toolName": "<one of the available tool names>",\n'
        '  "instruction": "<short guidance for staff on when/how to use this skill>"\n}\n\n'
        f"Available tool names: {tools_text}\n\n"
        "Rules:\n- toolName MUST be exactly one value from the available tool names list.\n"
        "- Prefer a tool that isn't already covered by the company's existing skills, unless "
        "the user's request clearly asks for a duplicate."
    )


def _sanitize_skill_draft(raw: dict, tool_names: list[str]) -> GenerateSkillResponse:
    tool_name = str(raw.get("toolName") or "").strip()
    if tool_name not in tool_names:
        tool_name = tool_names[0] if tool_names else None
    return GenerateSkillResponse(
        name=str(raw.get("name") or "").strip() or "New Skill",
        description=str(raw.get("description") or "").strip(),
        toolName=tool_name,
        instruction=str(raw.get("instruction") or "").strip(),
    )


@router.get("", response_model=list[SkillSchema])
def list_skills(
    company_id: str | None = Query(default=None),
    service: SkillService = Depends(get_skill_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> list[SkillSchema]:
    return [
        SkillSchema.from_domain(s)
        for s in service.list_skills()
        if is_visible_to(owner_id, s.owner_id)
        and (company_id is None or s.company_id == company_id)
    ]


@router.get("/tools", response_model=list[str])
def list_available_tools(service: SkillService = Depends(get_skill_service)) -> list[str]:
    return service.list_available_tool_names()


@router.get("/tool-presets", response_model=list[SkillToolPresetSchema])
def list_tool_presets(service: SkillService = Depends(get_skill_service)) -> list[SkillToolPresetSchema]:
    presets = service.list_tool_presets()
    return [SkillToolPresetSchema.model_validate(p) for p in presets]


@router.post("", response_model=SkillSchema)
def upsert_skill(
    req: UpsertSkillRequest,
    service: SkillService = Depends(get_skill_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> SkillSchema:
    skill_id = req.id or f"skill_{uuid4().hex}"
    existing = service.try_get_skill(skill_id) if req.id else None
    require_modifiable(existing, owner_id, f"Skill '{skill_id}'")
    avatar_icon, avatar_color, avatar_url = sanitize_avatar_fields(
        req.avatar_icon, req.avatar_color, req.avatar_url
    )
    skill = Skill(
        id=skill_id,
        name=req.name,
        description=req.description or "",
        third_party=req.third_party or "",
        avatar=((req.avatar or "").strip() or req.name[:1].upper() or "S"),
        avatar_icon=avatar_icon,
        avatar_color=avatar_color,
        avatar_url=avatar_url,
        tool_name=req.tool_name,
        kind=req.kind or "integration",
        config=merge_config_preserving_secrets(
            existing.config if existing else None, dict(req.config or {})
        ),
        code=req.code,
        instruction=(req.instruction or "").strip(),
        owner_id=existing.owner_id if existing else owner_id,
        company_id=existing.company_id if existing else (req.company_id or CATALOG_COMPANY_ID),
    )
    saved = service.upsert_skill(skill)
    return SkillSchema.from_domain(saved)


@router.post("/generate", response_model=GenerateSkillResponse)
async def generate_skill(
    req: GenerateSkillRequest,
    service: SkillService = Depends(get_skill_service),
    llm_service: LLMService | None = Depends(get_llm_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> GenerateSkillResponse:
    if llm_service is None:
        raise HTTPException(status_code=503, detail="LLM provider is not configured")
    if not req.prompt.strip():
        raise HTTPException(status_code=422, detail="Prompt is required")

    tool_names = service.list_available_tool_names()
    existing = [
        s.name
        for s in service.list_skills()
        if is_visible_to(owner_id, s.owner_id) and (req.company_id is None or s.company_id == req.company_id)
    ]

    user = (
        f"Existing skills already in this company: {', '.join(existing) or 'none'}\n\n"
        f"User's request:\n{req.prompt.strip()}"
    )

    try:
        data = await llm_service.get_provider().generate_json(
            system=_build_skill_generate_system_prompt(tool_names), user=user
        )
    except Exception as exc:
        get_logger().exception("Skill generation failed")
        raise HTTPException(status_code=502, detail=f"Generation failed: {exc}")

    return _sanitize_skill_draft(data if isinstance(data, dict) else {}, tool_names)


@router.get("/{skill_id}/impact")
def get_skill_delete_impact(
    skill_id: str,
    company_service: CompanyService = Depends(get_company_service),
) -> dict:
    """Preview which staff/companies a delete would affect, without deleting anything."""
    return company_service.preview_skill_delete(skill_id)


@router.delete("/{skill_id}")
def delete_skill(
    skill_id: str,
    service: SkillService = Depends(get_skill_service),
    company_service: CompanyService = Depends(get_company_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> dict:
    existing = service.try_get_skill(skill_id)
    require_deletable(existing, owner_id, f"Skill '{skill_id}'")
    return company_service.delete_skill_cascade(skill_id, existing, owner_id)
