from __future__ import annotations

from langchain.tools import tool

from server.domain.tools.base import BaseToolkit


class PromtToolToolkit(BaseToolkit):
    """Tool that exposes the configured skill prompt to the model."""

    name: str = "promt_tool"

    def __init__(self, system_prompt: str, **kwargs):
        super().__init__(**kwargs)
        self.system_prompt = system_prompt

    @tool(parse_docstring=True)
    async def promt_tool_get_prompt(self) -> str:
        """Return the system prompt configured in this skill.

        Use this tool when you need the exact instructions saved in the skill.
        """
        return self.system_prompt