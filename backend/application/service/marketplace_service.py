from __future__ import annotations

from dataclasses import replace
from uuid import uuid4

from backend.application.service.agent_service import AgentService
from backend.application.service.document_library_service import DocumentLibraryService
from backend.application.service.skill_service import SkillService
from backend.application.service.task_service import TaskService
from backend.application.service.team_service import TeamService
from backend.domain.enums import AgentStatus, TaskStatus
from backend.domain.errors import NotFoundError, ValidationError
from backend.domain.models import (
    DEFAULT_OWNER_ID,
    Agent,
    LibraryDocument,
    Skill,
    Task,
    Team,
)

# Workspace id under which admins keep the shared "default" document catalog
# (mirrors CATALOG_WORKSPACE_ID on the frontend). Documents are workspace-bound,
# so catalog docs live here rather than in any single office.
CATALOG_WORKSPACE_ID = "__default__"

# The entity kinds users can browse and clone from the marketplace.
MARKETPLACE_KINDS = ("skill", "agent", "team", "task", "document")


class MarketplaceService:
    """Browse shared "default" items and deep-copy them into a user's scope.

    Copying is done server-side so the whole dependency graph (a team's agents,
    each agent's skills, a task's team) is cloned with freshly minted ids and
    re-owned by the requesting user — the clone runs immediately and editing it
    never touches the shared original.
    """

    def __init__(
        self,
        agent_service: AgentService,
        skill_service: SkillService,
        team_service: TeamService,
        task_service: TaskService,
        document_service: DocumentLibraryService,
    ) -> None:
        self._agents = agent_service
        self._skills = skill_service
        self._teams = team_service
        self._tasks = task_service
        self._documents = document_service

    # ----- listing -----------------------------------------------------------

    def list_default_skills(self) -> list[Skill]:
        return [s for s in self._skills.list_skills() if s.owner_id == DEFAULT_OWNER_ID]

    def list_default_agents(self) -> list[tuple[Agent, list[Skill]]]:
        return [
            (a, skills)
            for a, skills in self._agents.list_agents_with_skills()
            if a.owner_id == DEFAULT_OWNER_ID
        ]

    def list_default_teams(self) -> list[Team]:
        return [t for t in self._teams.list_teams() if t.owner_id == DEFAULT_OWNER_ID]

    def list_default_tasks(self) -> list[Task]:
        return [t for t in self._tasks.list_tasks() if t.owner_id == DEFAULT_OWNER_ID]

    def list_default_documents(self) -> list[LibraryDocument]:
        return [
            d
            for d in self._documents.list_documents()
            if d.owner_id == DEFAULT_OWNER_ID and d.workspace_id == CATALOG_WORKSPACE_ID
        ]

    # ----- copying -----------------------------------------------------------

    def copy(
        self,
        kind: str,
        item_id: str,
        owner_id: str,
        *,
        workspace_id: str | None = None,
    ) -> dict:
        """Deep-copy a default item into ``owner_id``'s scope.

        Returns a small summary ``{"type", "id"}`` of the created root entity.
        Documents are office-bound, so copying one requires the target
        ``workspace_id`` (the company the user is recruiting into).
        """
        if kind == "skill":
            return {"type": kind, "id": self._copy_skill(item_id, owner_id).id}
        if kind == "agent":
            return {"type": kind, "id": self._copy_agent(item_id, owner_id).id}
        if kind == "team":
            return {"type": kind, "id": self._copy_team(item_id, owner_id).id}
        if kind == "task":
            return {"type": kind, "id": self._copy_task(item_id, owner_id).id}
        if kind == "document":
            if not workspace_id:
                raise ValidationError("Copying a document requires a target workspace_id")
            return {"type": kind, "id": self._copy_document(item_id, owner_id, workspace_id).id}
        raise NotFoundError(f"Unknown marketplace kind '{kind}'")

    def _skills_by_id(self) -> dict[str, Skill]:
        return {s.id: s for s in self._skills.list_skills()}

    def _require_default_skill(self, skill_id: str, lookup: dict[str, Skill]) -> Skill:
        skill = lookup.get(skill_id)
        if skill is None or skill.owner_id != DEFAULT_OWNER_ID:
            raise NotFoundError(f"Marketplace skill '{skill_id}' not found")
        return skill

    def _clone_skill(self, src: Skill, owner_id: str) -> Skill:
        clone = replace(
            src,
            id=f"skill_{uuid4().hex}",
            config=dict(src.config or {}),
            owner_id=owner_id,
        )
        return self._skills.upsert_skill(clone)

    def _clone_agent(self, src: Agent, owner_id: str, skill_lookup: dict[str, Skill]) -> Agent:
        new_skill_ids: list[str] = []
        for sid in src.skill_ids:
            skill = skill_lookup.get(sid)
            if skill is None:
                continue  # tolerate dangling references
            new_skill_ids.append(self._clone_skill(skill, owner_id).id)
        clone = replace(
            src,
            id=f"agent_{uuid4().hex}",
            skill_ids=new_skill_ids,
            status=AgentStatus.idle,
            owner_id=owner_id,
        )
        return self._agents.upsert_agent(clone)

    def _clone_team(self, src: Team, owner_id: str, skill_lookup: dict[str, Skill]) -> Team:
        new_agent_ids: list[str] = []
        for aid in src.agents:
            agent = self._agents._repo.get(aid)
            if agent is None:
                continue
            new_agent_ids.append(self._clone_agent(agent, owner_id, skill_lookup).id)
        clone = replace(
            src,
            id=f"team_{uuid4().hex}",
            agents=new_agent_ids,
            active_tasks=0,
            owner_id=owner_id,
        )
        return self._teams.upsert_team(clone)

    def _copy_skill(self, skill_id: str, owner_id: str) -> Skill:
        src = self._require_default_skill(skill_id, self._skills_by_id())
        return self._clone_skill(src, owner_id)

    def _copy_agent(self, agent_id: str, owner_id: str) -> Agent:
        src = self._agents._repo.get(agent_id)
        if src is None or src.owner_id != DEFAULT_OWNER_ID:
            raise NotFoundError(f"Marketplace agent '{agent_id}' not found")
        return self._clone_agent(src, owner_id, self._skills_by_id())

    def _copy_team(self, team_id: str, owner_id: str) -> Team:
        src = self._teams._repo.get(team_id)
        if src is None or src.owner_id != DEFAULT_OWNER_ID:
            raise NotFoundError(f"Marketplace team '{team_id}' not found")
        return self._clone_team(src, owner_id, self._skills_by_id())

    def _copy_task(self, task_id: str, owner_id: str) -> Task:
        src = self._tasks._repo.get(task_id)
        if src is None or src.owner_id != DEFAULT_OWNER_ID:
            raise NotFoundError(f"Marketplace task '{task_id}' not found")

        skill_lookup = self._skills_by_id()
        # Deep-copy the backing team (and its agents/skills) so the task is runnable.
        new_team_id = ""
        agent_id_map: dict[str, str] = {}
        src_team = self._teams._repo.get(src.team_id) if src.team_id else None
        if src_team is not None and src_team.owner_id == DEFAULT_OWNER_ID:
            new_agent_ids: list[str] = []
            for aid in src_team.agents:
                agent = self._agents._repo.get(aid)
                if agent is None:
                    continue
                cloned = self._clone_agent(agent, owner_id, skill_lookup)
                agent_id_map[aid] = cloned.id
                new_agent_ids.append(cloned.id)
            cloned_team = replace(
                src_team,
                id=f"team_{uuid4().hex}",
                agents=new_agent_ids,
                active_tasks=0,
                owner_id=owner_id,
            )
            new_team_id = self._teams.upsert_team(cloned_team).id

        clone = replace(
            src,
            id=f"task_{uuid4().hex}",
            team_id=new_team_id or src.team_id,
            assigned_agents=[agent_id_map.get(a, a) for a in src.assigned_agents],
            status=TaskStatus.pending,
            progress=0,
            start_time=None,
            end_time=None,
            owner_id=owner_id,
        )
        return self._tasks.upsert_task(clone)

    def _copy_document(
        self, doc_id: str, owner_id: str, target_workspace_id: str
    ) -> LibraryDocument:
        src = self._documents.get_document(doc_id)
        if src.owner_id != DEFAULT_OWNER_ID or src.workspace_id != CATALOG_WORKSPACE_ID:
            raise NotFoundError(f"Marketplace document '{doc_id}' not found")
        data = self._documents.read_bytes(src)
        if data is None:
            raise NotFoundError(f"Document bytes for {doc_id!r} not found")
        return self._documents.create_document(
            workspace_id=target_workspace_id,
            filename=src.name,
            content_type=src.content_type,
            data=data,
            owner_id=owner_id,
            uploaded_by=owner_id,
            description=src.description,
            source=src.source,
            source_url=src.source_url,
            tags=list(src.tags or []),
        )
