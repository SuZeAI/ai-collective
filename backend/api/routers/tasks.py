from __future__ import annotations

import logging
import time
from uuid import uuid4
from dataclasses import replace
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from backend.api.deps import (
    current_owner_id_dep,
    get_agent_service,
    get_conversation_service,
    get_graph_context_service,
    get_task_service,
    get_team_service,
)
from backend.api.schemas.task import TaskSchema, UpsertTaskRequest
from backend.application.service.agent_service import AgentService
from backend.application.service.conversation_service import ConversationService
from backend.application.service.graph_context_service import GraphContextService
from backend.application.service.task_service import TaskService
from backend.application.service.team_service import TeamService
from backend.domain.errors import NotFoundError
from backend.domain.enums import AgentStatus
from backend.domain.enums import TaskStatus
from backend.domain.models import Task, can_delete, can_modify, is_owned_by, is_visible_to
from backend.infrastructure import task_run_registry
from backend.infrastructure import task_queue
from backend.log import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def _sync_runtime_state(task_service: TaskService, team_service: TeamService, agent_service: AgentService) -> None:
    tasks = task_service.list_tasks()
    teams = team_service.list_teams()
    agents = agent_service.list_agents()

    running_tasks = [t for t in tasks if t.status == TaskStatus.in_progress]
    active_tasks_by_team: dict[str, int] = {}
    for task in running_tasks:
        active_tasks_by_team[task.team_id] = active_tasks_by_team.get(task.team_id, 0) + 1

    team_by_id = {t.id: t for t in teams}
    for team in teams:
        active_count = active_tasks_by_team.get(team.id, 0)
        if team.active_tasks != active_count:
            team_service.upsert_team(replace(team, active_tasks=active_count))

    active_agent_ids: set[str] = set()
    for task in running_tasks:
        team = team_by_id.get(task.team_id)
        if team:
            active_agent_ids.update(team.agents)
        active_agent_ids.update(task.assigned_agents)

    for agent in agents:
        if agent.id in active_agent_ids:
            if agent.status != AgentStatus.active:
                agent_service.upsert_agent(replace(agent, status=AgentStatus.active))
        elif agent.status == AgentStatus.active:
            agent_service.upsert_agent(replace(agent, status=AgentStatus.idle))


@router.get("/queue/status")
def get_queue_status() -> dict:
    """Return current task queue state: running/waiting task IDs and concurrency limits."""
    return task_queue.status()


@router.get("", response_model=list[TaskSchema])
def list_tasks(
    service: TaskService = Depends(get_task_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> list[TaskSchema]:
    return [
        TaskSchema.from_domain(t)
        for t in service.list_tasks()
        if is_owned_by(owner_id, t.owner_id)
    ]


@router.post("", response_model=TaskSchema)
def upsert_task(
    req: UpsertTaskRequest,
    service: TaskService = Depends(get_task_service),
    team_service: TeamService = Depends(get_team_service),
    agent_service: AgentService = Depends(get_agent_service),
    conv_service: ConversationService = Depends(get_conversation_service),
    graph_context_service: GraphContextService = Depends(get_graph_context_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> TaskSchema:
    task_id = req.id or f"task_{uuid4().hex}"
    previous_task: Task | None = None
    previous_status: TaskStatus | None = None
    if req.id:
        try:
            previous_task = service.get_task(task_id)
            previous_status = previous_task.status
        except NotFoundError:
            previous_task = None
            previous_status = None
    if previous_task is not None and not is_visible_to(owner_id, previous_task.owner_id):
        raise NotFoundError(f"Task '{task_id}' not found")
    if previous_task is not None and not can_modify(owner_id, previous_task.owner_id):
        # Shared default tasks are view-only for regular users: any change —
        # including status transitions like start/pause/stop — is admin-only.
        raise HTTPException(
            status_code=403,
            detail="Only the default (admin) account can edit or run shared default items",
        )

    next_status = TaskStatus(req.status)
    now = datetime.now(timezone.utc).replace(microsecond=0)
    progress = req.progress
    start_time = _parse_iso_datetime(req.startTime)
    end_time = _parse_iso_datetime(req.endTime)

    # Preserve previous timestamps unless explicitly overridden.
    if start_time is None and previous_task is not None:
        start_time = previous_task.start_time
    if end_time is None and previous_task is not None:
        end_time = previous_task.end_time

    # When stopping or pausing: signal any active stream to halt and remove from queue.
    if next_status in {TaskStatus.stopped, TaskStatus.paused}:
        logger.info("[Task] STOP/PAUSE signal | task_id=%s | new_status=%s | prev_status=%s",
                    task_id, next_status.value, previous_status.value if previous_status else "none")
        task_run_registry.signal_cancel(task_id)
        task_queue.cancel(task_id)

    # Restart behavior: moving from completed/stopped -> in-progress clears old conversations.
    if previous_status in {TaskStatus.completed, TaskStatus.stopped} and next_status == TaskStatus.in_progress:
        progress = 0
        start_time = now
        end_time = None
        conv_service.delete_messages_by_task(task_id)
        graph_context_service.reset_conversation(conversation_id=task_id)

    # Resume from paused: keep existing conversations, preserve progress
    if previous_status == TaskStatus.paused and next_status == TaskStatus.in_progress:
        start_time = previous_task.start_time if previous_task else start_time

    if next_status == TaskStatus.in_progress and start_time is None:
        start_time = now

    if next_status == TaskStatus.completed:
        if start_time is None:
            start_time = now
        if end_time is None:
            end_time = now
    elif next_status in {TaskStatus.pending, TaskStatus.paused, TaskStatus.stopped, TaskStatus.in_progress}:
        end_time = None

    task = Task(
        id=task_id,
        title=req.title,
        description=req.description,
        team_id=req.teamId,
        status=next_status,
        progress=progress,
        assigned_agents=list(req.assignedAgents),
        start_time=start_time,
        end_time=end_time,
        owner_id=previous_task.owner_id if previous_task else owner_id,
    )
    saved = service.upsert_task(task)
    logger.info("[Task] upsert saved | task_id=%s | status=%s | progress=%s%%",
                task_id, next_status.value, saved.progress)

    _sync_runtime_state(service, team_service, agent_service)

    # NOTE: the actual agent run is driven entirely by the SSE endpoint
    # POST /llm/agent-graph/run-stream, which registers its own control handle
    # under conversation_id (== task_id), holds it for the run's lifetime, and
    # writes completion when the stream ends. Starting a parallel background
    # job here would register/unregister the same registry key and clobber the
    # live run's handle (breaking pause/interject/ask_user intermittently) and
    # persist a premature "completed" status — so we deliberately do not.

    return TaskSchema.from_domain(saved)


@router.delete("/{task_id}")
def delete_task(
    task_id: str,
    service: TaskService = Depends(get_task_service),
    team_service: TeamService = Depends(get_team_service),
    agent_service: AgentService = Depends(get_agent_service),
    conv_service: ConversationService = Depends(get_conversation_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> dict:
    existing = service._repo.get(task_id)
    if existing is not None and not is_visible_to(owner_id, existing.owner_id):
        raise NotFoundError(f"Task '{task_id}' not found")
    if existing is not None and not can_delete(owner_id, existing.owner_id):
        raise HTTPException(status_code=403, detail="Only the default (admin) account can delete shared default items")
    service.delete_task(task_id)
    conv_service.delete_messages_by_task(task_id)
    _sync_runtime_state(service, team_service, agent_service)
    return {"deleted": True}


@router.get("/{task_id}/graph-context")
def get_task_graph_context(
    task_id: str,
    graph_context_service: GraphContextService = Depends(get_graph_context_service),
) -> dict[str, object]:
    return graph_context_service.get_graph_snapshot(conversation_id=task_id)
