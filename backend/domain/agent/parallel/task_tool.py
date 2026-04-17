"""task tool — gives the supervisor the ability to delegate to worker agents.

Adapted from context/parallel/tools/builtins/task_tool.py and
context/deerflow/tools/builtins/task_tool.py.

When the supervisor calls this tool multiple times in ONE AI message,
LangGraph's ToolNode executes all calls concurrently via asyncio.gather,
giving true I/O-parallel execution across workers.
"""
from __future__ import annotations

from typing import Any

from langchain_core.tools import BaseTool
from langchain_core.tools import tool as lc_tool
from langgraph.config import get_stream_writer

from backend.application.ports.agent_graph import GraphAgentDefinition
from backend.application.ports.llm import LLMProvider
from backend.domain.agent.parallel.subagent_executor import SubagentExecutor, SubagentStatus
from backend.domain.event.schema import EventType


def make_task_tool(
    agents_by_name: dict[str, GraphAgentDefinition],
    llm: LLMProvider,
) -> BaseTool:
    """Factory: build a 'task' tool with the available workers baked in.

    Returns a LangChain tool the supervisor can call to spawn workers.
    Calling it N times in one AI turn triggers N concurrent executions.

    Args:
        agents_by_name: Worker agents keyed by their exact name.
        llm: LLM provider — shared with workers (async-safe in one event loop).
    """
    agent_descriptions = "\n".join(
        f"- {name} ({defn.role}): {defn.description or defn.role}"
        for name, defn in agents_by_name.items()
    ) or "- (none configured)"

    @lc_tool("task", parse_docstring=True)
    async def task_tool(description: str, agent_name: str, task: str) -> str:
        """Delegate a task to a worker agent. Call multiple times per turn for parallel execution.

        Each call runs a full create_agent ReAct worker that can use tools and
        reason over multiple turns.  Calling this tool N times in ONE response
        starts all N workers simultaneously.

        Args:
            description: Short (3-5 word) label for logging/display. ALWAYS PROVIDE FIRST.
            agent_name: Exact worker agent name (case-sensitive). ALWAYS PROVIDE SECOND.
            task: Fully self-contained task — include ALL context the worker needs. ALWAYS PROVIDE THIRD.
        """
        writer = get_stream_writer()

        agent_def = agents_by_name.get(agent_name)
        if agent_def is None:
            available = list(agents_by_name.keys())
            return (
                f"Error: agent '{agent_name}' not found. "
                f"Available agents: {available}"
            )

        writer({
            "type": EventType.WORKER_TASK_START.value,
            "agent_name": agent_name,
            "agent_role": agent_def.role,
            "task_preview": task[:120],
        })

        executor = SubagentExecutor(agent_def=agent_def, llm=llm)
        result = await executor.run(task)

        writer({
            "type": EventType.WORKER_TASK_COMPLETE.value,
            "agent_name": agent_name,
            "result_length": len(result.result),
            "turns_taken": len(result.ai_messages),
            "success": result.status == SubagentStatus.COMPLETED,
        })

        if result.status == SubagentStatus.FAILED:
            return f"Worker '{agent_name}' failed: {result.error}"

        return result.result

    # Append available agents to the docstring so the LLM knows its options
    task_tool.__doc__ = (
        (task_tool.__doc__ or "")
        + f"\n\nAvailable agents:\n{agent_descriptions}"
    )
    return task_tool
