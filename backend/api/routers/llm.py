from __future__ import annotations

import json
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.api.deps import (
    get_agent_graph_service,
    get_agent_service,
    get_graph_context_service,
    get_llm_service,
    get_skill_tool_manager,
)
from backend.api.schemas.agent_graph import GraphRunRequest, GraphRunResponse, GraphTurnSchema
from backend.application.ports.agent_graph import GraphAgentDefinition
from backend.application.service.agent_service import AgentService
from backend.application.service.agent_graph_service import AgentGraphService
from backend.application.service.graph_context_service import GraphContextService
from backend.application.service.llm_service import LLMService
from backend.domain.memory.knowledge_graph import GraphContextConfig
from backend.domain.service.skill_tool_service import SkillToolManager
from backend.log import get_logger


router = APIRouter(prefix="/llm", tags=["llm"])
logger = get_logger(__name__)


class ChatRequest(BaseModel):
    prompt: str = Field(min_length=1)
    system: str | None = None
    agentId: str | None = None


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
        raise HTTPException(status_code=503, detail="LLM not configured (missing GEMINI_API_KEY)")
    system_prompt = req.system
    tools: list[object] = []
    if req.agentId:
        try:
            agent = agent_service.get_agent(req.agentId)
            if not system_prompt:
                system_prompt = agent.system_prompt or None

            skills = agent_service.get_agent_skills(req.agentId)
            for skill in skills:
                toolkit = tool_manager.get_tool_for_skill(skill)
                if toolkit:
                    tools.extend(toolkit.get_tools())
        except Exception:
            if not system_prompt:
                system_prompt = None

    text = await service.chat(
        prompt=req.prompt,
        system=system_prompt or "You are a helpful assistant.",
        tools=tools or None,
    )
    return ChatResponse(response=text)


@router.post("/agent-graph/run", response_model=GraphRunResponse)
async def run_agent_graph(
    req: GraphRunRequest,
    agent_service: AgentService = Depends(get_agent_service),
    tool_manager: SkillToolManager = Depends(get_skill_tool_manager),
    graph_context_service: GraphContextService = Depends(get_graph_context_service),
) -> GraphRunResponse:
    service = get_agent_graph_service(mode=req.mode)
    if not service:
        raise HTTPException(status_code=503, detail="LLM not configured (missing GEMINI_API_KEY)")

    # Fetch agents from database by ID and bind tools
    definitions = []
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
                )
            )
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
    )
    return GraphRunResponse.from_result(result)


@router.post("/agent-graph/run-stream")
async def run_agent_graph_stream(
    req: GraphRunRequest,
    agent_service: AgentService = Depends(get_agent_service),
    tool_manager: SkillToolManager = Depends(get_skill_tool_manager),
    graph_context_service: GraphContextService = Depends(get_graph_context_service),
):
    """Stream agent responses in real-time using Server-Sent Events"""
    service = get_agent_graph_service(mode=req.mode)
    if not service:
        raise HTTPException(status_code=503, detail="LLM not configured (missing GEMINI_API_KEY)")

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

    async def event_generator():
        """Generate Server-Sent Events for agent turns and intermediate events"""
        try:
            async for event in service.run_stream_with_definitions(
                user_input=req.user_input,
                definitions=definitions,
                max_rounds=req.max_rounds,
                conversation_id=conversation_id,
                graph_context_provider=graph_context_service,
                graph_config=graph_config,
            ):
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
            
            if conversation_id:
                pack = graph_context_service.build_graph_context(
                    conversation_id=conversation_id,
                    query=req.user_input,
                    config=graph_config,
                )
                if pack.text:
                    yield f"data: {json.dumps({'graph_context': asdict(pack)})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
