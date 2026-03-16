from __future__ import annotations

import time

from fastapi import APIRouter, Depends

from backend.api.schemas.agent import AgentSchema, UpsertAgentRequest
from backend.application.service.agent_service import AgentService
from backend.api.deps import get_agent_service
from backend.domain.enums import AgentStatus
from backend.domain.models import Agent, Skill


router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("", response_model=list[AgentSchema])
def list_agents(service: AgentService = Depends(get_agent_service)) -> list[AgentSchema]:
    return [AgentSchema.from_domain(a) for a in service.list_agents()]


@router.post("", response_model=AgentSchema)
def upsert_agent(req: UpsertAgentRequest, service: AgentService = Depends(get_agent_service)) -> AgentSchema:
    agent_id = req.id or f"a{int(time.time() * 1000)}"
    avatar = req.avatar or (req.name[:1].upper() if req.name else "A")

    skills: list[Skill] = []
    for i, s in enumerate(req.skills or []):
        skill_id = s.id or f"{agent_id}-s{i+1}"
        skills.append(
            Skill(
                id=skill_id,
                name=s.name,
                description=s.description or "",
                third_party=s.third_party or "",
                kind=s.kind or "integration",
                config=dict(s.config or {}),
                code=s.code,
            )
        )

    agent = Agent(
        id=agent_id,
        name=req.name,
        role=req.role,
        description=req.description or f"{req.role} agent",
        skills=skills,
        status=AgentStatus(req.status),
        avatar=avatar,
    )
    saved = service.upsert_agent(agent)
    return AgentSchema.from_domain(saved)


@router.delete("/{agent_id}")
def delete_agent(agent_id: str, service: AgentService = Depends(get_agent_service)) -> dict:
    service.delete_agent(agent_id)
    return {"deleted": True}
