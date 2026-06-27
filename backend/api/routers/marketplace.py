from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.api.deps import current_owner_id_dep, get_marketplace_service
from backend.api.schemas.agent import AgentSchema
from backend.api.schemas.library_document import LibraryDocumentSchema
from backend.api.schemas.skill import SkillSchema
from backend.api.schemas.task import TaskSchema
from backend.api.schemas.team import TeamSchema
from backend.application.service.marketplace_service import MarketplaceService


router = APIRouter(prefix="/marketplace", tags=["marketplace"])


class CopyRequest(BaseModel):
    type: str  # "skill" | "agent" | "team" | "task" | "document"
    id: str
    # Required only for "document": the office to copy the catalog doc into.
    workspaceId: str | None = None


class CopyResponse(BaseModel):
    type: str
    id: str


@router.get("/skills", response_model=list[SkillSchema])
def list_marketplace_skills(
    service: MarketplaceService = Depends(get_marketplace_service),
) -> list[SkillSchema]:
    return [SkillSchema.from_domain(s) for s in service.list_default_skills()]


@router.get("/agents", response_model=list[AgentSchema])
def list_marketplace_agents(
    service: MarketplaceService = Depends(get_marketplace_service),
) -> list[AgentSchema]:
    return [AgentSchema.from_domain(a, skills) for a, skills in service.list_default_agents()]


@router.get("/teams", response_model=list[TeamSchema])
def list_marketplace_teams(
    service: MarketplaceService = Depends(get_marketplace_service),
) -> list[TeamSchema]:
    return [TeamSchema.from_domain(t) for t in service.list_default_teams()]


@router.get("/tasks", response_model=list[TaskSchema])
def list_marketplace_tasks(
    service: MarketplaceService = Depends(get_marketplace_service),
) -> list[TaskSchema]:
    return [TaskSchema.from_domain(t) for t in service.list_default_tasks()]


@router.get("/documents", response_model=list[LibraryDocumentSchema])
def list_marketplace_documents(
    service: MarketplaceService = Depends(get_marketplace_service),
) -> list[LibraryDocumentSchema]:
    return [LibraryDocumentSchema.from_domain(d) for d in service.list_default_documents()]


@router.post("/copy", response_model=CopyResponse)
def copy_from_marketplace(
    req: CopyRequest,
    service: MarketplaceService = Depends(get_marketplace_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> CopyResponse:
    result = service.copy(req.type, req.id, owner_id, workspace_id=req.workspaceId)
    return CopyResponse(**result)
