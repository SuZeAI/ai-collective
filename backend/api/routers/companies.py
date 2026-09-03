from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

import logging

from backend.api.deps import (
    current_owner_id_dep,
    get_document_library_service,
    get_department_service,
    get_skill_service,
    get_staff_service,
    get_task_service,
    get_company_service,
)
from backend.api.schemas.company import CompanySchema, UpsertWorkspaceRequest
from backend.app.service.document_library_service import DocumentLibraryService
from backend.app.service.department_service import DepartmentService
from backend.app.service.skill_service import SkillService
from backend.app.service.staff_service import StaffService
from backend.app.service.task_service import TaskService
from backend.app.service.company_service import CompanyService
from backend.domain.errors import NotFoundError
from backend.domain.models import Company, can_delete, can_modify, is_visible_to
from backend.domain.third_party.registry import list_platforms

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/companies", tags=["workspaces"])


@router.get("", response_model=list[CompanySchema])
def list_companies(
    service: CompanyService = Depends(get_company_service),
    owner_id: str = Depends(current_owner_id_dep),
):
    return [
        CompanySchema.from_domain(w)
        for w in service.list_companies()
        if is_visible_to(owner_id, w.owner_id)
    ]


@router.post("", response_model=CompanySchema)
def upsert_workspace(
    req: UpsertWorkspaceRequest,
    service: CompanyService = Depends(get_company_service),
    owner_id: str = Depends(current_owner_id_dep),
):
    ws_id = req.id or f"ws_{uuid4().hex}"
    existing = service.try_get_company(ws_id)
    if existing is not None and not is_visible_to(owner_id, existing.owner_id):
        raise NotFoundError(f"Company {ws_id!r} not found")
    if existing is not None and not can_modify(owner_id, existing.owner_id):
        raise HTTPException(status_code=403, detail="Only the default (admin) account can edit shared default items")
    created_at = existing.created_at if existing else datetime.now(timezone.utc)
    workspace = Company(
        id=ws_id,
        name=req.name,
        description=req.description or "",
        department_ids=list(req.departmentIds or []),
        primary_department_id=req.primaryDepartmentId or "",
        created_at=created_at,
        type=(req.type or (existing.type if existing else None) or "general"),
        avatar=(req.avatar or "").strip() or req.name[:1].upper() or "W",
        avatar_icon=(req.avatar_icon or "").strip(),
        avatar_color=(req.avatar_color or "").strip(),
        avatar_url=(req.avatar_url or "").strip(),
        owner_id=existing.owner_id if existing else owner_id,
    )
    saved = service.upsert_workspace(workspace)
    return CompanySchema.from_domain(saved)


@router.delete("/{company_id}")
def delete_company(
    company_id: str,
    service: CompanyService = Depends(get_company_service),
    documents: DocumentLibraryService = Depends(get_document_library_service),
    departments: DepartmentService = Depends(get_department_service),
    staff_service: StaffService = Depends(get_staff_service),
    skill_service: SkillService = Depends(get_skill_service),
    task_service: TaskService = Depends(get_task_service),
    owner_id: str = Depends(current_owner_id_dep),
):
    existing = service.try_get_company(company_id)
    if existing is not None and not is_visible_to(owner_id, existing.owner_id):
        raise NotFoundError(f"Company {company_id!r} not found")
    if existing is not None and not can_delete(owner_id, existing.owner_id):
        raise HTTPException(status_code=403, detail="Only the default (admin) account can delete shared default items")

    # Cascade: remove everything that belongs to this company (its departments,
    # staff, tools/skills, tasks, documents) so none of it lingers in the "All"
    # scope as an orphan. Each cleanup is best-effort — a failure on related data
    # must not block deleting the workspace itself.
    #
    # Historical stats (Cost Monitoring / token-usage records) are never touched
    # here: those only carry a department_id string, not a live reference, so
    # "All" keeps aggregating them forever, even for companies deleted since.

    all_departments = departments.list_departments()

    # Departments still referenced by another company must be kept — they are
    # shared. Only the ones unique to this company are candidates for removal.
    other_department_ids: set[str] = set()
    for ws in service.list_companies():
        if ws.id == company_id:
            continue
        other_department_ids.update(ws.department_ids)

    departments_to_delete = []
    if existing is not None:
        own_department_ids = set(existing.department_ids)
        for department in all_departments:
            if department.id not in own_department_ids or department.id in other_department_ids:
                continue
            if not can_delete(owner_id, department.owner_id):
                continue
            departments_to_delete.append(department)
    departments_to_delete_ids = {d.id for d in departments_to_delete}

    # Staff exclusive to those departments (not also a member of a department
    # being kept, in this or another company) get removed along with the office.
    own_staff_ids: set[str] = set()
    for department in departments_to_delete:
        own_staff_ids.update(department.staff)
    other_staff_ids: set[str] = set()
    for department in all_departments:
        if department.id in departments_to_delete_ids:
            continue
        other_staff_ids.update(department.staff)
    staff_to_delete_ids = own_staff_ids - other_staff_ids

    # Skills (tools) exclusive to the staff being removed go with them too.
    all_staff = staff_service.list_staff()
    remaining_skill_ids: set[str] = set()
    for member in all_staff:
        if member.id not in staff_to_delete_ids:
            remaining_skill_ids.update(member.skill_ids)
    skills_to_delete_ids: set[str] = set()
    for member in all_staff:
        if member.id in staff_to_delete_ids:
            skills_to_delete_ids.update(sid for sid in member.skill_ids if sid not in remaining_skill_ids)

    # Tasks tied to a department or staff member being removed have no home left.
    removed_tasks = 0
    for task in task_service.list_tasks():
        orphaned = task.department_id in departments_to_delete_ids or (
            task.assignee_id is not None and task.assignee_id in staff_to_delete_ids
        )
        if not orphaned:
            continue
        try:
            task_service.delete_task(task.id)
            removed_tasks += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("failed to delete task %s for workspace %s: %s", task.id, company_id, exc)

    removed_staff = 0
    for staff_id in staff_to_delete_ids:
        try:
            staff_service.delete_staff(staff_id)
            removed_staff += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("failed to delete staff %s for workspace %s: %s", staff_id, company_id, exc)

    removed_skills = 0
    for skill_id in skills_to_delete_ids:
        skill = skill_service.try_get_skill(skill_id)
        if skill is not None and not can_delete(owner_id, skill.owner_id):
            continue
        try:
            skill_service.delete_skill(skill_id)
            removed_skills += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("failed to delete skill %s for workspace %s: %s", skill_id, company_id, exc)

    removed_teams = 0
    for department in departments_to_delete:
        try:
            departments.delete_department(department.id)
            removed_teams += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("failed to delete department %s for workspace %s: %s", department.id, company_id, exc)

    removed_documents = 0
    for doc in documents.list_documents():
        if doc.company_id != company_id:
            continue
        try:
            documents.delete_document(doc)
            removed_documents += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("failed to delete document %s for workspace %s: %s", doc.id, company_id, exc)

    # Office-builder sessions (AI Office Designer chats) are kept even after the
    # company is deleted, so the user can revisit and recreate from them.

    service.delete_company(company_id)
    return {
        "deleted": True,
        "removed_teams": removed_teams,
        "removed_staff": removed_staff,
        "removed_skills": removed_skills,
        "removed_tasks": removed_tasks,
        "removed_documents": removed_documents,
    }


@router.get("/platforms")
def get_platforms():
    """Return all supported platform definitions and their config field schemas."""
    return list_platforms()


@router.get("/{company_id}", response_model=CompanySchema)
def get_company(
    company_id: str,
    service: CompanyService = Depends(get_company_service),
    owner_id: str = Depends(current_owner_id_dep),
):
    workspace = service.get_company(company_id)
    if not is_visible_to(owner_id, workspace.owner_id):
        raise NotFoundError(f"Company {company_id!r} not found")
    return CompanySchema.from_domain(workspace)
