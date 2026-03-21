from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.api.deps import get_agent_graph_service, get_agent_service, get_llm_service
from backend.api.schemas.agent_graph import GraphRunRequest, GraphRunResponse, GraphTurnSchema
from backend.application.ports.agent_graph import GraphAgentDefinition
from backend.application.service.agent_service import AgentService
from backend.application.service.agent_graph_service import AgentGraphService
from backend.application.service.llm_service import LLMService


router = APIRouter(prefix="/llm", tags=["llm"])


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
) -> ChatResponse:
    if not service:
        raise HTTPException(status_code=503, detail="LLM not configured (missing GEMINI_API_KEY)")
    system_prompt = req.system
    if not system_prompt and req.agentId:
        try:
            agent = agent_service.get_agent(req.agentId)
            system_prompt = agent.system_prompt or None
        except Exception:
            system_prompt = None

    text = await service.chat(prompt=req.prompt, system=system_prompt or "You are a helpful assistant.")
    return ChatResponse(response=text)


@router.post("/agent-graph/run", response_model=GraphRunResponse)
async def run_agent_graph(
    req: GraphRunRequest,
    agent_service: AgentService = Depends(get_agent_service),
) -> GraphRunResponse:
    service = get_agent_graph_service(mode=req.mode)
    if not service:
        raise HTTPException(status_code=503, detail="LLM not configured (missing GEMINI_API_KEY)")

    # Fetch agents from database by ID
    definitions = []
    for agent_id in req.agents:
        try:
            agent = agent_service.get_agent(agent_id)
            definitions.append(
                GraphAgentDefinition(
                    name=agent.name,
                    role=agent.role,
                    system_prompt=agent.system_prompt,
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
):
    """Stream agent responses in real-time using Server-Sent Events"""
    service = get_agent_graph_service(mode=req.mode)
    if not service:
        raise HTTPException(status_code=503, detail="LLM not configured (missing GEMINI_API_KEY)")

    # Fetch agents from database by ID
    definitions = []
    for agent_id in req.agents:
        try:
            agent = agent_service.get_agent(agent_id)
            definitions.append(
                GraphAgentDefinition(
                    name=agent.name,
                    role=agent.role,
                    system_prompt=agent.system_prompt,
                )
            )
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
                    agent_name=turn.agent_name,
                    agent_role=turn.agent_role,
                    content=turn.content,
                )
                # Yield as SSE format: data: {json}\n\n
                yield f"data: {json.dumps(turn_schema.model_dump())}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
