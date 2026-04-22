from __future__ import annotations

from uuid import uuid4
from dataclasses import replace
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from backend.api.deps import (
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
from backend.domain.models import Message, Task
from backend.infrastructure import task_run_registry


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


def _run_team_conversation_loop(
    task: Task,
    task_service: TaskService,
    team_service: TeamService,
    agent_service: AgentService,
    conv_service: ConversationService,
) -> Task:
    if task.status != TaskStatus.in_progress:
        return task

    try:
        team = team_service.get_team(task.team_id)
        team_agent_ids = [aid for aid in team.agents]
    except Exception:
        team_agent_ids = []

    participants: list[str] = []
    for aid in team_agent_ids:
        try:
            agent_service.get_agent(aid)
            participants.append(aid)
        except Exception:
            continue
    if not participants:
        participants = [aid for aid in task.assigned_agents if aid]
    if not participants:
        return task

    messages = [
        "Starting execution for this task. Sharing plan and splitting responsibilities.",
        "Received. I am processing my part and will report intermediate results.",
        "Update: progress is moving. Syncing blockers and dependencies now.",
        "Reviewing outputs and validating quality before final handoff.",
    ]

    max_steps = 10
    progress = max(0, min(100, int(task.progress)))
    base_ts = int(time.time() * 1000)

    for step in range(max_steps):
        if progress >= 100:
            break
        speaker = participants[step % len(participants)]
        text = messages[step % len(messages)]
        conv_service.add_message(
            Message(
                id=f"m{base_ts + step}",
                agent_id=speaker,
                content=f"[Step {step + 1}/{max_steps}] {text}",
                timestamp=datetime.utcnow().replace(microsecond=0),
                task_id=task.id,
            )
        )

        remaining_steps = max_steps - step
        increment = max(8, (100 - progress + remaining_steps - 1) // remaining_steps)
        progress = min(100, progress + increment)

    status = task.status
    if progress >= 100:
        status = TaskStatus.completed
        conv_service.add_message(
            Message(
                id=f"m{base_ts + max_steps + 1}",
                agent_id=participants[0],
                content="Task completed. Team has finalized all deliverables.",
                timestamp=datetime.utcnow().replace(microsecond=0),
                task_id=task.id,
            )
        )

    updated = replace(task, progress=progress, status=status)
    return task_service.upsert_task(updated)


@router.get("", response_model=list[TaskSchema])
def list_tasks(service: TaskService = Depends(get_task_service)) -> list[TaskSchema]:
    return [TaskSchema.from_domain(t) for t in service.list_tasks()]


@router.post("", response_model=TaskSchema)
def upsert_task(
    req: UpsertTaskRequest,
    service: TaskService = Depends(get_task_service),
    team_service: TeamService = Depends(get_team_service),
    agent_service: AgentService = Depends(get_agent_service),
    conv_service: ConversationService = Depends(get_conversation_service),
    graph_context_service: GraphContextService = Depends(get_graph_context_service),
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

    # When stopping or pausing: signal any active stream to halt immediately.
    if next_status in {TaskStatus.stopped, TaskStatus.paused}:
        task_run_registry.signal_cancel(task_id)

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
    )
    saved = service.upsert_task(task)

    _sync_runtime_state(service, team_service, agent_service)
    return TaskSchema.from_domain(saved)


@router.delete("/{task_id}")
def delete_task(
    task_id: str,
    service: TaskService = Depends(get_task_service),
    team_service: TeamService = Depends(get_team_service),
    agent_service: AgentService = Depends(get_agent_service),
    conv_service: ConversationService = Depends(get_conversation_service),
) -> dict:
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
