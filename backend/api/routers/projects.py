from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.api.deps import (
    current_owner_id_dep,
    get_epic_service,
    get_project_service,
    get_sprint_service,
    get_task_service,
)
from backend.api.schemas.project import ProjectSchema, UpsertProjectRequest
from backend.app.service.epic_service import EpicService
from backend.app.service.project_service import ProjectService
from backend.app.service.sprint_service import SprintService
from backend.app.service.task_service import TaskService
from backend.domain.errors import NotFoundError
from backend.domain.models import Project, can_delete, can_modify, is_owned_by, is_visible_to

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectSchema])
def list_projects(
    company_id: str | None = Query(default=None),
    service: ProjectService = Depends(get_project_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> list[ProjectSchema]:
    return [
        ProjectSchema.from_domain(p)
        for p in service.list_projects()
        if is_owned_by(owner_id, p.owner_id) and (company_id is None or p.company_id == company_id)
    ]


@router.post("", response_model=ProjectSchema)
def upsert_project(
    req: UpsertProjectRequest,
    service: ProjectService = Depends(get_project_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> ProjectSchema:
    project_id = req.id or f"project_{uuid4().hex}"
    existing = service.try_get_project(project_id) if req.id else None
    if existing is not None and not is_visible_to(owner_id, existing.owner_id):
        raise NotFoundError(f"Project '{project_id}' not found")
    if existing is not None and not can_modify(owner_id, existing.owner_id):
        raise HTTPException(
            status_code=403,
            detail="Only the default (admin) account can edit shared default items",
        )

    key = (req.key or "").strip().upper()
    if not key:
        raise HTTPException(status_code=422, detail="Project key is required")

    # Key uniqueness within the visible scope (no DB constraint exists).
    for other in service.list_projects():
        if other.id == project_id:
            continue
        if other.key == key and is_visible_to(owner_id, other.owner_id):
            raise HTTPException(status_code=409, detail=f"Project key '{key}' is already in use")

    project = Project(
        id=project_id,
        key=key,
        name=req.name,
        description=req.description,
        lead_id=req.leadId,
        planner_staff_id=req.plannerStaffId,
        planner_system_prompt=req.plannerSystemPrompt,
        # Counter is server-owned; preserve it across edits.
        issue_counter=existing.issue_counter if existing else 0,
        created_at=existing.created_at if existing else datetime.now(timezone.utc).replace(microsecond=0),
        avatar=req.avatar,
        avatar_icon=req.avatar_icon,
        avatar_color=req.avatar_color,
        avatar_url=req.avatar_url,
        owner_id=existing.owner_id if existing else owner_id,
        company_id=req.companyId or (existing.company_id if existing else ""),
    )
    saved = service.upsert_project(project)
    return ProjectSchema.from_domain(saved)


@router.delete("/{project_id}")
def delete_project(
    project_id: str,
    service: ProjectService = Depends(get_project_service),
    tasks: TaskService = Depends(get_task_service),
    epics: EpicService = Depends(get_epic_service),
    sprints: SprintService = Depends(get_sprint_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> dict:
    existing = service.try_get_project(project_id)
    if existing is not None and not is_visible_to(owner_id, existing.owner_id):
        raise NotFoundError(f"Project '{project_id}' not found")
    if existing is not None and not can_delete(owner_id, existing.owner_id):
        raise HTTPException(
            status_code=403,
            detail="Only the default (admin) account can delete shared default items",
        )

    # Cascade: issues/epics/sprints only make sense inside their project, so
    # they're removed with it rather than left behind as orphans.
    removed_tasks = 0
    for task in tasks.list_tasks():
        if task.project_id != project_id:
            continue
        try:
            tasks.delete_task(task.id)
            removed_tasks += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("failed to delete task %s for project %s: %s", task.id, project_id, exc)

    removed_epics = 0
    for epic in epics.list_epics():
        if epic.project_id != project_id:
            continue
        try:
            epics.delete_epic(epic.id)
            removed_epics += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("failed to delete epic %s for project %s: %s", epic.id, project_id, exc)

    removed_sprints = 0
    for sprint in sprints.list_sprints():
        if sprint.project_id != project_id:
            continue
        try:
            sprints.delete_sprint(sprint.id)
            removed_sprints += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("failed to delete sprint %s for project %s: %s", sprint.id, project_id, exc)

    service.delete_project(project_id)
    return {
        "deleted": True,
        "removed_tasks": removed_tasks,
        "removed_epics": removed_epics,
        "removed_sprints": removed_sprints,
    }
