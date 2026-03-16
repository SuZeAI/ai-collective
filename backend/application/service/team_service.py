from __future__ import annotations

from backend.application.ports.repositories import TeamRepository
from backend.domain.errors import NotFoundError
from backend.domain.models import Team


class TeamService:
    def __init__(self, repo: TeamRepository):
        self._repo = repo

    def list_teams(self) -> list[Team]:
        return self._repo.list()

    def get_team(self, team_id: str) -> Team:
        team = self._repo.get(team_id)
        if not team:
            raise NotFoundError(f"Team '{team_id}' not found")
        return team

    def upsert_team(self, team: Team) -> Team:
        return self._repo.upsert(team)

    def delete_team(self, team_id: str) -> None:
        if not self._repo.get(team_id):
            raise NotFoundError(f"Team '{team_id}' not found")
        self._repo.delete(team_id)
