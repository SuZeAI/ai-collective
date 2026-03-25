from __future__ import annotations

import re

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit


class PromtToolToolkit(BaseToolkit):
    """Tool that exposes the configured skill prompt to the model."""

    name: str = "promt_tool"

    def __init__(self, system_prompt: str, tool_name_override: str | None = None):
        super().__init__()
        self.system_prompt = system_prompt
        if tool_name_override and self.tools:
            for tool in self.tools:
                tool.name = self._sanitize_tool_name(tool_name_override)

    @staticmethod
    def _sanitize_tool_name(raw_name: str) -> str:
        normalized = raw_name.strip().lower().replace(" ", "_")
        normalized = re.sub(r"[^a-z0-9_\-]", "_", normalized)
        normalized = re.sub(r"_+", "_", normalized).strip("_")
        return (normalized or "promt_tool")[0:64]

    @tool(parse_docstring=True)
    async def promt_tool_get_prompt(self) -> str:
        """Return the system prompt configured in this skill.

        Use this tool when you need the exact instructions saved in the skill.
        """
        return self.system_prompt