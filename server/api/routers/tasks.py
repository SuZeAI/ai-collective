from __future__ import annotations

from uuid import uuid4
from dataclasses import replace
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from server.api.deps import (
    current_owner_id_dep,
    get_staff_service,
    get_meeting_service,
    get_graph_context_service,
    get_project_service,
    get_task_service,
    get_department_service,
)
from server.api.ownership import require_deletable, require_modifiable
from server.api.schemas.task import TaskSchema, UpsertTaskRequest
from server.app.service.staff_service import StaffService
from server.app.service.meeting_service import MeetingService
from server.app.service.graph_context_service import GraphContextService
from server.app.service.project_service import ProjectService
from server.app.service.task_service import TaskService
from server.app.service.department_service import DepartmentService
from server.domain.errors import NotFoundError
from server.domain.enums import StaffStatus
from server.domain.enums import IssueType, TaskPriority, TaskStatus
from server.domain.models import Message, Task, is_owned_by, is_visible_to
from server.infra import task_run_registry
from server.infra import task_queue
from server.infra import working_memory_store
from server.share.log import get_logger

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


def _sync_runtime_state(task_service: TaskService, department_service: DepartmentService, staff_service: StaffService) -> None:
    tasks = task_service.list_tasks()
    departments = department_service.list_departments()
    staff = staff_service.list_staff()

    running_tasks = [t for t in tasks if t.status == TaskStatus.in_progress]
    active_tasks_by_department: dict[str, int] = {}
    for task in running_tasks:
        active_tasks_by_department[task.department_id] = active_tasks_by_department.get(task.department_id, 0) + 1

    department_by_id = {t.id: t for t in departments}
    for department in departments:
        active_count = active_tasks_by_department.get(department.id, 0)
        if department.active_tasks != active_count:
            department_service.upsert_department(replace(department, active_tasks=active_count))

    active_staff_ids: set[str] = set()
    for task in running_tasks:
        department = department_by_id.get(task.department_id)
        if department:
            active_staff_ids.update(department.staff)
        active_staff_ids.update(task.assigned_staff)

    for staff in staff:
        if staff.id in active_staff_ids:
            if staff.status != StaffStatus.active:
                staff_service.upsert_staff(replace(staff, status=StaffStatus.active))
        elif staff.status == StaffStatus.active:
            staff_service.upsert_staff(replace(staff, status=StaffStatus.idle))


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
    department_service: DepartmentService = Depends(get_department_service),
    staff_service: StaffService = Depends(get_staff_service),
    conv_service: MeetingService = Depends(get_meeting_service),
    graph_context_service: GraphContextService = Depends(get_graph_context_service),
    project_service: ProjectService = Depends(get_project_service),
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
    # Shared default tasks are view-only for regular users: any change —
    # including status transitions like start/pause/stop — is admin-only.
    require_modifiable(
        previous_task, owner_id, f"Task '{task_id}'",
        detail="Only the default (admin) account can edit or run shared default items",
    )

    try:
        next_status = TaskStatus(req.status)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid status '{req.status}'")
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

    # Restart behavior: moving from completed/stopped -> in-progress no longer
    # wipes the conversation. The history is kept as one long dialogue and a
    # divider message is appended so the model reads the re-run as a continuation
    # rather than a fresh start. Use DELETE /tasks/{id}/history for a clean slate.
    if previous_status in {TaskStatus.completed, TaskStatus.stopped} and next_status == TaskStatus.in_progress:
        progress = 0
        start_time = now
        end_time = None
        try:
            conv_service.add_message(
                Message(
                    id=f"session_{uuid4().hex}",
                    staff_id="system",
                    content=f"— New session started {now.isoformat()} —",
                    timestamp=now,
                    task_id=task_id,
                )
            )
        except Exception:  # noqa: BLE001 — a missing divider must not block restart
            logger.warning("Failed to append session divider for task %s", task_id, exc_info=True)

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
    elif next_status in {
        TaskStatus.pending,
        TaskStatus.paused,
        TaskStatus.stopped,
        TaskStatus.in_progress,
        TaskStatus.in_review,
    }:
        end_time = None

    try:
        priority = TaskPriority(req.priority)
    except ValueError:
        priority = TaskPriority.medium
    due_date = _parse_iso_datetime(req.dueDate)
    comments = [c.model_dump() for c in req.comments]

    try:
        issue_type = IssueType(req.issueType)
    except ValueError:
        issue_type = IssueType.task

    # Issue key is allocated once at create time and never changes thereafter.
    if previous_task is not None:
        issue_key = previous_task.issue_key
    elif req.projectId:
        issue_key = f"{project_service.get_project(req.projectId).key}-{project_service.allocate_issue_number(req.projectId)}"
    else:
        issue_key = ""

    task = Task(
        id=task_id,
        title=req.title,
        description=req.description,
        department_id=req.departmentId,
        status=next_status,
        progress=progress,
        assigned_staff=list(req.assignedStaff),
        start_time=start_time,
        end_time=end_time,
        owner_id=previous_task.owner_id if previous_task else owner_id,
        priority=priority,
        due_date=due_date,
        labels=list(req.labels),
        assignee_id=req.assigneeId,
        comments=comments,
        project_id=req.projectId,
        issue_type=issue_type,
        issue_key=issue_key,
        epic_id=req.epicId,
        sprint_id=req.sprintId,
        story_points=req.storyPoints,
    )
    saved = service.upsert_task(task)
    logger.info("[Task] upsert saved | task_id=%s | status=%s | progress=%s%%",
                task_id, next_status.value, saved.progress)

    _sync_runtime_state(service, department_service, staff_service)

    # NOTE: the actual staff run is driven entirely by the SSE endpoint
    # POST /llm/staff-graph/run-stream, which registers its own control handle
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
    department_service: DepartmentService = Depends(get_department_service),
    staff_service: StaffService = Depends(get_staff_service),
    conv_service: MeetingService = Depends(get_meeting_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> dict:
    existing = service.try_get_task(task_id)
    require_deletable(existing, owner_id, f"Task '{task_id}'")
    service.delete_task(task_id)
    conv_service.delete_messages_by_task(task_id)
    try:
        from server.infra.llm.sandbox_middleware import (
            cleanup_meeting_sandbox,
        )

        cleanup_meeting_sandbox(task_id)
    except Exception:  # noqa: BLE001 - best-effort; never block task deletion
        pass
    _sync_runtime_state(service, department_service, staff_service)
    return {"deleted": True}


@router.delete("/{task_id}/history")
def clear_task_history(
    task_id: str,
    service: TaskService = Depends(get_task_service),
    conv_service: MeetingService = Depends(get_meeting_service),
    graph_context_service: GraphContextService = Depends(get_graph_context_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> dict:
    """Explicitly wipe a task's conversation history + graph context.

    Restart no longer clears messages automatically (it keeps the long
    dialogue), so this is the deliberate "fresh start" action. Owner/admin
    gated like the status-update and delete endpoints.
    """
    existing = service.try_get_task(task_id)
    require_modifiable(
        existing, owner_id, f"Task '{task_id}'",
        detail="Only the default (admin) account can edit or run shared default items",
    )
    conv_service.delete_messages_by_task(task_id)
    graph_context_service.reset_conversation(conversation_id=task_id)
    # Working memory was previously left untouched here — a wiped task would
    # still resume biased by stale notes/task text from before the clear.
    working_memory_store.delete_memory(task_id)
    return {"cleared": True}


@router.get("/{task_id}/graph-context")
def get_task_graph_context(
    task_id: str,
    service: TaskService = Depends(get_task_service),
    graph_context_service: GraphContextService = Depends(get_graph_context_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> dict[str, object]:
    existing = service.try_get_task(task_id)
    if existing is not None and not is_visible_to(owner_id, existing.owner_id):
        raise NotFoundError(f"Task '{task_id}' not found")
    return graph_context_service.get_graph_snapshot(conversation_id=task_id)
