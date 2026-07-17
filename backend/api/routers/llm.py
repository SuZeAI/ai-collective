from __future__ import annotations

import asyncio
import contextlib
import json
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.api.deps import (
    _resolve_active_model_config,
    current_owner_id_dep,
    get_staff_graph_service,
    get_staff_service,
    get_graph_context_service,
    get_llm_service,
    get_skill_tool_manager,
    get_task_service,
)
from backend.api.schemas.admin import LlmModelOptionSchema
from backend.api.schemas.staff_graph import GraphRunRequest, GraphRunResponse, GraphTurnSchema
from backend.infrastructure.llm.config import get_enabled_models
from backend.application.ports.staff_graph import CustomGraphSpec, GraphStaffDefinition
from backend.application.service.staff_service import StaffService
from backend.application.service.graph_context_service import GraphContextService
from backend.application.service.llm_service import LLMService
from backend.application.service.task_service import TaskService
from backend.domain.errors import NotFoundError
from backend.domain.memory.knowledge_graph import GraphContextConfig
from backend.domain.models import is_visible_to
from backend.domain.service.skill_tool_service import SkillToolManager
from backend.infrastructure import task_run_registry
from backend.infrastructure.llm.usage_tracker import current_usage_department
from backend.log import get_logger


router = APIRouter(prefix="/llm", tags=["llm"])
logger = get_logger(__name__)


def _require_conversation_access(task_service: TaskService, conversation_id: str, owner_id: str) -> None:
    """Raise 404 unless the conversation's task exists and is visible to owner_id.

    Conversation ids are task ids; without this check any caller who can guess
    or enumerate a task id could interject/respond/pause/resume another
    owner's active run.
    """
    try:
        task = task_service.get_task(conversation_id)
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if not is_visible_to(owner_id, task.owner_id):
        raise HTTPException(status_code=404, detail="Meeting not found")


@router.get("/models", response_model=list[LlmModelOptionSchema])
def list_llm_models(
    _owner_id: str = Depends(current_owner_id_dep),
) -> list[LlmModelOptionSchema]:
    """Selectable models (config.yml `models:` entries with `enabled: true`),
    with the currently-active one flagged. Powers the Settings-UI model picker;
    switching the active model is admin-gated (PUT /admin/monitoring/active-model)."""
    active = _resolve_active_model_config()
    active_name = active.name if active else None
    return [
        LlmModelOptionSchema(
            name=m.name,
            displayName=m.display_name or m.name,
            providerName=m.provider_name or "",
            supportsVision=m.supports_vision,
            active=(m.name == active_name),
        )
        for m in get_enabled_models()
    ]


class ChatRequest(BaseModel):
    prompt: str = Field(min_length=1)
    system: str | None = None
    staffId: str | None = None
    conversationId: str | None = None


class ChatResponse(BaseModel):
    response: str


@router.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    service: LLMService | None = Depends(get_llm_service),
    staff_service: StaffService = Depends(get_staff_service),
    tool_manager: SkillToolManager = Depends(get_skill_tool_manager),
    task_service: TaskService = Depends(get_task_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> ChatResponse:
    if not service:
        raise HTTPException(status_code=503, detail="LLM not configured")
    if req.conversationId:
        _require_conversation_access(task_service, req.conversationId, owner_id)
    system_prompt = req.system
    tools: list[object] = []
    subagent_enabled = False
    if req.staffId:
        try:
            staff = staff_service.get_staff(req.staffId)
            if not system_prompt:
                system_prompt = staff.system_prompt or None
            subagent_enabled = bool(getattr(staff, "subagent_enabled", False))

            skills = staff_service.get_staff_skills(req.staffId)
            for skill in skills:
                toolkit = tool_manager.get_tool_for_skill(skill)
                if toolkit:
                    tools.extend(toolkit.get_tools())
        except Exception as exc:
            logger.exception("Failed to resolve tools for staff '%s': %s", req.staffId, exc)
            if not system_prompt:
                system_prompt = None

    # Staff Mode: expose the `task` tool (subagent delegation) and run tool
    # calls in parallel. Subagents inherit the staff's tools (minus `task`).
    if subagent_enabled:
        from backend.api.settings import settings
        from backend.domain.tools.task import TaskToolkit

        task_toolkit = TaskToolkit(
            llm=service.get_provider(),
            subagent_tools=list(tools),
            max_concurrent=settings.subagent_max_concurrent,
        )
        tools.extend(task_toolkit.get_tools())

    # When the direct chat is scoped to a conversation that has files, provision
    # the shared sandbox and inject the file/document tools so the staff can read
    # the uploads (mirrors the staff-graph path).
    prompt = req.prompt
    if req.conversationId:
        try:
            from backend.domain.staff._graph_runtime import (
                attach_conversation_sandbox,
                uploads_hint,
            )

            staff_name = req.staffId or "assistant"
            if attach_conversation_sandbox(tools, conversation_id=req.conversationId, staff_name=staff_name):
                prompt = uploads_hint(req.conversationId) + prompt
        except Exception as exc:  # noqa: BLE001 - never break a chat over file wiring
            logger.warning("attach_conversation_sandbox (direct chat) failed: %s", exc)

    text = await service.chat(
        prompt=prompt,
        system=system_prompt or "You are a helpful assistant.",
        tools=tools or None,
        parallel_tools=subagent_enabled,
    )
    return ChatResponse(response=text)


class InterjectRequest(BaseModel):
    """Human-in-the-loop message posted while an staff-graph run is streaming."""

    conversation_id: str = Field(min_length=1)
    content: str = Field(min_length=1, max_length=8000)


class InterjectResponse(BaseModel):
    queued: bool
    message_id: str | None = None


@router.post("/staff-graph/interject", response_model=InterjectResponse)
async def interject_staff_graph(
    req: InterjectRequest,
    task_service: TaskService = Depends(get_task_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> InterjectResponse:
    """Queue a user message for an active run.

    The next staff turn drains the queue, injects the message into its context
    (and into the knowledge graph), and emits a ``user_message_injected``
    stream event. Returns 409 when the run is no longer active so the client
    can tell the user their guidance was not consumed.
    """
    _require_conversation_access(task_service, req.conversation_id, owner_id)
    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=422, detail="content must not be blank")
    message_id = task_run_registry.post_user_message(req.conversation_id, content)
    if message_id is None:
        raise HTTPException(
            status_code=409,
            detail="No active run for this meeting (it may have finished or been stopped)",
        )
    return InterjectResponse(queued=True, message_id=message_id)


class UserResponseRequest(BaseModel):
    """Answer to an staff's ask_user question on an active run."""

    conversation_id: str = Field(min_length=1)
    request_id: str = Field(min_length=1)
    response: str = Field(min_length=1, max_length=8000)


@router.post("/staff-graph/respond")
async def respond_staff_graph(
    req: UserResponseRequest,
    task_service: TaskService = Depends(get_task_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> dict:
    """Deliver the user's answer to an staff blocked on the ask_user tool.

    The tool's poll loop picks the answer up, emits ``user_input_received``
    on the stream, and returns the answer to the LLM so it continues its turn.
    """
    _require_conversation_access(task_service, req.conversation_id, owner_id)
    response = req.response.strip()
    if not response:
        raise HTTPException(status_code=422, detail="response must not be blank")
    status = task_run_registry.answer_user_request(req.conversation_id, req.request_id, response)
    if status == "no_run":
        raise HTTPException(
            status_code=409,
            detail="No active run for this meeting (it may have finished or been stopped)",
        )
    if status == "unknown_request":
        raise HTTPException(
            status_code=404,
            detail="This question is no longer open (already answered or timed out)",
        )
    return {"delivered": True}


class RunControlRequest(BaseModel):
    """Targets an actively streaming staff-graph run by conversation id."""

    conversation_id: str = Field(min_length=1)


@router.post("/staff-graph/pause")
async def pause_staff_graph(
    req: RunControlRequest,
    task_service: TaskService = Depends(get_task_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> dict:
    """Interrupt an active run: the current staff finishes its turn, then the
    run holds at the turn boundary so the user can chat before resuming."""
    _require_conversation_access(task_service, req.conversation_id, owner_id)
    if not task_run_registry.signal_pause(req.conversation_id):
        raise HTTPException(
            status_code=409,
            detail="No active run for this meeting (it may have finished or been stopped)",
        )
    return {"paused": True}


@router.post("/staff-graph/resume")
async def resume_staff_graph(
    req: RunControlRequest,
    task_service: TaskService = Depends(get_task_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> dict:
    """Release a held run; the next staff turn proceeds (and picks up any
    interjected messages queued during the hold)."""
    _require_conversation_access(task_service, req.conversation_id, owner_id)
    if not task_run_registry.signal_resume(req.conversation_id):
        raise HTTPException(
            status_code=409,
            detail="No active run for this meeting (it may have finished or been stopped)",
        )
    return {"resumed": True}


def _build_custom_graph_spec(
    req: GraphRunRequest, staff_id_to_name: dict[str, str]
) -> CustomGraphSpec | None:
    """Translate the request's staff-id-based custom graph into a name-based
    CustomGraphSpec the orchestrators understand. Returns None unless mode is
    'custom' with a graph attached."""
    if req.mode != "custom" or req.custom_graph is None:
        return None
    edges = tuple(
        (staff_id_to_name[e.source], staff_id_to_name[e.target])
        for e in req.custom_graph.edges
        if e.source in staff_id_to_name and e.target in staff_id_to_name
    )
    entry = tuple(
        staff_id_to_name[n]
        for n in (req.custom_graph.entry or [])
        if n in staff_id_to_name
    )
    return CustomGraphSpec(edges=edges, entry=entry)


@router.post("/staff-graph/run", response_model=GraphRunResponse)
async def run_staff_graph(
    req: GraphRunRequest,
    staff_service: StaffService = Depends(get_staff_service),
    tool_manager: SkillToolManager = Depends(get_skill_tool_manager),
    graph_context_service: GraphContextService = Depends(get_graph_context_service),
    task_service: TaskService = Depends(get_task_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> GraphRunResponse:
    service = get_staff_graph_service(mode=req.mode)
    if not service:
        raise HTTPException(status_code=503, detail="LLM not configured")
    if req.conversation_id:
        _require_conversation_access(task_service, req.conversation_id, owner_id)

    # Fetch staff from database by ID and bind tools
    definitions = []
    staff_id_to_name: dict[str, str] = {}  # for translating custom_graph ids -> names
    for staff_id in req.staff:
        try:
            staff = staff_service.get_staff(staff_id)

            # Get tools for this staff's skills
            staff_tools = {}
            skills = staff_service.get_staff_skills(staff_id)
            for skill in skills:
                tool = tool_manager.get_tool_for_skill(skill)
                if tool:
                    staff_tools[skill.id] = tool
                    logger.info(f"Bound tool '{skill.tool_name}' for skill '{skill.id}' (staff: {staff.name})")
                else:
                    logger.debug(f"No tool available for skill '{skill.id}' (staff: {staff.name})")

            definitions.append(
                GraphStaffDefinition(
                    name=staff.name,
                    role=staff.role,
                    system_prompt=staff.system_prompt,
                    description=staff.description,
                    skill_ids=list(staff.skill_ids),
                    tools=staff_tools or None,
                    subagent_enabled=bool(getattr(staff, "subagent_enabled", False)),
                )
            )
            staff_id_to_name[staff_id] = staff.name
        except NotFoundError as e:
            raise HTTPException(status_code=404, detail=f"Staff '{staff_id}' not found: {e}")
        except Exception as e:
            # Distinct from the 404 above: the staff itself exists but binding
            # one of its tools failed (e.g. sandbox/provisioner unreachable).
            # Reporting this as "not found" hid the real cause from callers.
            logger.exception("Failed to prepare staff '%s' for run", staff_id)
            raise HTTPException(status_code=502, detail=f"Failed to prepare staff '{staff_id}': {e}")

    graph_config = GraphContextConfig(**req.graph_config.model_dump()).normalized() if req.graph_config else None
    conversation_id = req.conversation_id

    team_token = current_usage_department.set(req.department_id or "")
    try:
        result = await service.run_with_definitions(
            user_input=req.user_input,
            definitions=definitions,
            max_rounds=req.max_rounds,
            conversation_id=conversation_id,
            graph_context_provider=graph_context_service,
            graph_config=graph_config,
            custom_graph=_build_custom_graph_spec(req, staff_id_to_name),
        )
    finally:
        current_usage_department.reset(team_token)
    return GraphRunResponse.from_result(result)


@router.post("/staff-graph/run-stream")
async def run_staff_graph_stream(
    req: GraphRunRequest,
    staff_service: StaffService = Depends(get_staff_service),
    tool_manager: SkillToolManager = Depends(get_skill_tool_manager),
    graph_context_service: GraphContextService = Depends(get_graph_context_service),
    task_service=Depends(get_task_service),
    owner_id: str = Depends(current_owner_id_dep),
):
    """Stream staff responses in real-time using Server-Sent Events"""
    service = get_staff_graph_service(mode=req.mode)
    if not service:
        raise HTTPException(status_code=503, detail="LLM not configured")
    if req.conversation_id:
        _require_conversation_access(task_service, req.conversation_id, owner_id)

    # Fetch staff from database by ID and bind tools
    definitions = []
    staff_name_to_id: dict[str, str] = {}  # Mapping staff name to ID for stream response
    for staff_id in req.staff:
        try:
            staff = staff_service.get_staff(staff_id)

            # Get tools for this staff's skills
            staff_tools = {}
            skills = staff_service.get_staff_skills(staff_id)
            for skill in skills:
                tool = tool_manager.get_tool_for_skill(skill)
                if tool:
                    staff_tools[skill.id] = tool
                    logger.info(f"Bound tool '{skill.tool_name}' for skill '{skill.id}' (staff: {staff.name})")
                else:
                    logger.debug(f"No tool available for skill '{skill.id}' (staff: {staff.name})")

            definitions.append(
                GraphStaffDefinition(
                    name=staff.name,
                    role=staff.role,
                    system_prompt=staff.system_prompt,
                    description=staff.description,
                    skill_ids=list(staff.skill_ids),
                    tools=staff_tools or None,
                    subagent_enabled=bool(getattr(staff, "subagent_enabled", False)),
                )
            )
            staff_name_to_id[staff.name] = staff_id  # Store mapping
        except NotFoundError as e:
            raise HTTPException(status_code=404, detail=f"Staff '{staff_id}' not found: {e}")
        except Exception as e:
            # Distinct from the 404 above: the staff itself exists but binding
            # one of its tools failed (e.g. sandbox/provisioner unreachable).
            # Reporting this as "not found" hid the real cause from callers.
            logger.exception("Failed to prepare staff '%s' for run", staff_id)
            raise HTTPException(status_code=502, detail=f"Failed to prepare staff '{staff_id}': {e}")

    graph_config = GraphContextConfig(**req.graph_config.model_dump()).normalized() if req.graph_config else None
    conversation_id = req.conversation_id
    staff_id_to_name = {staff_id: name for name, staff_id in staff_name_to_id.items()}

    # Long-term memory scope for this run: owner + the task's team (Business Unit
    # proxy). Recall/inject is done by the LTM middleware; consolidation runs at
    # natural completion. Best-effort — never blocks the run.
    from backend.domain.memory.long_term_memory import MemoryScope
    from backend.infrastructure import long_term_memory_store as ltm_store

    company_id = None
    if conversation_id:
        try:
            task = task_service.get_task(conversation_id)
            company_id = getattr(task, "department_id", None) if task else None
        except Exception:  # noqa: BLE001 — scope is best-effort
            company_id = None
    memory_scope = MemoryScope(company_id=company_id, owner_id=owner_id).normalized()
    custom_graph_spec = _build_custom_graph_spec(req, staff_id_to_name)

    # Register a cancel flag so stop/pause can signal this stream to halt
    cancel_flag = task_run_registry.register(conversation_id) if conversation_id else None

    # How often we re-check the cancel flag while parked waiting for the next
    # event, so a Stop aborts an in-flight turn (LLM call / tool / web search)
    # instead of waiting for the whole turn to finish.
    cancel_poll_seconds = 0.2

    def _is_cancelled() -> bool:
        return bool(cancel_flag and cancel_flag.cancelled)

    async def event_generator():
        """Generate Server-Sent Events for staff turns and intermediate events.

        Stop/pause sets the run's cancel flag (see tasks.py). We poll it both
        between events and *while waiting* for the next event, and on cancel we
        abort the in-flight step and ``aclose()`` the underlying graph stream so
        the backend stops doing work (no further LLM calls, tools or searches)
        rather than running the current turn to completion.
        """
        # Bind the run's LTM scope so the LTM middleware (recall/inject) and
        # end-of-run consolidation see it without a threaded argument.
        scope_token = ltm_store.current_memory_scope.set(memory_scope)
        # Attribute this run's token spend to its department/team for cost monitoring.
        team_token = current_usage_department.set(req.department_id or "")
        agen = service.run_stream_with_definitions(
            user_input=req.user_input,
            definitions=definitions,
            max_rounds=req.max_rounds,
            conversation_id=conversation_id,
            graph_context_provider=graph_context_service,
            graph_config=graph_config,
            custom_graph=custom_graph_spec,
        ).__aiter__()
        cancelled = False
        try:
            while True:
                # Already stopped before fetching the next event.
                if _is_cancelled():
                    cancelled = True
                    break

                next_task = asyncio.ensure_future(agen.__anext__())
                # Race the next event against the cancel signal.
                while True:
                    done, _ = await asyncio.wait({next_task}, timeout=cancel_poll_seconds)
                    if next_task in done:
                        break
                    if _is_cancelled():
                        # Abort the in-flight step: cancelling propagates a
                        # CancelledError into the graph's current await (LLM/tool
                        # call), and aclose() (in finally) tears the stream down.
                        next_task.cancel()
                        with contextlib.suppress(asyncio.CancelledError, StopAsyncIteration, Exception):
                            await next_task
                        cancelled = True
                        break
                if cancelled:
                    break

                try:
                    event = next_task.result()
                except StopAsyncIteration:
                    break

                # Handle both custom events (dicts) and GraphTurn objects
                if isinstance(event, dict):
                    # Custom event from get_stream_writer()
                    event_data = event.copy()
                    # Ensure dataclass payloads (e.g. GraphTurn in turn_complete) are JSON-serializable
                    turn_payload = event_data.get("turn")
                    if turn_payload is not None and hasattr(turn_payload, "__dataclass_fields__"):
                        event_data["turn"] = asdict(turn_payload)
                    # Map staff_name to staff_id if needed
                    if "agent_name" in event_data and "agent_id" not in event_data:
                        event_data["agent_id"] = staff_name_to_id.get(event_data["agent_name"], event_data["agent_name"])
                    if isinstance(event_data.get("turn"), dict):
                        turn_staff_name = event_data["turn"].get("agent_name")
                        if turn_staff_name and "agent_id" not in event_data["turn"]:
                            event_data["turn"]["agent_id"] = staff_name_to_id.get(turn_staff_name, turn_staff_name)
                    # Emit custom event as-is
                    yield f"data: {json.dumps(event_data)}\n\n"
                else:
                    # GraphTurn object from turn_complete event
                    turn = event
                    turn_schema = GraphTurnSchema(
                        turn=turn.turn,
                        staff_id=staff_name_to_id.get(turn.staff_name, turn.staff_name),
                        staff_name=turn.staff_name,
                        staff_role=turn.staff_role,
                        content=turn.content,
                    )
                    yield f"data: {json.dumps(turn_schema.model_dump())}\n\n"

            if cancelled:
                logger.info(
                    "[StaffGraph] STOP — run cancelled, aborting in-flight work | conversation_id=%s",
                    conversation_id,
                )
                yield f"data: {json.dumps({'type': 'cancelled'})}\n\n"
                return

            # Only build graph context if stream completed naturally (not cancelled)
            if conversation_id and not _is_cancelled():
                pack = graph_context_service.build_graph_context(
                    conversation_id=conversation_id,
                    query=req.user_input,
                    config=graph_config,
                )
                if pack.text:
                    yield f"data: {json.dumps({'graph_context': asdict(pack)})}\n\n"

            # Promote salient short-term knowledge into long-term memory on a
            # clean finish (no-op when LTM is disabled). Never breaks the run.
            if conversation_id and not _is_cancelled():
                with contextlib.suppress(Exception):
                    await ltm_store.consolidate(
                        conversation_id=conversation_id, scope=memory_scope
                    )
        except Exception:
            logger.exception(
                "[StaffGraph] run-stream failed | conversation_id=%s", conversation_id
            )
            yield f"data: {json.dumps({'error': 'Internal error while running the staff graph'})}\n\n"
        finally:
            # Tear down the underlying graph stream so any in-flight LLM/tool
            # await is cancelled and the backend stops working on this run.
            with contextlib.suppress(Exception):
                await agen.aclose()
            ltm_store.current_memory_scope.reset(scope_token)
            current_usage_department.reset(team_token)
            if conversation_id:
                task_run_registry.unregister(conversation_id)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
