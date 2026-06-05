from __future__ import annotations

from backend.application.ports.repositories import AgentRepository, SkillRepository
from backend.domain.service.skill_tool_service import SkillToolManager
from backend.domain.errors import NotFoundError
from backend.domain.models import Agent, Skill
from backend.domain.tools.base import BaseToolkit


class AgentService:
    def __init__(self, repo: AgentRepository, skill_repo: SkillRepository | None = None):
        self._repo = repo
        self._skill_repo = skill_repo
        self._tool_manager = SkillToolManager()

    def list_agents(self) -> list[Agent]:
        return self._repo.list()

    def list_agents_with_skills(self) -> list[tuple[Agent, list[Skill]]]:
        """Return every agent paired with its resolved skills.

        Loads all skills once and maps in memory, avoiding the N+1 pattern of
        calling get_agent_skills() (which re-fetches the agent and hits the
        skill repo per skill) inside a loop.
        """
        agents = self._repo.list()
        if not self._skill_repo:
            return [(agent, []) for agent in agents]
        skills_by_id = {s.id: s for s in self._skill_repo.list()}
        return [
            (agent, [skills_by_id[sid] for sid in agent.skill_ids if sid in skills_by_id])
            for agent in agents
        ]

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

    def get_agent_tools(self, agent_id: str) -> dict[str, BaseToolkit]:
        """Get bound tools for all of agent's skills.
        
        Returns:
            Dict mapping skill_id to tool instance
        """
        skills = self.get_agent_skills(agent_id)
        tools = {}
        for skill in skills:
            tool = self._tool_manager.get_tool_for_skill(skill)
            if tool:
                tools[skill.id] = tool
        return tools

    def upsert_agent(self, agent: Agent) -> Agent:
        return self._repo.upsert(agent)

    def delete_agent(self, agent_id: str) -> None:
        if not self._repo.get(agent_id):
            raise NotFoundError(f"Agent '{agent_id}' not found")
        self._repo.delete(agent_id)
