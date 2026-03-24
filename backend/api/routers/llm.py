from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.api.deps import (
    get_agent_graph_service,
    get_agent_service,
    get_llm_service,
    get_skill_tool_manager,
)
from backend.api.schemas.agent_graph import GraphRunRequest, GraphRunResponse, GraphTurnSchema
from backend.application.ports.agent_graph import GraphAgentDefinition
from backend.application.service.agent_service import AgentService
from backend.application.service.agent_graph_service import AgentGraphService
from backend.application.service.llm_service import LLMService
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
                    skill_ids=list(agent.skill_ids),
                    tools=agent_tools or None,
                )
            )
        except Exception as e:
            raise HTTPException(
                status_code=404, 
                detail=f"Agent '{agent_id}' not found: {str(e)}"
            )

    result = await service.run_with_definitions(
        user_input=req.user_input,
        definitions=definitions,
        max_rounds=req.max_rounds,
    )
    return GraphRunResponse.from_result(result)


@router.post("/agent-graph/run-stream")
async def run_agent_graph_stream(
    req: GraphRunRequest,
    agent_service: AgentService = Depends(get_agent_service),
    tool_manager: SkillToolManager = Depends(get_skill_tool_manager),
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

    async def event_generator():
        """Generate Server-Sent Events for each agent turn"""
        try:
            async for turn in service.run_stream_with_definitions(
                user_input=req.user_input,
                definitions=definitions,
                max_rounds=req.max_rounds,
            ):
                # Convert GraphTurn to GraphTurnSchema and serialize to JSON
                turn_schema = GraphTurnSchema(
                    turn=turn.turn,
                    agent_id=agent_name_to_id.get(turn.agent_name, turn.agent_name),  # Look up agent ID
                    agent_name=turn.agent_name,
                    agent_role=turn.agent_role,
                    content=turn.content,
                )
                # Yield as SSE format: data: {json}\n\n
                yield f"data: {json.dumps(turn_schema.model_dump())}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
