"""Subagent executor — creates and runs a full create_agent ReAct worker.

Adapted from context/deerflow/subagents/executor.py.
Each worker is a proper CompiledStateGraph (multi-turn, tool-capable),
not a bare llm.chat() call.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from langchain.agents import create_agent
from langchain_core.messages import AIMessage, HumanMessage

from backend.application.ports.agent_graph import GraphAgentDefinition
from backend.application.ports.llm import LLMProvider

logger = logging.getLogger(__name__)


class SubagentStatus(Enum):
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class SubagentResult:
    status: SubagentStatus
    result: str = ""
    error: str | None = None
    # AIMessage dicts captured during streaming, for debugging / tracing
    ai_messages: list[dict[str, Any]] = field(default_factory=list)


class SubagentExecutor:
    """Creates and runs a create_agent-based worker for one delegated task.

    Calling run() creates a fresh CompiledStateGraph, streams it to completion,
    and returns the final answer — same pattern as deerflow SubagentExecutor._aexecute.
    """

    def __init__(
        self,
        agent_def: GraphAgentDefinition,
        llm: LLMProvider,
        *,
        max_turns: int = 50,
    ) -> None:
        self._agent_def = agent_def
        self._llm = llm
        self._max_turns = max_turns

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def run(self, task: str) -> SubagentResult:
        """Stream the agent to completion and return its final text."""
        agent = self._build_agent()
        state = {"messages": [HumanMessage(content=task)]}
        config = {"recursion_limit": self._max_turns}

        final_state: dict | None = None
        ai_messages: list[dict] = []

        try:
            async for chunk in agent.astream(state, config=config, stream_mode="values"):
                final_state = chunk
                messages = chunk.get("messages", [])
                if not messages:
                    continue
                last = messages[-1]
                if not isinstance(last, AIMessage):
                    continue
                # Deduplicate by message id (same pattern as deerflow)
                msg_dict = last.model_dump()
                msg_id = msg_dict.get("id")
                duplicate = (
                    any(m.get("id") == msg_id for m in ai_messages)
                    if msg_id
                    else msg_dict in ai_messages
                )
                if not duplicate:
                    ai_messages.append(msg_dict)
                    logger.debug(
                        "[%s] captured AI message #%d",
                        self._agent_def.name,
                        len(ai_messages),
                    )
        except Exception as exc:
            logger.exception("[%s] subagent execution failed", self._agent_def.name)
            return SubagentResult(
                status=SubagentStatus.FAILED,
                error=str(exc),
                ai_messages=ai_messages,
            )

        return SubagentResult(
            status=SubagentStatus.COMPLETED,
            result=_extract_result(final_state),
            ai_messages=ai_messages,
        )

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _build_agent(self) -> Any:  # CompiledStateGraph
        """Build a fresh create_agent ReAct agent with the worker's tools."""
        model = self._llm.get_chat_model()

        tools: list = []
        if self._agent_def.tools:
            for toolkit in self._agent_def.tools.values():
                tools.extend(toolkit.get_tools())

        return create_agent(
            model=model,
            tools=tools or None,
            system_prompt=self._agent_def.system_prompt,
            name=self._agent_def.name,
        )


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _extract_result(state: dict | None) -> str:
    """Pull the last AIMessage text from a final agent state dict."""
    if not state:
        return "No response generated"

    for msg in reversed(state.get("messages", [])):
        if isinstance(msg, AIMessage):
            content = msg.content
            if isinstance(content, str):
                return content
            if isinstance(content, list):
                parts: list[str] = []
                for block in content:
                    if isinstance(block, str):
                        parts.append(block)
                    elif isinstance(block, dict) and isinstance(block.get("text"), str):
                        parts.append(block["text"])
                if parts:
                    return "\n".join(parts)

    return "No response generated"
