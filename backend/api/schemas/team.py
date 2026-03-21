from __future__ import annotations

from pydantic import BaseModel


class TeamSchema(BaseModel):
    id: str
    name: str
    description: str
    agents: list[str]
    activeTasks: int
    mode: str = "sequential"

    @staticmethod
    def from_domain(t) -> "TeamSchema":
        return TeamSchema(
            id=t.id,
            name=t.name,
            description=t.description,
            agents=list(t.agents),
            activeTasks=t.active_tasks,
            mode=t.mode,
        )


class UpsertTeamRequest(BaseModel):
    id: str | None = None
    name: str
    description: str = ""
    agents: list[str]
    activeTasks: int = 0
    mode: str = "sequential"
