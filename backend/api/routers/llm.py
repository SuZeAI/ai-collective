from __future__ import annotations

import asyncio
import contextlib
import json
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.api.deps import (
    current_owner_id_dep,
    get_agent_graph_service,
    get_agent_service,
    get_graph_context_service,
    get_llm_service,
    get_skill_tool_manager,
    get_task_service,
)
from backend.api.schemas.agent_graph import GraphRunRequest, GraphRunResponse, GraphTurnSchema
from backend.application.ports.agent_graph import CustomGraphSpec, GraphAgentDefinition
from backend.application.service.agent_service import AgentService
from backend.application.service.graph_context_service import GraphContextService
from backend.application.service.llm_service import LLMService
from backend.domain.memory.knowledge_graph import GraphContextConfig
from backend.domain.service.skill_tool_service import SkillToolManager
from backend.infrastructure import task_run_registry
from backend.log import get_logger


router = APIRouter(prefix="/llm", tags=["llm"])
logger = get_logger(__name__)


class ChatRequest(BaseModel):
    prompt: str = Field(min_length=1)
    system: str | None = None
    agentId: str | None = None
    conversationId: str | None = None


class ChatResponse(BaseModel):
    response: str


@router.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    service: LLMService | None = Depends(get_llm_service),
    agent_service: AgentService = Depends(get_agent_service),
    tool_manager: SkillToolManager = Depends(get_skill_tool_manager),
) -> ChatResponse:
    if not service:
        raise HTTPException(status_code=503, detail="LLM not configured")
    system_prompt = req.system
    tools: list[object] = []
    subagent_enabled = False
    if req.agentId:
        try:
            agent = agent_service.get_agent(req.agentId)
            if not system_prompt:
                system_prompt = agent.system_prompt or None
            subagent_enabled = bool(getattr(agent, "subagent_enabled", False))

            skills = agent_service.get_agent_skills(req.agentId)
            for skill in skills:
                toolkit = tool_manager.get_tool_for_skill(skill)
                if toolkit:
                    tools.extend(toolkit.get_tools())
        except Exception as exc:
            logger.exception("Failed to resolve tools for agent '%s': %s", req.agentId, exc)
            if not system_prompt:
                system_prompt = None

    # Agent Mode: expose the `task` tool (subagent delegation) and run tool
    # calls in parallel. Subagents inherit the agent's tools (minus `task`).
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
    # the shared sandbox and inject the file/document tools so the agent can read
    # the uploads (mirrors the agent-graph path).
    prompt = req.prompt
    if req.conversationId:
        try:
            from backend.domain.agent._graph_runtime import (
                attach_conversation_sandbox,
                uploads_hint,
            )

            agent_name = req.agentId or "assistant"
            if attach_conversation_sandbox(tools, conversation_id=req.conversationId, agent_name=agent_name):
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
    """Human-in-the-loop message posted while an agent-graph run is streaming."""

    conversation_id: str = Field(min_length=1)
    content: str = Field(min_length=1, max_length=8000)


class InterjectResponse(BaseModel):
    queued: bool
    message_id: str | None = None


@router.post("/agent-graph/interject", response_model=InterjectResponse)
async def interject_agent_graph(req: InterjectRequest) -> InterjectResponse:
    """Queue a user message for an active run.

    The next agent turn drains the queue, injects the message into its context
    (and into the knowledge graph), and emits a ``user_message_injected``
    stream event. Returns 409 when the run is no longer active so the client
    can tell the user their guidance was not consumed.
    """
    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=422, detail="content must not be blank")
    message_id = task_run_registry.post_user_message(req.conversation_id, content)
    if message_id is None:
        raise HTTPException(
            status_code=409,
            detail="No active run for this conversation (it may have finished or been stopped)",
        )
    return InterjectResponse(queued=True, message_id=message_id)


class UserResponseRequest(BaseModel):
    """Answer to an agent's ask_user question on an active run."""

    conversation_id: str = Field(min_length=1)
    request_id: str = Field(min_length=1)
    response: str = Field(min_length=1, max_length=8000)


@router.post("/agent-graph/respond")
async def respond_agent_graph(req: UserResponseRequest) -> dict:
    """Deliver the user's answer to an agent blocked on the ask_user tool.

    The tool's poll loop picks the answer up, emits ``user_input_received``
    on the stream, and returns the answer to the LLM so it continues its turn.
    """
    response = req.response.strip()
    if not response:
        raise HTTPException(status_code=422, detail="response must not be blank")
    status = task_run_registry.answer_user_request(req.conversation_id, req.request_id, response)
    if status == "no_run":
        raise HTTPException(
            status_code=409,
            detail="No active run for this conversation (it may have finished or been stopped)",
        )
    if status == "unknown_request":
        raise HTTPException(
            status_code=404,
            detail="This question is no longer open (already answered or timed out)",
        )
    return {"delivered": True}


class RunControlRequest(BaseModel):
    """Targets an actively streaming agent-graph run by conversation id."""

    conversation_id: str = Field(min_length=1)


@router.post("/agent-graph/pause")
async def pause_agent_graph(req: RunControlRequest) -> dict:
    """Interrupt an active run: the current agent finishes its turn, then the
    run holds at the turn boundary so the user can chat before resuming."""
    if not task_run_registry.signal_pause(req.conversation_id):
        raise HTTPException(
            status_code=409,
            detail="No active run for this conversation (it may have finished or been stopped)",
        )
    return {"paused": True}


@router.post("/agent-graph/resume")
async def resume_agent_graph(req: RunControlRequest) -> dict:
    """Release a held run; the next agent turn proceeds (and picks up any
    interjected messages queued during the hold)."""
    if not task_run_registry.signal_resume(req.conversation_id):
        raise HTTPException(
            status_code=409,
            detail="No active run for this conversation (it may have finished or been stopped)",
        )
    return {"resumed": True}


def _build_custom_graph_spec(
    req: GraphRunRequest, agent_id_to_name: dict[str, str]
) -> CustomGraphSpec | None:
    """Translate the request's agent-id-based custom graph into a name-based
    CustomGraphSpec the orchestrators understand. Returns None unless mode is
    'custom' with a graph attached."""
    if req.mode != "custom" or req.custom_graph is None:
        return None
    edges = tuple(
        (agent_id_to_name[e.source], agent_id_to_name[e.target])
        for e in req.custom_graph.edges
        if e.source in agent_id_to_name and e.target in agent_id_to_name
    )
    entry = tuple(
        agent_id_to_name[n]
        for n in (req.custom_graph.entry or [])
        if n in agent_id_to_name
    )
    return CustomGraphSpec(edges=edges, entry=entry)


@router.post("/agent-graph/run", response_model=GraphRunResponse)
async def run_agent_graph(
    req: GraphRunRequest,
    agent_service: AgentService = Depends(get_agent_service),
    tool_manager: SkillToolManager = Depends(get_skill_tool_manager),
    graph_context_service: GraphContextService = Depends(get_graph_context_service),
) -> GraphRunResponse:
    service = get_agent_graph_service(mode=req.mode)
    if not service:
        raise HTTPException(status_code=503, detail="LLM not configured")

    # Fetch agents from database by ID and bind tools
    definitions = []
    agent_id_to_name: dict[str, str] = {}  # for translating custom_graph ids -> names
    for agent_id in req.agents:
        try:
            agent = agent_service.get_agent(agent_id)

            # Get tools for this agent's skills
            agent_tools = {}
            skills = agent_service.get_agent_skills(agent_id)
            for skill in skills:
                tool = tool_manager.get_tool_for_skill(skill)
                if tool:
                    agent_tools[skill.id] = tool
                    logger.info(f"Bound tool '{skill.tool_name}' for skill '{skill.id}' (agent: {agent.name})")
                else:
                    logger.debug(f"No tool available for skill '{skill.id}' (agent: {agent.name})")

            definitions.append(
                GraphAgentDefinition(
                    name=agent.name,
                    role=agent.role,
                    system_prompt=agent.system_prompt,
                    description=agent.description,
                    skill_ids=list(agent.skill_ids),
                    tools=agent_tools or None,
                    subagent_enabled=bool(getattr(agent, "subagent_enabled", False)),
                )
            )
            agent_id_to_name[agent_id] = agent.name
        except Exception as e:
            raise HTTPException(
                status_code=404,
                detail=f"Agent '{agent_id}' not found: {str(e)}"
            )

    graph_config = GraphContextConfig(**req.graph_config.model_dump()).normalized() if req.graph_config else None
    conversation_id = req.conversation_id

    result = await service.run_with_definitions(
        user_input=req.user_input,
        definitions=definitions,
        max_rounds=req.max_rounds,
        conversation_id=conversation_id,
        graph_context_provider=graph_context_service,
        graph_config=graph_config,
        custom_graph=_build_custom_graph_spec(req, agent_id_to_name),
    )
    return GraphRunResponse.from_result(result)


@router.post("/agent-graph/run-stream")
async def run_agent_graph_stream(
    req: GraphRunRequest,
    agent_service: AgentService = Depends(get_agent_service),
    tool_manager: SkillToolManager = Depends(get_skill_tool_manager),
    graph_context_service: GraphContextService = Depends(get_graph_context_service),
    task_service=Depends(get_task_service),
    owner_id: str = Depends(current_owner_id_dep),
):
    """Stream agent responses in real-time using Server-Sent Events"""
    service = get_agent_graph_service(mode=req.mode)
    if not service:
        raise HTTPException(status_code=503, detail="LLM not configured")

    # Fetch agents from database by ID and bind tools
    definitions = []
    agent_name_to_id: dict[str, str] = {}  # Mapping agent name to ID for stream response
    for agent_id in req.agents:
        try:
            agent = agent_service.get_agent(agent_id)

            # Get tools for this agent's skills
            agent_tools = {}
            skills = agent_service.get_agent_skills(agent_id)
            for skill in skills:
                tool = tool_manager.get_tool_for_skill(skill)
                if tool:
                    agent_tools[skill.id] = tool
                    logger.info(f"Bound tool '{skill.tool_name}' for skill '{skill.id}' (agent: {agent.name})")
                else:
                    logger.debug(f"No tool available for skill '{skill.id}' (agent: {agent.name})")

            definitions.append(
                GraphAgentDefinition(
                    name=agent.name,
                    role=agent.role,
                    system_prompt=agent.system_prompt,
                    description=agent.description,
                    skill_ids=list(agent.skill_ids),
                    tools=agent_tools or None,
                    subagent_enabled=bool(getattr(agent, "subagent_enabled", False)),
                )
            )
            agent_name_to_id[agent.name] = agent_id  # Store mapping
        except Exception as e:
            raise HTTPException(
                status_code=404,
                detail=f"Agent '{agent_id}' not found: {str(e)}"
            )

    graph_config = GraphContextConfig(**req.graph_config.model_dump()).normalized() if req.graph_config else None
    conversation_id = req.conversation_id
    agent_id_to_name = {agent_id: name for name, agent_id in agent_name_to_id.items()}

    # Long-term memory scope for this run: owner + the task's team (Business Unit
    # proxy). Recall/inject is done by the LTM middleware; consolidation runs at
    # natural completion. Best-effort — never blocks the run.
    from backend.domain.memory.long_term_memory import MemoryScope
    from backend.infrastructure import long_term_memory_store as ltm_store

    workspace_id = None
    if conversation_id:
        try:
            task = task_service.get_task(conversation_id)
            workspace_id = getattr(task, "team_id", None) if task else None
        except Exception:  # noqa: BLE001 — scope is best-effort
            workspace_id = None
    memory_scope = MemoryScope(workspace_id=workspace_id, owner_id=owner_id).normalized()
    custom_graph_spec = _build_custom_graph_spec(req, agent_id_to_name)

    # Register a cancel flag so stop/pause can signal this stream to halt
    cancel_flag = task_run_registry.register(conversation_id) if conversation_id else None

    # How often we re-check the cancel flag while parked waiting for the next
    # event, so a Stop aborts an in-flight turn (LLM call / tool / web search)
    # instead of waiting for the whole turn to finish.
    cancel_poll_seconds = 0.2

    def _is_cancelled() -> bool:
        return bool(cancel_flag and cancel_flag.cancelled)

    async def event_generator():
        """Generate Server-Sent Events for agent turns and intermediate events.

        Stop/pause sets the run's cancel flag (see tasks.py). We poll it both
        between events and *while waiting* for the next event, and on cancel we
        abort the in-flight step and ``aclose()`` the underlying graph stream so
        the backend stops doing work (no further LLM calls, tools or searches)
        rather than running the current turn to completion.
        """
        # Bind the run's LTM scope so the LTM middleware (recall/inject) and
        # end-of-run consolidation see it without a threaded argument.
        scope_token = ltm_store.current_memory_scope.set(memory_scope)
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
                    # Map agent_name to agent_id if needed
                    if "agent_name" in event_data and "agent_id" not in event_data:
                        event_data["agent_id"] = agent_name_to_id.get(event_data["agent_name"], event_data["agent_name"])
                    if isinstance(event_data.get("turn"), dict):
                        turn_agent_name = event_data["turn"].get("agent_name")
                        if turn_agent_name and "agent_id" not in event_data["turn"]:
                            event_data["turn"]["agent_id"] = agent_name_to_id.get(turn_agent_name, turn_agent_name)
                    # Emit custom event as-is
                    yield f"data: {json.dumps(event_data)}\n\n"
                else:
                    # GraphTurn object from turn_complete event
                    turn = event
                    turn_schema = GraphTurnSchema(
                        turn=turn.turn,
                        agent_id=agent_name_to_id.get(turn.agent_name, turn.agent_name),
                        agent_name=turn.agent_name,
                        agent_role=turn.agent_role,
                        content=turn.content,
                    )
                    yield f"data: {json.dumps(turn_schema.model_dump())}\n\n"

            if cancelled:
                logger.info(
                    "[AgentGraph] STOP — run cancelled, aborting in-flight work | conversation_id=%s",
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
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            # Tear down the underlying graph stream so any in-flight LLM/tool
            # await is cancelled and the backend stops working on this run.
            with contextlib.suppress(Exception):
                await agen.aclose()
            ltm_store.current_memory_scope.reset(scope_token)
            if conversation_id:
                task_run_registry.unregister(conversation_id)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
