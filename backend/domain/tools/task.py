"""Task tool — delegate work to a specialized subagent.

A subagent runs as a bounded, recursive ``LLMProvider.chat`` call with a
dedicated system prompt and a filtered tool set. The ``task`` tool itself is
always excluded from the subagent's tools to prevent infinite recursion.

When the parent LLM emits multiple ``task`` calls in a single turn, the
provider's parallel tool-execution path runs them concurrently — mirroring the
deerflow "task tool" parallelism.
"""

from __future__ import annotations

from typing import Any, List

from langchain.tools import tool

from backend.application.ports.llm import LLMProvider
from backend.domain.agent.subagents import (
    filter_tools,
    get_available_subagent_names,
    get_subagent_config,
)
from backend.domain.tools.base import BaseToolkit, Tool
from backend.log import get_logger


class TaskToolkit(BaseToolkit):
    """Toolkit exposing a single ``task`` tool for subagent delegation."""

    name: str = "task"

    def __init__(self, llm: LLMProvider, subagent_tools: List[Tool], **kwargs: Any):
        super().__init__(**kwargs)
        # Stored as extra attributes (model_config allows extra fields).
        self._llm = llm
        # Snapshot the parent agent's tools to hand to subagents.
        self._subagent_tools = list(subagent_tools)

    @tool(parse_docstring=True)
    async def task(self, description: str, prompt: str, subagent_type: str) -> Any:
        """Delegate a task to a specialized subagent that runs in its own context.

        Use this to preserve context, handle complex multi-step work, or run
        independent research/exploration in parallel (emit multiple task calls
        in one turn to run them concurrently).

        Available subagent_type values:
        - general-purpose: Complex, multi-step tasks needing exploration and
          action. Inherits all of this agent's tools.
        - research: Search and synthesize information from search/browse tools.
        - coding: Run bash commands and edit files inside the sandbox.

        Args:
            description: A short (3-5 word) description of the task for display.
            prompt: The full, specific task instructions for the subagent.
            subagent_type: One of general-purpose, research, coding.
        """
        config = get_subagent_config(subagent_type)
        if config is None:
            available = ", ".join(get_available_subagent_names())
            return (
                f"Error: Unknown subagent type '{subagent_type}'. "
                f"Available: {available}"
            )

        filtered = filter_tools(
            self._subagent_tools,
            config.tools,
            config.disallowed_tools,
        )

        get_logger().info(
            "Spawning subagent '%s' (%s) with %d tools",
            subagent_type,
            description,
            len(filtered),
        )

        result = await self._llm.chat(
            system=config.system_prompt,
            user=prompt,
            tools=filtered or None,
        )
        return f"Subagent '{subagent_type}' result:\n{result}"
