from __future__ import annotations

import os
from typing import TypedDict
from uuid import uuid4

from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from backend.application.ports.agent_graph import (
    AgentGraphOrchestrator,
    GraphAgentDefinition,
    GraphContextProvider,
    GraphRunResult,
    GraphTurn,
)
from backend.application.ports.llm import LLMProvider
from backend.domain.event.schema import EventType
from backend.domain.memory.knowledge_graph import GraphContextConfig
from backend.domain.agent.token_budget import apply_context_token_budget


MAX_CONTEXT_TOKENS = max(1024, int(os.getenv("AGENT_CONTEXT_TOKEN_LIMIT", "12000")))
RESERVED_OUTPUT_TOKENS = max(256, int(os.getenv("AGENT_OUTPUT_TOKEN_RESERVE", "2000")))


class MultiAgentState(TypedDict):
    input: str
    original_input: str
    turns: list[GraphTurn]
    final_response: str
    final_agent: str | None
    rounds: int


class LangGraphAgentOrchestrator(AgentGraphOrchestrator):
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

        selected_agents = agents[: max(1, max_rounds)]
        builder: StateGraph = StateGraph(MultiAgentState)
        for i, agent in enumerate(selected_agents):
            builder.add_node(
                agent.name,
                self._make_llm_node(
                    agent=agent,
                    llm=llm,
                    conversation_id=conversation_id,
                    graph_context_provider=graph_context_provider,
                    graph_config=graph_config,
                ),
            )
            if i < len(selected_agents) - 1:
                builder.add_edge(agent.name, selected_agents[i + 1].name)
            else:
                builder.add_edge(agent.name, END)

        builder.add_edge(START, selected_agents[0].name)
        graph = builder.compile()

        initial: MultiAgentState = {
            "input": user_input,
            "original_input": user_input,
            "turns": [],
            "final_response": "",
            "final_agent": None,
            "rounds": 0,
        }

        if graph_context_provider and conversation_id:
            graph_context_provider.ingest_message(
                conversation_id=conversation_id,
                message_id=f"user-{uuid4().hex}",
                speaker="user",
                content=user_input,
                config=graph_config,
            )

        final_state = await graph.ainvoke(initial)
        turns = list(final_state.get("turns", []))
        final_response = final_state.get("final_response") or (turns[-1].content if turns else "")
        final_agent = final_state.get("final_agent")
        rounds = int(final_state.get("rounds", len(turns)))
        return GraphRunResult(
            turns=turns,
            final_response=final_response,
            final_agent=final_agent,
            rounds=rounds,
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
        """Streaming version using get_stream_writer for real-time custom events"""
        if not agents:
            raise ValueError("At least one agent definition is required")

        selected_agents = agents[: max(1, max_rounds)]
        builder: StateGraph = StateGraph(MultiAgentState)
        for i, agent in enumerate(selected_agents):
            builder.add_node(
                agent.name,
                self._make_llm_node(
                    agent=agent,
                    llm=llm,
                    conversation_id=conversation_id,
                    graph_context_provider=graph_context_provider,
                    graph_config=graph_config,
                ),
            )
            if i < len(selected_agents) - 1:
                builder.add_edge(agent.name, selected_agents[i + 1].name)
            else:
                builder.add_edge(agent.name, END)

        builder.add_edge(START, selected_agents[0].name)
        graph = builder.compile()

        initial: MultiAgentState = {
            "input": user_input,
            "original_input": user_input,
            "turns": [],
            "final_response": "",
            "final_agent": None,
            "rounds": 0,
        }

        if graph_context_provider and conversation_id:
            graph_context_provider.ingest_message(
                conversation_id=conversation_id,
                message_id=f"user-{uuid4().hex}",
                speaker="user",
                content=user_input,
                config=graph_config,
            )

        # Stream custom events from nodes using stream_mode="custom"
        async for event in graph.astream(initial, stream_mode="custom"):
            # Custom events sent via get_stream_writer() from nodes
            if isinstance(event, dict):
                yield event

    def _make_llm_node(
        self,
        *,
        agent: GraphAgentDefinition,
        llm: LLMProvider,
        conversation_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
    ):
        async def node(state: MultiAgentState) -> MultiAgentState:
            stream_writer = get_stream_writer()

            # Generate a unique thread_id for this agent turn.
            # Also creates {SANDBOX_WORKSPACE}/{thread_id}/ immediately.
            from backend.infrastructure.sandbox.sandbox_session import (
                new_thread_id as _new_thread_id,
                get_thread_workspace as _get_thread_workspace,
            )
            from backend.api.settings import settings as _settings
            sandbox_thread_id = _new_thread_id(
                agent_name=agent.name,
                task_id=conversation_id,
            )
            sandbox_workspace = _get_thread_workspace(
                _settings.sandbox_workspace or "", sandbox_thread_id
            )

            # Stream: Agent starting
            stream_writer({
                "type": EventType.AGENT_START.value,
                "agent_name": agent.name,
                "agent_role": agent.role,
                "turn": state["rounds"] + 1,
                "sandbox_thread_id": sandbox_thread_id,
                "sandbox_workspace": sandbox_workspace,
            })

            bound_tools = []
            if agent.tools:
                for toolkit in agent.tools.values():
                    bound_tools.extend(toolkit.get_tools())

            # Agent Mode: expose the `task` tool so this agent can delegate to
            # subagents (which inherit these tools minus `task`).
            if agent.subagent_enabled:
                from backend.domain.tools.task import TaskToolkit

                task_toolkit = TaskToolkit(llm=llm, subagent_tools=list(bound_tools))
                bound_tools.extend(task_toolkit.get_tools())

            user_input = state["input"]
            
            # Stream: Building context
            stream_writer({
                "type": EventType.CONTEXT_BUILDING.value,
                "agent_name": agent.name,
            })
            
            if graph_context_provider and conversation_id:
                pack = graph_context_provider.build_graph_context(
                    conversation_id=conversation_id,
                    query=state["input"],
                    config=graph_config,
                )
                if pack.text:
                    user_input = f"{pack.text}\n\nIncoming request:\n{state['input']}"
                    # Stream: Context retrieved
                    stream_writer({
                        "type": EventType.CONTEXT_RETRIEVED.value,
                        "agent_name": agent.name,
                        "node_ids": pack.node_ids,
                        "edge_ids": pack.edge_ids,
                        "chunk_ids": pack.chunk_ids,
                    })

            budget_result = apply_context_token_budget(
                llm=llm,
                system_prompt=agent.system_prompt,
                user_input=user_input,
                max_context_tokens=MAX_CONTEXT_TOKENS,
                reserved_output_tokens=RESERVED_OUTPUT_TOKENS,
            )
            user_input = budget_result.text

            # Stream: LLM processing started
            stream_writer({
                "type": EventType.LLM_REQUEST_START.value,
                "agent_name": agent.name,
                "context_length": len(user_input),
                "context_tokens": budget_result.input_tokens,
                "context_token_limit": budget_result.max_input_tokens,
                "context_truncated": budget_result.truncated,
                "tokenizer_family": budget_result.tokenizer_family,
                "llm_provider": budget_result.provider,
                "llm_model": budget_result.model,
            })
            
            output = await llm.chat(
                system=agent.system_prompt,
                user=user_input,
                tools=bound_tools or None,
                parallel_tools=agent.subagent_enabled,
            )

            # Stream: LLM response received
            stream_writer({
                "type": EventType.LLM_RESPONSE_COMPLETE.value,
                "agent_name": agent.name,
                "response_length": len(output),
            })

            next_turn = GraphTurn(
                turn=state["rounds"] + 1,
                agent_name=agent.name,
                agent_role=agent.role,
                content=output,
            )

            if graph_context_provider and conversation_id:
                graph_context_provider.ingest_message(
                    conversation_id=conversation_id,
                    message_id=f"agent-{agent.name}-{uuid4().hex}",
                    speaker=agent.name,
                    content=output,
                    config=graph_config,
                )
                # Stream: Message ingested
                stream_writer({
                    "type": EventType.MESSAGE_INGESTED.value,
                    "agent_name": agent.name,
                })

            # Stream: Turn completed
            stream_writer({
                "type": EventType.TURN_COMPLETE.value,
                "turn": next_turn,
            })

            return {
                **state,
                "input": output,
                "turns": [*state["turns"], next_turn],
                "final_response": output,
                "final_agent": agent.name,
                "rounds": state["rounds"] + 1,
            }

        return node
