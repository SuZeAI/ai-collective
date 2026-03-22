from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends

from backend.api.deps import get_skill_service
from backend.api.schemas.skill import SkillSchema, UpsertSkillRequest
from backend.application.service.skill_service import SkillService
from backend.domain.models import Skill


router = APIRouter(prefix="/skills", tags=["skills"])


@router.get("", response_model=list[SkillSchema])
def list_skills(service: SkillService = Depends(get_skill_service)) -> list[SkillSchema]:
    return [SkillSchema.from_domain(s) for s in service.list_skills()]


@router.post("", response_model=SkillSchema)
def upsert_skill(req: UpsertSkillRequest, service: SkillService = Depends(get_skill_service)) -> SkillSchema:
    skill_id = req.id or f"skill_{uuid4().hex}"
    skill = Skill(
        id=skill_id,
        name=req.name,
        description=req.description or "",
        third_party=req.third_party or "",
        kind=req.kind or "integration",
        config=dict(req.config or {}),
        code=req.code,
    )
    saved = service.upsert_skill(skill)
    return SkillSchema.from_domain(saved)


@router.delete("/{skill_id}")
def delete_skill(skill_id: str, service: SkillService = Depends(get_skill_service)) -> dict:
    service.delete_skill(skill_id)
    return {"deleted": True}
