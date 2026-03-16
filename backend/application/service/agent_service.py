from __future__ import annotations

from backend.application.ports.repositories import AgentRepository
from backend.domain.errors import NotFoundError
from backend.domain.models import Agent


class AgentService:
    def __init__(self, repo: AgentRepository):
        self._repo = repo

    def list_agents(self) -> list[Agent]:
        return self._repo.list()

    def get_agent(self, agent_id: str) -> Agent:
        agent = self._repo.get(agent_id)
        if not agent:
            raise NotFoundError(f"Agent '{agent_id}' not found")
        return agent

    def upsert_agent(self, agent: Agent) -> Agent:
        return self._repo.upsert(agent)

    def delete_agent(self, agent_id: str) -> None:
        if not self._repo.get(agent_id):
            raise NotFoundError(f"Agent '{agent_id}' not found")
        self._repo.delete(agent_id)
