from __future__ import annotations

import time

from fastapi import APIRouter, Depends

from backend.api.deps import get_task_service
from backend.api.schemas.task import TaskSchema, UpsertTaskRequest
from backend.application.service.task_service import TaskService
from backend.domain.enums import TaskStatus
from backend.domain.models import Task


router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskSchema])
def list_tasks(service: TaskService = Depends(get_task_service)) -> list[TaskSchema]:
    return [TaskSchema.from_domain(t) for t in service.list_tasks()]


@router.post("", response_model=TaskSchema)
def upsert_task(req: UpsertTaskRequest, service: TaskService = Depends(get_task_service)) -> TaskSchema:
    task_id = req.id or f"task{int(time.time() * 1000)}"
    task = Task(
        id=task_id,
        title=req.title,
        description=req.description,
        team_id=req.teamId,
        status=TaskStatus(req.status),
        progress=req.progress,
        assigned_agents=list(req.assignedAgents),
    )
    saved = service.upsert_task(task)
    return TaskSchema.from_domain(saved)


@router.delete("/{task_id}")
def delete_task(task_id: str, service: TaskService = Depends(get_task_service)) -> dict:
    service.delete_task(task_id)
    return {"deleted": True}
