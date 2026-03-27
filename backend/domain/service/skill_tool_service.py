from typing import Optional, Dict, Any

from backend.domain.models import Skill
from backend.domain.tools.base import BaseToolkit
from backend.domain.tools.tool_registry import ToolRegistry


class SkillToolBinder:

    def __init__(self):
        self._bound_tools: Dict[str, BaseToolkit] = {}

    def get_tool_name(self, skill: Skill) -> Optional[str]:
        return skill.tool_name

    def get_tool_kwargs(
        self,
        skill: Skill,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        skill_config = dict(skill.config or {})
        if "tool_name_override" not in kwargs:
            kwargs = {**kwargs, "tool_name_override": skill.name}
        # Caller-provided kwargs should take precedence over persisted skill config.
        return {**skill_config, **kwargs}

    def bind_tool(
        self,
        skill: Skill,
        **kwargs: Any
    ) -> Optional[BaseToolkit]:
        if skill.id in self._bound_tools:
            return self._bound_tools[skill.id]

        tool_name = self.get_tool_name(skill)
        if tool_name is None:
            return None

        tool_kwargs = self.get_tool_kwargs(skill, **kwargs)
        tool = ToolRegistry.create_tool(tool_name, **tool_kwargs)
        if tool is not None:
            self._bound_tools[skill.id] = tool
            return tool

        return None

    def get_bound_tool(self, skill_id: str) -> Optional[BaseToolkit]:
        return self._bound_tools.get(skill_id)

    def unbind_tool(self, skill_id: str) -> bool:
        if skill_id in self._bound_tools:
            del self._bound_tools[skill_id]
            return True
        return False

    def get_all_bound_tools(self) -> Dict[str, BaseToolkit]:
        return dict(self._bound_tools)

    def clear_all_bindings(self) -> None:
        self._bound_tools.clear()


class SkillToolManager:

    def __init__(self, skill_tool_binder: Optional[SkillToolBinder] = None):
        self.binder = skill_tool_binder or SkillToolBinder()

    def validate_skill_has_tool(self, skill: Skill) -> tuple[bool, Optional[str]]:
        tool_name = self.binder.get_tool_name(skill)
        return (tool_name is not None, tool_name)

    def get_tool_for_skill(
        self,
        skill: Skill,
        **kwargs: Any
    ) -> Optional[BaseToolkit]:
        return self.binder.bind_tool(skill, **kwargs)

    def get_available_tools_for_skills(
        self,
        skills: list[Skill]
    ) -> Dict[str, tuple[Optional[str], bool]]:
        result = {}
        for skill in skills:
            has_tool, tool_name = self.validate_skill_has_tool(skill)
            result[skill.id] = (tool_name, has_tool)
        return result
