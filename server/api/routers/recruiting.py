from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from server.api.deps import current_owner_id_dep, get_recruiting_service
from server.api.schemas.staff import StaffSchema
from server.api.schemas.library_document import LibraryDocumentSchema
from server.api.schemas.skill import SkillSchema
from server.api.schemas.task import TaskSchema
from server.api.schemas.department import DepartmentSchema
from server.api.schemas.project import ProjectSchema
from server.app.service.recruiting_service import RecruitingService


router = APIRouter(prefix="/recruiting", tags=["marketplace"])


class CopyRequest(BaseModel):
    type: str  # "skill" | "staff" | "department" | "task" | "project" | "document"
    id: str
    # Required only for "document": the office to copy the catalog doc into.
    companyId: str | None = None


class CopyResponse(BaseModel):
    type: str
    id: str


@router.get("/skills", response_model=list[SkillSchema])
def list_marketplace_skills(
    service: RecruitingService = Depends(get_recruiting_service),
) -> list[SkillSchema]:
    return [SkillSchema.from_domain(s) for s in service.list_default_skills()]


@router.get("/staff", response_model=list[StaffSchema])
def list_marketplace_staff(
    service: RecruitingService = Depends(get_recruiting_service),
) -> list[StaffSchema]:
    return [StaffSchema.from_domain(a, skills) for a, skills in service.list_default_staff()]


@router.get("/departments", response_model=list[DepartmentSchema])
def list_marketplace_teams(
    service: RecruitingService = Depends(get_recruiting_service),
) -> list[DepartmentSchema]:
    return [DepartmentSchema.from_domain(t) for t in service.list_default_teams()]


@router.get("/tasks", response_model=list[TaskSchema])
def list_marketplace_tasks(
    service: RecruitingService = Depends(get_recruiting_service),
) -> list[TaskSchema]:
    return [TaskSchema.from_domain(t) for t in service.list_default_tasks()]


@router.get("/projects", response_model=list[ProjectSchema])
def list_marketplace_projects(
    service: RecruitingService = Depends(get_recruiting_service),
) -> list[ProjectSchema]:
    return [ProjectSchema.from_domain(p) for p in service.list_default_projects()]


@router.get("/documents", response_model=list[LibraryDocumentSchema])
def list_marketplace_documents(
    service: RecruitingService = Depends(get_recruiting_service),
) -> list[LibraryDocumentSchema]:
    return [LibraryDocumentSchema.from_domain(d) for d in service.list_default_documents()]


@router.post("/copy", response_model=CopyResponse)
def copy_from_marketplace(
    req: CopyRequest,
    service: RecruitingService = Depends(get_recruiting_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> CopyResponse:
    result = service.copy(req.type, req.id, owner_id, company_id=req.companyId)
    return CopyResponse(**result)
