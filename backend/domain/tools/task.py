"""Task tool — delegate work to a specialized subagent.

A subagent runs as a bounded, recursive ``LLMProvider.chat`` call with a
dedicated system prompt and a filtered tool set. The ``task`` tool itself is
always excluded from the subagent's tools to prevent infinite recursion, and
``config.max_turns`` bounds the subagent's tool-calling loop.

When the parent LLM emits multiple ``task`` calls in a single turn, the
provider's parallel tool-execution path runs them concurrently — mirroring the
deerflow "task tool" parallelism. A semaphore caps how many subagents run at
once (``max_concurrent``).
"""

from __future__ import annotations

import asyncio
from typing import Any, List

from langchain.tools import tool

from backend.app.ports.llm import LLMProvider
from backend.domain.staff.subagents import (
    filter_tools,
    get_available_subagent_names,
    get_subagent_config,
)
from backend.domain.event.schema import EventType
from backend.domain.tools.base import BaseToolkit, Tool
from backend.log import get_logger

DEFAULT_MAX_CONCURRENT_SUBAGENTS = 3


def _emit_event(payload: dict) -> None:
    """Best-effort custom stream event.

    When running inside a LangGraph node the stream writer forwards this to the
    SSE stream; outside a graph (e.g. the ``/llm/chat`` test path) there is no
    writer, so this is a silent no-op.
    """
    try:
        from langgraph.config import get_stream_writer

        writer = get_stream_writer()
        if writer is not None:
            writer(payload)
    except Exception:
        pass


class TaskToolkit(BaseToolkit):
    """Toolkit exposing a single ``task`` tool for subagent delegation."""

    name: str = "task"

    def __init__(
        self,
        llm: LLMProvider,
        subagent_tools: List[Tool],
        max_concurrent: int = DEFAULT_MAX_CONCURRENT_SUBAGENTS,
        parent_staff_name: str | None = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        # Stored as extra attributes (model_config allows extra fields).
        self._llm = llm
        # Snapshot the parent staff's tools to hand to subagents.
        self._subagent_tools = list(subagent_tools)
        self._max_concurrent = max(1, int(max_concurrent))
        self._parent_staff_name = parent_staff_name
        # Lazily created so it binds to the active event loop.
        self._semaphore: asyncio.Semaphore | None = None

    def _get_semaphore(self) -> asyncio.Semaphore:
        if self._semaphore is None:
            self._semaphore = asyncio.Semaphore(self._max_concurrent)
        return self._semaphore

    @tool(parse_docstring=True)
    async def task(self, description: str, prompt: str, subagent_type: str) -> Any:
        """Delegate a task to a specialized subagent that runs in its own context.

        Use this to preserve context, handle complex multi-step work, or run
        independent research/exploration in parallel (emit multiple task calls
        in one turn to run them concurrently).

        Available subagent_type values:
        - general-purpose: Complex, multi-step tasks needing exploration and
          action. Inherits all of this staff's tools.
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
            "Spawning subagent '%s' (%s) with %d tools, max_turns=%d",
            subagent_type,
            description,
            len(filtered),
            config.max_turns,
        )
        _emit_event(
            {
                "type": EventType.SUBAGENT_START.value,
                "agent_name": self._parent_staff_name,
                "subagent_type": subagent_type,
                "description": description,
            }
        )

        async with self._get_semaphore():
            try:
                # safe_chat bounds the call with a timeout + retry, matching
                # every other LLM call in the graph — a bare llm.chat() here
                # could hang indefinitely and hold this semaphore slot forever.
                from backend.domain.staff._graph_runtime import safe_chat

                result = await safe_chat(
                    self._llm,
                    staff_name=self._parent_staff_name or "",
                    system=config.system_prompt,
                    user=prompt,
                    tools=filtered or None,
                    max_tool_rounds=config.max_turns,
                )
            except Exception as exc:  # noqa: BLE001 - surface as tool output
                get_logger().exception("Subagent '%s' failed", subagent_type)
                _emit_event(
                    {
                        "type": EventType.SUBAGENT_COMPLETE.value,
                        "agent_name": self._parent_staff_name,
                        "subagent_type": subagent_type,
                        "description": description,
                        "error": str(exc),
                    }
                )
                return f"Subagent '{subagent_type}' failed: {exc}"

        _emit_event(
            {
                "type": EventType.SUBAGENT_COMPLETE.value,
                "agent_name": self._parent_staff_name,
                "subagent_type": subagent_type,
                "description": description,
            }
        )
        return f"Subagent '{subagent_type}' result:\n{result}"
