from __future__ import annotations

from server.app.ports.repositories import StaffRepository, SkillRepository
from server.app.ports.staff_graph import GraphStaffDefinition
from server.domain.service.skill_tool_service import SkillToolManager
from server.domain.errors import NotFoundError
from server.domain.models import Staff, Skill
from server.domain.tools.base import BaseToolkit
from server.share.log import get_logger

logger = get_logger(__name__)


class StaffService:
    def __init__(self, repo: StaffRepository, skill_repo: SkillRepository | None = None):
        self._repo = repo
        self._skill_repo = skill_repo
        self._tool_manager = SkillToolManager()

    def list_staff(self) -> list[Staff]:
        return self._repo.list()

    def list_staff_with_skills(self) -> list[tuple[Staff, list[Skill]]]:
        """Return every staff paired with its resolved skills.

        Loads all skills once and maps in memory, avoiding the N+1 pattern of
        calling get_staff_skills() (which re-fetches the staff and hits the
        skill repo per skill) inside a loop.
        """
        staff = self._repo.list()
        if not self._skill_repo:
            return [(staff, []) for staff in staff]
        skills_by_id = {s.id: s for s in self._skill_repo.list()}
        return [
            (staff, [skills_by_id[sid] for sid in staff.skill_ids if sid in skills_by_id])
            for staff in staff
        ]

    def try_get_staff(self, staff_id: str) -> Staff | None:
        return self._repo.get(staff_id)

    def get_staff(self, staff_id: str) -> Staff:
        staff = self.try_get_staff(staff_id)
        if not staff:
            raise NotFoundError(f"Staff '{staff_id}' not found")
        return staff

    def get_staff_skills(self, staff_id: str) -> list[Skill]:
        """Resolve staff's skill_ids to full Skill objects"""
        if not self._skill_repo:
            return []
        staff = self.get_staff(staff_id)
        skills = []
        for skill_id in staff.skill_ids:
            skill = self._skill_repo.get(skill_id)
            if skill:
                skills.append(skill)
        return skills

    def get_staff_tools(self, staff_id: str) -> dict[str, BaseToolkit]:
        """Get bound tools for all of staff's skills.

        Returns:
            Dict mapping skill_id to tool instance
        """
        skills = self.get_staff_skills(staff_id)
        tools = {}
        for skill in skills:
            tool = self._tool_manager.get_tool_for_skill(skill)
            if tool:
                tools[skill.id] = tool
        return tools

    def prepare_graph_definitions(
        self, staff_ids: list[str], tool_manager: SkillToolManager | None = None
    ) -> tuple[list[GraphStaffDefinition], dict[str, str]]:
        """Resolve staff ids to GraphStaffDefinitions with bound tools.

        Returns definitions in staff_ids order plus a staff_id -> name map for
        translating staff-id-based custom graph edges to name-based ones.
        Raises NotFoundError if a staff id doesn't exist; wraps a tool-binding
        failure in RuntimeError naming the offending staff id, so a caller can
        tell "staff missing" (404) apart from "staff exists but tool binding
        failed" (e.g. sandbox/provisioner unreachable).
        """
        manager = tool_manager or self._tool_manager
        definitions: list[GraphStaffDefinition] = []
        staff_id_to_name: dict[str, str] = {}
        for staff_id in staff_ids:
            staff = self.get_staff(staff_id)
            try:
                staff_tools = {}
                for skill in self.get_staff_skills(staff_id):
                    tool = manager.get_tool_for_skill(skill)
                    if tool:
                        staff_tools[skill.id] = tool
                        logger.info(
                            "Bound tool '%s' for skill '%s' (staff: %s)",
                            skill.tool_name, skill.id, staff.name,
                        )
                    else:
                        logger.debug("No tool available for skill '%s' (staff: %s)", skill.id, staff.name)
            except Exception as e:
                logger.exception("Failed to prepare staff '%s' for run", staff_id)
                raise RuntimeError(f"Failed to prepare staff '{staff_id}': {e}") from e
            definitions.append(
                GraphStaffDefinition(
                    name=staff.name,
                    role=staff.role,
                    system_prompt=staff.system_prompt,
                    description=staff.description,
                    skill_ids=list(staff.skill_ids),
                    tools=staff_tools or None,
                    subagent_enabled=bool(getattr(staff, "subagent_enabled", False)),
                )
            )
            staff_id_to_name[staff_id] = staff.name
        return definitions, staff_id_to_name

    def upsert_staff(self, staff: Staff) -> Staff:
        return self._repo.upsert(staff)

    def delete_staff(self, staff_id: str) -> None:
        if not self.try_get_staff(staff_id):
            raise NotFoundError(f"Staff '{staff_id}' not found")
        self._repo.delete(staff_id)
