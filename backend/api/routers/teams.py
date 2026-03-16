from __future__ import annotations

import time

from fastapi import APIRouter, Depends

from backend.api.deps import get_team_service
from backend.api.schemas.team import TeamSchema, UpsertTeamRequest
from backend.application.service.team_service import TeamService
from backend.domain.models import Team


router = APIRouter(prefix="/teams", tags=["teams"])


@router.get("", response_model=list[TeamSchema])
def list_teams(service: TeamService = Depends(get_team_service)) -> list[TeamSchema]:
    return [TeamSchema.from_domain(t) for t in service.list_teams()]


@router.post("", response_model=TeamSchema)
def upsert_team(req: UpsertTeamRequest, service: TeamService = Depends(get_team_service)) -> TeamSchema:
    team_id = req.id or f"t{int(time.time() * 1000)}"
    team = Team(
        id=team_id,
        name=req.name,
        description=req.description or "Custom team",
        agents=list(req.agents),
        active_tasks=req.activeTasks,
    )
    saved = service.upsert_team(team)
    return TeamSchema.from_domain(saved)


@router.delete("/{team_id}")
def delete_team(team_id: str, service: TeamService = Depends(get_team_service)) -> dict:
    service.delete_team(team_id)
    return {"deleted": True}
