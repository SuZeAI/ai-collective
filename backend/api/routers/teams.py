from __future__ import annotations

from uuid import uuid4
from dataclasses import replace
from datetime import datetime, timezone
import time
from fastapi import APIRouter, Depends, HTTPException

from backend.api.deps import current_owner_id_dep, get_agent_service, get_conversation_service, get_team_service
from backend.api.schemas.team import TeamSchema, UpsertTeamRequest
from backend.application.service.agent_service import AgentService
from backend.application.service.conversation_service import ConversationService
from backend.application.service.team_service import TeamService
from backend.domain.enums import AgentStatus
from backend.domain.errors import NotFoundError
from backend.domain.models import Message, Team, can_delete, can_modify, is_visible_to


router = APIRouter(prefix="/teams", tags=["teams"])


def _activate_team_agents(agent_ids: list[str], agent_service: AgentService) -> None:
    for agent_id in agent_ids:
        try:
            agent = agent_service.get_agent(agent_id)
        except Exception:
            continue
        if agent.status != AgentStatus.active:
            agent_service.upsert_agent(replace(agent, status=AgentStatus.active))


def _seed_team_kickoff_messages(team: Team, agent_service: AgentService, conv_service: ConversationService) -> None:
    if not team.agents:
        return

    roster = []
    for agent_id in team.agents:
        try:
            roster.append(agent_service.get_agent(agent_id))
        except Exception:
            continue
    if not roster:
        return

    lines = [
        f"Team {team.name} is now active. Let's align on goals and deliverables.",
        "I will break down responsibilities and coordinate the first execution cycle.",
        "Acknowledged. I am ready and starting my assigned part now.",
    ]
    base_ts = int(time.time() * 1000)
    task_ref = f"team:{team.id}"

    for idx, text in enumerate(lines):
        speaker = roster[idx % len(roster)]
        conv_service.add_message(
            Message(
                id=f"m{base_ts + idx}",
                agent_id=speaker.id,
                content=text,
                timestamp=datetime.now(timezone.utc).replace(microsecond=0),
                task_id=task_ref,
            )
        )


@router.get("", response_model=list[TeamSchema])
def list_teams(
    service: TeamService = Depends(get_team_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> list[TeamSchema]:
    return [
        TeamSchema.from_domain(t)
        for t in service.list_teams()
        if is_visible_to(owner_id, t.owner_id)
    ]


@router.post("", response_model=TeamSchema)
def upsert_team(
    req: UpsertTeamRequest,
    service: TeamService = Depends(get_team_service),
    agent_service: AgentService = Depends(get_agent_service),
    conv_service: ConversationService = Depends(get_conversation_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> TeamSchema:
    team_id = req.id or f"team_{uuid4().hex}"
    is_new_team = req.id is None
    existing = service._repo.get(team_id) if req.id else None
    if existing is not None and not is_visible_to(owner_id, existing.owner_id):
        raise NotFoundError(f"Team '{team_id}' not found")
    if existing is not None and not can_modify(owner_id, existing.owner_id):
        raise HTTPException(status_code=403, detail="Only the default (admin) account can edit shared default items")
    active_tasks = req.activeTasks
    if is_new_team and req.agents:
        # A newly created team starts in active mode.
        active_tasks = max(1, req.activeTasks)

    team = Team(
        id=team_id,
        name=req.name,
        description=req.description or "Custom team",
        agents=list(req.agents),
        active_tasks=active_tasks,
        avatar=((req.avatar or "").strip() or req.name[:1].upper() or "T"),
        avatar_icon=(req.avatar_icon or "").strip(),
        avatar_color=(req.avatar_color or "").strip(),
        avatar_url=(req.avatar_url or "").strip(),
        mode=req.mode or "sequential",
        max_steps=req.maxSteps or 6,
        owner_id=existing.owner_id if existing else owner_id,
    )
    saved = service.upsert_team(team)

    if is_new_team:
        _activate_team_agents(saved.agents, agent_service)
        _seed_team_kickoff_messages(saved, agent_service, conv_service)

    return TeamSchema.from_domain(saved)


@router.delete("/{team_id}")
def delete_team(
    team_id: str,
    service: TeamService = Depends(get_team_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> dict:
    existing = service._repo.get(team_id)
    if existing is not None and not is_visible_to(owner_id, existing.owner_id):
        raise NotFoundError(f"Team '{team_id}' not found")
    if existing is not None and not can_delete(owner_id, existing.owner_id):
        raise HTTPException(status_code=403, detail="Only the default (admin) account can delete shared default items")
    service.delete_team(team_id)
    return {"deleted": True}
