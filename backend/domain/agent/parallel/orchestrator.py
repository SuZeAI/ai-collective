"""ParallelAgentOrchestrator — replaces SupervisorParallelOrchestrator.

Key difference from the old StateGraph approach:
  OLD: build StateGraph (supervisor node → parallel_workers node → synthesizer node)
       → ainvoke — sequential node execution even with asyncio.gather inside.

  NEW: supervisor = create_agent(model, tools=[task_tool])
       → supervisor LLM calls task(worker_A) + task(worker_B) in ONE AI message
       → LangGraph ToolNode executes both concurrently (asyncio.gather)
       → true parallel subagent execution, no StateGraph needed.
"""
from __future__ import annotations

import os
from typing import Any
from uuid import uuid4

from langchain.agents import create_agent
from langchain_core.messages import AIMessage, HumanMessage

from backend.application.ports.agent_graph import (
    AgentGraphOrchestrator,
    GraphAgentDefinition,
    GraphContextProvider,
    GraphRunResult,
    GraphTurn,
)
from backend.application.ports.llm import LLMProvider
from backend.domain.agent.parallel.task_tool import make_task_tool
from backend.domain.agent.token_budget import apply_context_token_budget
from backend.domain.memory.knowledge_graph import GraphContextConfig

MAX_CONTEXT_TOKENS = max(1024, int(os.getenv("AGENT_CONTEXT_TOKEN_LIMIT", "12000")))
RESERVED_OUTPUT_TOKENS = max(256, int(os.getenv("AGENT_OUTPUT_TOKEN_RESERVE", "2000")))
MAX_PARALLEL_WORKERS = max(1, int(os.getenv("MAX_PARALLEL_WORKERS", "5")))

_SUPERVISOR_TOOL_GUIDE = """
## PARALLEL TASK ORCHESTRATION

You have a `task` tool to delegate subtasks to specialized worker agents.

**To run workers in PARALLEL: call `task` multiple times in ONE response.**
All workers you dispatch in a single turn start simultaneously.
Total time = slowest worker (not sum of all workers).

### Available workers:
{agent_list}

### Rules:
- Each task must include ALL context the worker needs (workers share no memory).
- Agent names must match EXACTLY (case-sensitive).
- Max {max_parallel} parallel `task` calls per turn.
- For simple requests, answer directly without using the tool.
- After collecting worker results, synthesize into one final coherent answer.
"""


class ParallelAgentOrchestrator:
    """Supervisor-parallel orchestrator built on create_agent + task tool.

    The supervisor is a full ReAct agent that uses the `task` tool to dispatch
    workers.  Calling the tool N times in one AI message triggers N concurrent
    worker executions via LangGraph's ToolNode (asyncio.gather).
    """

    # ------------------------------------------------------------------
    # Public API (implements AgentGraphOrchestrator protocol)
    # ------------------------------------------------------------------

    async def run(
        self,
        *,
        user_input: str,
        agents: list[GraphAgentDefinition],
        llm: LLMProvider,
        max_rounds: int,
        conversation_id: str | None = None,
        graph_context_provider: GraphContextProvider | None = None,
        graph_config: GraphContextConfig | None = None,
    ) -> GraphRunResult:
        if not agents:
            raise ValueError("At least one agent definition is required")

        if len(agents) == 1:
            return await self._run_single(
                user_input=user_input,
                agent=agents[0],
                llm=llm,
                conversation_id=conversation_id,
                graph_context_provider=graph_context_provider,
                graph_config=graph_config,
            )

        _ingest(graph_context_provider, conversation_id, graph_config, "user", f"user-{uuid4().hex}", user_input)

        supervisor_agent, supervisor_def = self._build_supervisor(agents, llm)
        user_message = _build_user_message(
            user_input, llm, supervisor_def,
            conversation_id, graph_context_provider, graph_config,
        )

        final_state = await supervisor_agent.ainvoke(
            {"messages": [HumanMessage(content=user_message)]},
            config={"recursion_limit": max_rounds},
        )

        turns, final_response = _extract_turns(final_state, supervisor_def)
        _ingest(graph_context_provider, conversation_id, graph_config,
                supervisor_def.name, f"agent-{supervisor_def.name}-{uuid4().hex}", final_response)

        return GraphRunResult(
            turns=turns,
            final_response=final_response,
            final_agent=turns[-1].agent_name if turns else None,
            rounds=len(turns),
        )

    async def run_stream(
        self,
        *,
        user_input: str,
        agents: list[GraphAgentDefinition],
        llm: LLMProvider,
        max_rounds: int,
        conversation_id: str | None = None,
        graph_context_provider: GraphContextProvider | None = None,
        graph_config: GraphContextConfig | None = None,
    ):
        if not agents:
            raise ValueError("At least one agent definition is required")

        if len(agents) == 1:
            result = await self._run_single(
                user_input=user_input, agent=agents[0], llm=llm,
                conversation_id=conversation_id,
                graph_context_provider=graph_context_provider,
                graph_config=graph_config,
            )
            if result.turns:
                yield result.turns[-1]
            return

        _ingest(graph_context_provider, conversation_id, graph_config,
                "user", f"user-{uuid4().hex}", user_input)

        supervisor_agent, supervisor_def = self._build_supervisor(agents, llm)
        user_message = _build_user_message(
            user_input, llm, supervisor_def,
            conversation_id, graph_context_provider, graph_config,
        )

        # stream_mode="custom" captures get_stream_writer() calls from task_tool
        async for event in supervisor_agent.astream(
            {"messages": [HumanMessage(content=user_message)]},
            config={"recursion_limit": max_rounds},
            stream_mode="custom",
        ):
            if isinstance(event, dict):
                yield event

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _build_supervisor(
        self,
        agents: list[GraphAgentDefinition],
        llm: LLMProvider,
    ) -> tuple[Any, GraphAgentDefinition]:  # (CompiledStateGraph, supervisor_def)
        supervisor_def = agents[0]
        workers = {a.name: a for a in agents[1:]}

        task = make_task_tool(agents_by_name=workers, llm=llm)

        agent_list_text = "\n".join(
            f"- {a.name} ({a.role}): {a.description}" for a in agents[1:]
        ) or "- (none)"

        system_prompt = (
            supervisor_def.system_prompt
            + "\n\n"
            + _SUPERVISOR_TOOL_GUIDE.format(
                agent_list=agent_list_text,
                max_parallel=MAX_PARALLEL_WORKERS,
            )
        )

        supervisor_agent = create_agent(
            model=llm.get_chat_model(),
            tools=[task],
            system_prompt=system_prompt,
            name=supervisor_def.name,
        )
        return supervisor_agent, supervisor_def

    async def _run_single(
        self,
        *,
        user_input: str,
        agent: GraphAgentDefinition,
        llm: LLMProvider,
        conversation_id: str | None,
        graph_context_provider: Any | None,
        graph_config: Any | None,
    ) -> GraphRunResult:
        _ingest(graph_context_provider, conversation_id, graph_config,
                "user", f"user-{uuid4().hex}", user_input)

        graph_context_text = _fetch_context(graph_context_provider, conversation_id, graph_config, user_input)

        raw = "\n".join(filter(None, [
            f"Context:\n{graph_context_text}" if graph_context_text else "",
            user_input,
        ]))
        budget = apply_context_token_budget(
            llm=llm,
            system_prompt=agent.system_prompt,
            user_input=raw,
            max_context_tokens=MAX_CONTEXT_TOKENS,
            reserved_output_tokens=RESERVED_OUTPUT_TOKENS,
        )
        response = await llm.chat(system=agent.system_prompt, user=budget.text)
        _ingest(graph_context_provider, conversation_id, graph_config,
                agent.name, f"agent-{agent.name}-{uuid4().hex}", response)

        turn = GraphTurn(turn=1, agent_name=agent.name, agent_role=agent.role, content=response)
        return GraphRunResult(turns=[turn], final_response=response, final_agent=agent.name, rounds=1)


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------

def _build_user_message(
    user_input: str,
    llm: LLMProvider,
    supervisor_def: GraphAgentDefinition,
    conversation_id: str | None,
    graph_context_provider: Any | None,
    graph_config: Any | None,
) -> str:
    graph_context_text = _fetch_context(
        graph_context_provider, conversation_id, graph_config, user_input
    )
    raw = "\n".join(filter(None, [
        f"Context:\n{graph_context_text}" if graph_context_text else "",
        user_input,
    ]))
    budget = apply_context_token_budget(
        llm=llm,
        system_prompt=supervisor_def.system_prompt,
        user_input=raw,
        max_context_tokens=MAX_CONTEXT_TOKENS,
        reserved_output_tokens=RESERVED_OUTPUT_TOKENS,
    )
    return budget.text


def _fetch_context(
    provider: Any | None,
    conversation_id: str | None,
    config: Any | None,
    query: str,
) -> str:
    if not provider or not conversation_id:
        return ""
    try:
        pack = provider.build_graph_context(
            conversation_id=conversation_id, query=query, config=config,
        )
        return pack.text
    except Exception:
        return ""


def _ingest(
    provider: Any | None,
    conversation_id: str | None,
    config: Any | None,
    speaker: str,
    message_id: str,
    content: str,
) -> None:
    if provider and conversation_id and content:
        try:
            provider.ingest_message(
                conversation_id=conversation_id,
                message_id=message_id,
                speaker=speaker,
                content=content,
                config=config,
            )
        except Exception:
            pass


def _extract_turns(
    final_state: dict,
    supervisor_def: GraphAgentDefinition,
) -> tuple[list[GraphTurn], str]:
    """Extract GraphTurn list and final response text from agent final state."""
    messages = final_state.get("messages", [])
    turns: list[GraphTurn] = []
    final_response = ""
    turn_num = 1

    for msg in messages:
        if not isinstance(msg, AIMessage):
            continue
        content = msg.content
        if isinstance(content, list):
            parts = [
                b["text"] if isinstance(b, dict) and isinstance(b.get("text"), str) else ""
                for b in content
            ]
            text = "\n".join(p for p in parts if p)
        else:
            text = str(content) if content else ""

        if not text.strip():
            continue

        turns.append(GraphTurn(
            turn=turn_num,
            agent_name=supervisor_def.name,
            agent_role=supervisor_def.role,
            content=text,
        ))
        final_response = text
        turn_num += 1

    return turns, final_response
