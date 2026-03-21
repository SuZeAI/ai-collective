from __future__ import annotations

import time

from fastapi import APIRouter, Depends

from backend.api.schemas.agent import AgentSchema, UpsertAgentRequest
from backend.application.service.agent_service import AgentService
from backend.api.deps import get_agent_service
from backend.domain.enums import AgentStatus
from backend.domain.models import Agent


router = APIRouter(prefix="/agents", tags=["agents"])


def _build_agent_system_prompt(*, name: str, role: str, description: str) -> str:
    return (
        f"You are {name}, working as a {role}. "
        f"Your mission: {description.strip() or f'perform the responsibilities of a {role}'}. "
        "Provide concise, practical, and high-quality outputs. "
        "When information is missing, ask targeted follow-up questions before acting."
    )


@router.get("", response_model=list[AgentSchema])
def list_agents(service: AgentService = Depends(get_agent_service)) -> list[AgentSchema]:
    agents = service.list_agents()
    result = []
    for agent in agents:
        skills = service.get_agent_skills(agent.id)
        result.append(AgentSchema.from_domain(agent, skills))
    return result


@router.post("", response_model=AgentSchema)
def upsert_agent(req: UpsertAgentRequest, service: AgentService = Depends(get_agent_service)) -> AgentSchema:
    agent_id = req.id or f"a{int(time.time() * 1000)}"
    avatar = req.avatar or (req.name[:1].upper() if req.name else "A")

    agent = Agent(
        id=agent_id,
        name=req.name,
        role=req.role,
        description=req.description or f"{req.role} agent",
        skill_ids=req.skill_ids or [],
        status=AgentStatus(req.status),
        avatar=avatar,
        system_prompt=(
            req.system_prompt.strip()
            if isinstance(req.system_prompt, str) and req.system_prompt.strip()
            else _build_agent_system_prompt(
                name=req.name,
                role=req.role,
                description=req.description or f"{req.role} agent",
            )
        ),
    )
    saved = service.upsert_agent(agent)
    skills = service.get_agent_skills(saved.id)
    return AgentSchema.from_domain(saved, skills)


@router.delete("/{agent_id}")
def delete_agent(agent_id: str, service: AgentService = Depends(get_agent_service)) -> dict:
    service.delete_agent(agent_id)
    return {"deleted": True}
