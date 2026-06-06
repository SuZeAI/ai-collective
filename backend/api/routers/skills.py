from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from backend.api.deps import current_owner_id_dep, get_skill_service
from backend.api.schemas.skill import (
    SkillSchema,
    SkillToolPresetSchema,
    UpsertSkillRequest,
)
from backend.application.service.skill_service import SkillService
from backend.domain.errors import NotFoundError
from backend.domain.models import Skill, can_delete, can_modify, is_visible_to


router = APIRouter(prefix="/skills", tags=["skills"])


@router.get("", response_model=list[SkillSchema])
def list_skills(
    service: SkillService = Depends(get_skill_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> list[SkillSchema]:
    return [
        SkillSchema.from_domain(s)
        for s in service.list_skills()
        if is_visible_to(owner_id, s.owner_id)
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
    existing = service._repo.get(skill_id) if req.id else None
    if existing is not None and not is_visible_to(owner_id, existing.owner_id):
        raise NotFoundError(f"Skill '{skill_id}' not found")
    if existing is not None and not can_modify(owner_id, existing.owner_id):
        raise HTTPException(status_code=403, detail="Only the default (admin) account can edit shared default items")
    skill = Skill(
        id=skill_id,
        name=req.name,
        description=req.description or "",
        third_party=req.third_party or "",
        avatar=((req.avatar or "").strip() or req.name[:1].upper() or "S"),
        avatar_icon=(req.avatar_icon or "").strip(),
        avatar_color=(req.avatar_color or "").strip(),
        avatar_url=(req.avatar_url or "").strip(),
        tool_name=req.tool_name,
        kind=req.kind or "integration",
        config=dict(req.config or {}),
        code=req.code,
        owner_id=existing.owner_id if existing else owner_id,
    )
    saved = service.upsert_skill(skill)
    return SkillSchema.from_domain(saved)


@router.delete("/{skill_id}")
def delete_skill(
    skill_id: str,
    service: SkillService = Depends(get_skill_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> dict:
    existing = service._repo.get(skill_id)
    if existing is not None and not is_visible_to(owner_id, existing.owner_id):
        raise NotFoundError(f"Skill '{skill_id}' not found")
    if existing is not None and not can_delete(owner_id, existing.owner_id):
        raise HTTPException(status_code=403, detail="Only the default (admin) account can delete shared default items")
    service.delete_skill(skill_id)
    return {"deleted": True}
