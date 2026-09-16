from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, Query

from server.api.avatars import sanitize_avatar_fields
from server.api.deps import current_owner_id_dep, get_company_service, get_skill_service
from server.api.ownership import require_deletable, require_modifiable
from server.api.schemas.skill import (
    SkillSchema,
    SkillToolPresetSchema,
    UpsertSkillRequest,
    merge_config_preserving_secrets,
)
from server.app.service.company_service import CompanyService
from server.app.service.skill_service import SkillService
from server.domain.models import CATALOG_COMPANY_ID, Skill, is_visible_to


router = APIRouter(prefix="/skills", tags=["skills"])


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
