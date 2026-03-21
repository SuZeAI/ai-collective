from __future__ import annotations

from backend.application.ports.repositories import AgentRepository, SkillRepository
from backend.domain.errors import NotFoundError
from backend.domain.models import Agent, Skill


class AgentService:
    def __init__(self, repo: AgentRepository, skill_repo: SkillRepository = None):
        self._repo = repo
        self._skill_repo = skill_repo

    def list_agents(self) -> list[Agent]:
        return self._repo.list()

    def get_agent(self, agent_id: str) -> Agent:
        agent = self._repo.get(agent_id)
        if not agent:
            raise NotFoundError(f"Agent '{agent_id}' not found")
        return agent

    def get_agent_skills(self, agent_id: str) -> list[Skill]:
        """Resolve agent's skill_ids to full Skill objects"""
        if not self._skill_repo:
            return []
        agent = self.get_agent(agent_id)
        skills = []
        for skill_id in agent.skill_ids:
            skill = self._skill_repo.get(skill_id)
            if skill:
                skills.append(skill)
        return skills

    def upsert_agent(self, agent: Agent) -> Agent:
        return self._repo.upsert(agent)

    def delete_agent(self, agent_id: str) -> None:
        if not self._repo.get(agent_id):
            raise NotFoundError(f"Agent '{agent_id}' not found")
        self._repo.delete(agent_id)
