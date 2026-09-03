from __future__ import annotations

from typing import Any

from server.app.ports.repositories import SkillRepository
from server.domain.models import Skill
from server.domain.tools.default_config import build_tool_presets
from server.domain.tools.tool_registry import ToolRegistry


class SkillService:
    def __init__(self, repo: SkillRepository):
        self._repo = repo

    def list_skills(self) -> list[Skill]:
        return self._repo.list()

    def try_get_skill(self, skill_id: str) -> Skill | None:
        return self._repo.get(skill_id)

    def upsert_skill(self, skill: Skill) -> Skill:
        return self._repo.upsert(skill)

    def delete_skill(self, skill_id: str) -> None:
        self._repo.delete(skill_id)

    def list_available_tool_names(self) -> list[str]:
        return ToolRegistry.get_available_tools()

    def list_tool_presets(self) -> list[dict[str, Any]]:
        tool_names = self.list_available_tool_names()
        return build_tool_presets(tool_names)
