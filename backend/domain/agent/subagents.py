"""Subagent configurations and registry.

Ported and adapted from ``context/deerflow/subagents``. In this product an
agent is a bounded async tool-calling loop (``LLMProvider.chat``), so a
"subagent" is simply a recursive ``chat`` call with a dedicated system prompt
and a filtered tool set (the ``task`` tool itself is always removed to prevent
infinite recursion).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, List, Optional


@dataclass(frozen=True)
class SubagentConfig:
    """Configuration for a builtin subagent.

    Attributes:
        name: Unique identifier (used as ``subagent_type``).
        description: When the parent agent should delegate to this subagent.
        system_prompt: System prompt guiding the subagent.
        tools: Optional allowlist of tool names. ``None`` inherits all of the
            parent agent's tools.
        disallowed_tools: Tool names always removed (defaults to ``["task"]``
            to prevent recursive nesting).
        max_turns: Advisory tool-round budget for the subagent.
    """

    name: str
    description: str
    system_prompt: str
    tools: Optional[List[str]] = None
    disallowed_tools: List[str] = field(default_factory=lambda: ["task"])
    max_turns: int = 6


_GENERAL_PURPOSE = SubagentConfig(
    name="general-purpose",
    description=(
        "A capable agent for complex, multi-step tasks that require both "
        "exploration and action. Inherits all of the parent agent's tools."
    ),
    system_prompt=(
        "You are a general-purpose subagent working on a delegated task. "
        "Complete the task autonomously and return a clear, actionable result.\n\n"
        "Guidelines:\n"
        "- Focus on completing the delegated task efficiently.\n"
        "- Use available tools as needed to accomplish the goal.\n"
        "- Think step by step but act decisively.\n"
        "- Do NOT ask for clarification — work with the information provided.\n"
        "- Return a concise summary of what you accomplished, key findings, and "
        "any artifacts produced. Include issues encountered (if any)."
    ),
    tools=None,
)


_RESEARCH = SubagentConfig(
    name="research",
    description=(
        "A research specialist for gathering, searching and synthesizing "
        "information from the parent agent's search/browse tools."
    ),
    system_prompt=(
        "You are a research subagent. Your job is to investigate the delegated "
        "topic and return a well-organized synthesis.\n\n"
        "Guidelines:\n"
        "- Use the available search/browse tools to gather relevant information.\n"
        "- Cross-check important facts across more than one source when possible.\n"
        "- Do NOT ask for clarification — work with the information provided.\n"
        "- Return a concise synthesis: key findings, supporting evidence, and "
        "source references (URLs/titles) where applicable."
    ),
    tools=None,
)


_CODING = SubagentConfig(
    name="coding",
    description=(
        "A command-execution and file-editing specialist for running bash "
        "commands and modifying files inside the sandbox."
    ),
    system_prompt=(
        "You are a coding/command-execution subagent. Execute the requested "
        "work carefully inside the sandbox and report results clearly.\n\n"
        "Guidelines:\n"
        "- Run commands one at a time when they depend on each other.\n"
        "- Report both stdout and stderr when relevant.\n"
        "- Be cautious with destructive operations (rm, overwrite, etc.).\n"
        "- Do NOT ask for clarification — work with the information provided.\n"
        "- Return a concise summary of what was executed, the outcome "
        "(success/failure), relevant output, and any errors."
    ),
    # Allowlist of bash + sandbox tool names. Names not present on the parent
    # agent are simply skipped during filtering.
    tools=[
        "bash_exec",
        "bash_view",
        "bash_wait",
        "bash_write_to_process",
        "bash_kill_process",
        "sandbox_bash",
        "sandbox_ls",
        "sandbox_glob",
        "sandbox_grep",
        "sandbox_read_file",
        "sandbox_write_file",
        "sandbox_str_replace",
    ],
)


BUILTIN_SUBAGENTS: dict[str, SubagentConfig] = {
    _GENERAL_PURPOSE.name: _GENERAL_PURPOSE,
    _RESEARCH.name: _RESEARCH,
    _CODING.name: _CODING,
}


def get_subagent_config(name: str) -> Optional[SubagentConfig]:
    """Return the subagent config for ``name`` or ``None`` if unknown."""
    return BUILTIN_SUBAGENTS.get(name)


def get_available_subagent_names() -> list[str]:
    """Return the list of available subagent type names."""
    return list(BUILTIN_SUBAGENTS.keys())


def filter_tools(
    all_tools: list[Any],
    allowed: Optional[List[str]],
    disallowed: Optional[List[str]],
) -> list[Any]:
    """Filter tools by ``tool.name`` using an allowlist/denylist.

    Args:
        all_tools: Candidate tools (objects exposing a ``.name`` attribute).
        allowed: If provided, only tools whose name is in this set are kept.
        disallowed: Tools whose name is in this set are always removed.
    """
    filtered = list(all_tools)

    if allowed is not None:
        allowed_set = set(allowed)
        filtered = [t for t in filtered if getattr(t, "name", None) in allowed_set]

    if disallowed is not None:
        disallowed_set = set(disallowed)
        filtered = [t for t in filtered if getattr(t, "name", None) not in disallowed_set]

    return filtered
