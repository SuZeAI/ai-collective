"""Backward-compatible re-export.

SupervisorParallelOrchestrator has been replaced by ParallelAgentOrchestrator.
The old implementation used a LangGraph StateGraph with fixed supervisor →
parallel_workers → synthesizer nodes.

The new implementation uses create_agent + a 'task' tool so the supervisor
is a real ReAct agent that calls task() N times in ONE AI message, triggering
N concurrent worker executions via LangGraph's ToolNode (asyncio.gather).
"""
from backend.domain.agent.parallel.orchestrator import ParallelAgentOrchestrator as SupervisorParallelOrchestrator

__all__ = ["SupervisorParallelOrchestrator"]
