from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from server.api.deps import (
    current_owner_id_dep,
    get_staff_service,
    get_epic_service,
    get_llm_service,
    get_project_service,
    get_sprint_service,
    get_task_service,
)
from server.api.schemas.planner import (
    DraftIssue,
    PlannerCommitRequest,
    PlannerDecomposeRequest,
    PlannerDecomposeResponse,
)
from server.api.schemas.task import TaskSchema
from server.app.service.staff_service import StaffService
from server.app.service.epic_service import EpicService
from server.app.service.llm_service import LLMService
from server.app.service.project_service import ProjectService
from server.app.service.sprint_service import SprintService
from server.app.service.task_service import TaskService
from server.domain.enums import IssueType, TaskPriority, TaskStatus
from server.domain.errors import NotFoundError
from server.domain.models import Task, is_visible_to
from server.log import get_logger

router = APIRouter(prefix="/planner", tags=["planner"])

_ISSUE_SCHEMA_TEXT = (
    "{\n"
    '  "issues": [\n'
    "    {\n"
    '      "title": "<concise issue title>",\n'
    '      "type": "story|task|bug|subtask",\n'
    '      "description": "<what to build / acceptance criteria>",\n'
    '      "storyPoints": <integer estimate 1-13, or null>,\n'
    '      "epicHint": "<which epic/theme this belongs to, or empty>"\n'
    "    }\n"
    "  ]\n"
    "}"
)

_PLANNER_RULES_TEXT = (
    "Rules:\n"
    "- Break the work into independently executable issues for an IT project.\n"
    "- Prefer stories/tasks; use bugs only for defects and subtasks for fine-grained steps.\n"
    "- Estimate storyPoints on a Fibonacci-ish scale (1,2,3,5,8,13); use null if unsure.\n"
    "- Keep titles short and action-oriented; put detail in description.\n"
    "- Respond with a SINGLE JSON object and nothing else."
)


def _build_planner_system_prompt(persona: str, count: int) -> str:
    persona = (persona or "").strip()
    intro = (
        persona
        or "You are an expert technical project planner for an AI software department."
    )
    return (
        f"{intro}\n\n"
        f"Decompose the user's project/epic description into about {count} issues. "
        "ALWAYS respond with a single JSON object and nothing else:\n"
        f"{_ISSUE_SCHEMA_TEXT}\n\n"
        f"{_PLANNER_RULES_TEXT}"
    )


def _sanitize_issue(raw: dict) -> DraftIssue:
    issue_type = str(raw.get("type", "task")).lower()
    if issue_type not in {t.value for t in IssueType}:
        issue_type = "task"
    points = raw.get("storyPoints")
    try:
        points = int(points) if points is not None else None
    except (TypeError, ValueError):
        points = None
    return DraftIssue(
        title=str(raw.get("title") or "Untitled issue").strip(),
        type=issue_type,
        description=str(raw.get("description") or "").strip(),
        storyPoints=points,
        epicHint=str(raw.get("epicHint") or "").strip(),
    )


@router.post("/decompose", response_model=PlannerDecomposeResponse)
async def planner_decompose(
    req: PlannerDecomposeRequest,
    llm_service: LLMService | None = Depends(get_llm_service),
    project_service: ProjectService = Depends(get_project_service),
    staff_service: StaffService = Depends(get_staff_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> PlannerDecomposeResponse:
    if llm_service is None:
        raise HTTPException(status_code=503, detail="LLM provider is not configured")

    project = project_service.get_project(req.projectId)
    if not is_visible_to(owner_id, project.owner_id):
        raise NotFoundError(f"Project '{req.projectId}' not found")

    # The configurable planner: the project's chosen staff persona drives the
    # decomposition. An explicit prompt override on the project wins over the
    # staff's own system_prompt.
    persona = (project.planner_system_prompt or "").strip()
    if not persona and project.planner_staff_id:
        try:
            staff = staff_service.get_staff(project.planner_staff_id)
            persona = (staff.system_prompt or staff.description or "").strip()
        except NotFoundError:
            persona = ""

    system = _build_planner_system_prompt(persona, max(1, min(req.count, 30)))
    user = (
        f"Project: {project.name} ({project.key})\n\n"
        f"Describe the work to plan:\n{req.description}"
    )

    try:
        data = await llm_service.get_provider().generate_json(system=system, user=user)
    except Exception as exc:  # malformed JSON or provider failure
        get_logger().exception("Planner decomposition failed")
        raise HTTPException(status_code=502, detail=f"Decomposition failed: {exc}")

    raw_issues = data.get("issues") if isinstance(data, dict) else None
    if not isinstance(raw_issues, list):
        raw_issues = []
    issues = [_sanitize_issue(r) for r in raw_issues if isinstance(r, dict)]
    return PlannerDecomposeResponse(issues=issues)


@router.post("/commit", response_model=list[TaskSchema])
def planner_commit(
    req: PlannerCommitRequest,
    project_service: ProjectService = Depends(get_project_service),
    task_service: TaskService = Depends(get_task_service),
    epic_service: EpicService = Depends(get_epic_service),
    sprint_service: SprintService = Depends(get_sprint_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> list[TaskSchema]:
    project = project_service.get_project(req.projectId)
    if not is_visible_to(owner_id, project.owner_id):
        raise NotFoundError(f"Project '{req.projectId}' not found")

    # Validate cross-references are visible to the requester.
    if req.epicId:
        epic = epic_service.get_epic(req.epicId)
        if not is_visible_to(owner_id, epic.owner_id):
            raise NotFoundError(f"Epic '{req.epicId}' not found")
    if req.sprintId:
        sprint = sprint_service.get_sprint(req.sprintId)
        if not is_visible_to(owner_id, sprint.owner_id):
            raise NotFoundError(f"Sprint '{req.sprintId}' not found")

    created: list[TaskSchema] = []
    for draft in req.issues:
        try:
            issue_type = IssueType(draft.type)
        except ValueError:
            issue_type = IssueType.task
        number = project_service.allocate_issue_number(req.projectId)
        task = Task(
            id=f"task_{uuid4().hex}",
            title=draft.title,
            description=draft.description,
            department_id=req.departmentId,
            status=TaskStatus.pending,
            progress=0,
            assigned_staff=[],
            owner_id=owner_id,
            priority=TaskPriority.medium,
            project_id=req.projectId,
            issue_type=issue_type,
            issue_key=f"{project.key}-{number}",
            epic_id=req.epicId,
            sprint_id=req.sprintId,
            story_points=draft.storyPoints,
        )
        created.append(TaskSchema.from_domain(task_service.upsert_task(task)))
    return created
