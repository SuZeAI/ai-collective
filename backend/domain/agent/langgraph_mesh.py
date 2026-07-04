from __future__ import annotations

import asyncio
import re
from typing import TypedDict
from uuid import uuid4

from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from backend.domain.prompt.routing_prompt import get_routing_guidance
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
from backend.domain.agent._graph_runtime import (
    FANOUT_SYNTHESIS_GUIDANCE,
    MESH_FANOUT_MAX_CONCURRENT,
    attach_conversation_sandbox,
    drain_human_guidance,
    ensure_working_memory,
    memory_toolkit_tools,
    record_guidance_in_memory,
    record_turn_in_memory,
    recursion_config,
    run_fanout_wave,
    run_to_final_state,
    safe_chat,
    wait_while_paused,
    working_memory_block,
)
from backend.api.settings import settings
from backend.log import get_logger

logger = get_logger(__name__)

MAX_CONTEXT_TOKENS = max(1024, settings.agent.context_token_limit)
RESERVED_OUTPUT_TOKENS = max(256, settings.agent.output_token_reserve)
SUBAGENT_MAX_CONCURRENT = max(1, settings.agent.subagent_max_concurrent)


class MultiAgentMeshState(TypedDict):
    """State for multi-agent mesh topology with central hub"""
    input: str
    original_input: str
    turns: list[GraphTurn]
    conversation_history: dict[str, list[str]]
    current_agent: str
    hub_agent: str
    agent_names: list[str]
    discussion_ended: bool
    final_response: str
    last_action: str
    rounds: int


class MultiAgentMeshOrchestrator(AgentGraphOrchestrator):
    """
    Orchestrator for multi-agent mesh topology where one central agent
    connects bidirectionally to all other agents. The conditional function
    determines which agent speaks next based on conversation content.
    
    Topology: 1 hub agent ↔ N spoke agents
    Flow: Hub → Agent1 → Agent2 or Hub or END
    """

    _NEXT_AGENT_RE = re.compile(
        r"<\s*NEXT_AGENT\s*>(.*?)<\s*/\s*NEXT_AGENT\s*>",
        re.IGNORECASE | re.DOTALL,
    )
    _DISCUSSION_END_RE = re.compile(
        r"<\s*DISCUSSION_END\s*>(.*?)<\s*/\s*DISCUSSION_END\s*>",
        re.IGNORECASE | re.DOTALL,
    )
    _ASK_NEXT_AGENT_RE = re.compile(
        r"<\s*ASK_NEXT_AGENT\s*>(.*?)<\s*/\s*ASK_NEXT_AGENT\s*>",
        re.IGNORECASE | re.DOTALL,
    )
    _CONTROL_BLOCK_RE = re.compile(
        r"<\s*(ASK_NEXT_AGENT|NEXT_AGENT|DISCUSSION_END|FANOUT)\s*>.*?<\s*/\s*\1\s*>",
        re.IGNORECASE | re.DOTALL,
    )
    _FANOUT_RE = re.compile(
        r"<\s*FANOUT\s*>(.*?)<\s*/\s*FANOUT\s*>",
        re.IGNORECASE | re.DOTALL,
    )
    _FANOUT_PAIR_RE = re.compile(
        r"<\s*DELEGATE_TO\s*>(.*?)<\s*/\s*DELEGATE_TO\s*>\s*"
        r"<\s*TASK\s*>(.*?)<\s*/\s*TASK\s*>",
        re.IGNORECASE | re.DOTALL,
    )

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
        custom_graph=None,  # accepted for protocol parity; ignored by this mode
    ) -> GraphRunResult:
        """
        Execute multi-agent mesh graph where all agents can connect to each other.
        
        Args:
            user_input: Initial input to start the discussion
            agents: List of agents. First agent acts as hub/starter.
            llm: LLM provider for agent responses
            max_rounds: Maximum discussion rounds before forced stop
            
        Returns:
            GraphRunResult with conversation turns and final response
        """
        if not agents:
            raise ValueError("At least one agent definition is required")

        logger.debug(
            "MeshOrchestrator.run: agents=%s max_rounds=%d conversation_id=%s",
            [a.name for a in agents], max_rounds, conversation_id,
        )

        if len(agents) == 1:
            logger.debug("MeshOrchestrator.run: single-agent fallback -> %s", agents[0].name)
            return await self._run_single_agent(
                user_input=user_input,
                agent=agents[0],
                llm=llm,
                max_rounds=max_rounds,
                conversation_id=conversation_id,
                graph_context_provider=graph_context_provider,
                graph_config=graph_config,
            )

        if graph_context_provider and conversation_id:
            graph_context_provider.ingest_message(
                conversation_id=conversation_id,
                message_id=f"user-{uuid4().hex}",
                speaker="user",
                content=user_input,
                config=graph_config,
            )

        builder: StateGraph = StateGraph(MultiAgentMeshState)

        hub_agent = agents[0]
        all_agent_names = [a.name for a in agents]

        for agent in agents:
            builder.add_node(
                agent.name,
                self._make_mesh_llm_node(
                    agent=agent,
                    llm=llm,
                    max_rounds=max_rounds,
                    all_agents=agents,
                    hub_agent_name=hub_agent.name,
                    conversation_id=conversation_id,
                    graph_context_provider=graph_context_provider,
                    graph_config=graph_config,
                ),
            )

        for agent in agents:
            def should_route_to_next(state, current_agent_name=agent.name):
                return self._decide_next_agent(
                    state,
                    current_agent_name,
                    max_rounds,
                    all_agent_names,
                )

            routing_options = {name: name for name in all_agent_names if name != agent.name}
            routing_options["end"] = END

            builder.add_conditional_edges(
                agent.name,
                should_route_to_next,
                routing_options,
            )

        builder.add_edge(START, hub_agent.name)
        graph = builder.compile()
        logger.debug(
            "MeshOrchestrator.run: graph compiled — hub=%s agents=%s",
            hub_agent.name, all_agent_names,
        )

        initial: MultiAgentMeshState = {
            "input": user_input,
            "original_input": user_input,
            "turns": [],
            "conversation_history": {
                agent.name: [] for agent in agents
            },
            "current_agent": hub_agent.name,
            "hub_agent": hub_agent.name,
            "agent_names": all_agent_names,
            "discussion_ended": False,
            "final_response": "",
            "last_action": "",
            "rounds": 0,
        }

        final_state = await run_to_final_state(graph, initial, max_rounds)
        turns = list(final_state.get("turns", []))
        final_response = final_state.get("final_response") or (
            turns[-1].content if turns else ""
        )
        rounds = int(final_state.get("rounds", len(turns)))
        logger.debug(
            "MeshOrchestrator.run: complete — turns=%d rounds=%d final_agent=%s",
            len(turns), rounds, turns[-1].agent_name if turns else None,
        )
        return GraphRunResult(
            turns=turns,
            final_response=final_response,
            final_agent=turns[-1].agent_name if turns else None,
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
        custom_graph=None,  # accepted for protocol parity; ignored by this mode
    ):
        """Streaming version using get_stream_writer for real-time custom events"""
        if not agents:
            raise ValueError("At least one agent definition is required")

        logger.debug(
            "MeshOrchestrator.run_stream: agents=%s max_rounds=%d conversation_id=%s",
            [a.name for a in agents], max_rounds, conversation_id,
        )

        if len(agents) == 1:
            logger.debug("MeshOrchestrator.run_stream: single-agent fallback -> %s", agents[0].name)
            async for turn in self._run_single_agent_stream(
                user_input=user_input,
                agent=agents[0],
                llm=llm,
                max_rounds=max_rounds,
                conversation_id=conversation_id,
                graph_context_provider=graph_context_provider,
                graph_config=graph_config,
            ):
                yield turn
            return

        if graph_context_provider and conversation_id:
            graph_context_provider.ingest_message(
                conversation_id=conversation_id,
                message_id=f"user-{uuid4().hex}",
                speaker="user",
                content=user_input,
                config=graph_config,
            )

        builder: StateGraph = StateGraph(MultiAgentMeshState)

        hub_agent = agents[0]
        all_agent_names = [a.name for a in agents]

        for agent in agents:
            builder.add_node(
                agent.name,
                self._make_mesh_llm_node(
                    agent=agent,
                    llm=llm,
                    max_rounds=max_rounds,
                    all_agents=agents,
                    hub_agent_name=hub_agent.name,
                    conversation_id=conversation_id,
                    graph_context_provider=graph_context_provider,
                    graph_config=graph_config,
                ),
            )

        for agent in agents:
            def should_route_to_next(state, current_agent_name=agent.name):
                return self._decide_next_agent(
                    state,
                    current_agent_name,
                    max_rounds,
                    all_agent_names,
                )

            routing_options = {name: name for name in all_agent_names if name != agent.name}
            routing_options["end"] = END

            builder.add_conditional_edges(
                agent.name,
                should_route_to_next,
                routing_options,
            )

        builder.add_edge(START, hub_agent.name)
        graph = builder.compile()
        logger.debug(
            "MeshOrchestrator.run_stream: graph compiled — hub=%s agents=%s, streaming...",
            hub_agent.name, all_agent_names,
        )

        initial: MultiAgentMeshState = {
            "input": user_input,
            "original_input": user_input,
            "turns": [],
            "conversation_history": {
                agent.name: [] for agent in agents
            },
            "current_agent": hub_agent.name,
            "hub_agent": hub_agent.name,
            "agent_names": all_agent_names,
            "discussion_ended": False,
            "final_response": "",
            "last_action": "",
            "rounds": 0,
        }

        # Stream custom events using stream_mode="custom"
        async for event in graph.astream(
            initial, config=recursion_config(max_rounds), stream_mode="custom"
        ):
            if isinstance(event, dict):
                yield event

    async def _run_single_agent(
        self,
        *,
        user_input: str,
        agent: GraphAgentDefinition,
        llm: LLMProvider,
        max_rounds: int,
        conversation_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
    ) -> GraphRunResult:
        """Fallback execution path when only one agent is provided."""
        logger.debug("_run_single_agent: agent=%s max_rounds=%d", agent.name, max_rounds)
        if graph_context_provider and conversation_id:
            graph_context_provider.ingest_message(
                conversation_id=conversation_id,
                message_id=f"user-{uuid4().hex}",
                speaker="user",
                content=user_input,
                config=graph_config,
            )

        builder: StateGraph = StateGraph(MultiAgentMeshState)
        builder.add_node(
            agent.name,
            self._make_mesh_llm_node(
                agent=agent,
                llm=llm,
                max_rounds=max_rounds,
                all_agents=[agent],
                hub_agent_name=agent.name,
                conversation_id=conversation_id,
                graph_context_provider=graph_context_provider,
                graph_config=graph_config,
            ),
        )
        builder.add_edge(START, agent.name)
        builder.add_edge(agent.name, END)
        graph = builder.compile()

        initial: MultiAgentMeshState = {
            "input": user_input,
            "original_input": user_input,
            "turns": [],
            "conversation_history": {agent.name: []},
            "current_agent": agent.name,
            "hub_agent": agent.name,
            "agent_names": [agent.name],
            "discussion_ended": False,
            "final_response": "",
            "last_action": "",
            "rounds": 0,
        }
        final_state = await run_to_final_state(graph, initial, max_rounds)
        turns = list(final_state.get("turns", []))
        final_response = final_state.get("final_response") or (
            turns[-1].content if turns else ""
        )
        rounds = int(final_state.get("rounds", len(turns)))
        return GraphRunResult(
            turns=turns,
            final_response=final_response,
            final_agent=turns[-1].agent_name if turns else None,
            rounds=rounds,
        )

    async def _run_single_agent_stream(
        self,
        *,
        user_input: str,
        agent: GraphAgentDefinition,
        llm: LLMProvider,
        max_rounds: int,
        conversation_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
    ):
        """Streaming fallback when only one agent is provided."""
        logger.debug("_run_single_agent_stream: agent=%s max_rounds=%d", agent.name, max_rounds)
        if graph_context_provider and conversation_id:
            graph_context_provider.ingest_message(
                conversation_id=conversation_id,
                message_id=f"user-{uuid4().hex}",
                speaker="user",
                content=user_input,
                config=graph_config,
            )

        builder: StateGraph = StateGraph(MultiAgentMeshState)
        builder.add_node(
            agent.name,
            self._make_mesh_llm_node(
                agent=agent,
                llm=llm,
                max_rounds=max_rounds,
                all_agents=[agent],
                hub_agent_name=agent.name,
                conversation_id=conversation_id,
                graph_context_provider=graph_context_provider,
                graph_config=graph_config,
            ),
        )
        builder.add_edge(START, agent.name)
        builder.add_edge(agent.name, END)
        graph = builder.compile()

        initial: MultiAgentMeshState = {
            "input": user_input,
            "original_input": user_input,
            "turns": [],
            "conversation_history": {agent.name: []},
            "current_agent": agent.name,
            "hub_agent": agent.name,
            "agent_names": [agent.name],
            "discussion_ended": False,
            "final_response": "",
            "last_action": "",
            "rounds": 0,
        }

        async for event in graph.astream(
            initial, config=recursion_config(max_rounds), stream_mode="custom"
        ):
            if isinstance(event, dict):
                yield event

    def _build_round_budget_context(self, *, rounds_used: int, max_rounds: int) -> str:
        remaining_including_current = max(0, max_rounds - rounds_used)
        remaining_after_current = max(0, remaining_including_current - 1)
        return (
            "\n\n[Round budget]\n"
            f"- max_rounds: {max_rounds}\n"
            f"- rounds_used: {rounds_used}\n"
            f"- remaining_including_current_turn: {remaining_including_current}\n"
            f"- remaining_after_current_turn: {remaining_after_current}"
        )

    def _make_mesh_llm_node(
        self,
        agent: GraphAgentDefinition,
        llm: LLMProvider,
        max_rounds: int,
        all_agents: list[GraphAgentDefinition] = None,
        hub_agent_name: str = None,
        conversation_id: str | None = None,
        graph_context_provider: GraphContextProvider | None = None,
        graph_config: GraphContextConfig | None = None,
    ):
        """
        Create an LLM node function for multi-agent mesh communication with streaming support.

        Args:
            agent: The agent for this node
            llm: LLM provider
            all_agents: List of all agents (for routing guidance)
            hub_agent_name: Name of hub agent (for routing guidance)

        Returns:
            Async function that processes the agent's turn with stream_writer support
        """

        routing_guidance = agent.routing_guidance
        if not routing_guidance and all_agents and hub_agent_name:
            other_agents = [a for a in all_agents if a.name != agent.name]
            other_agent_profiles = [
                {
                    "name": a.name,
                    "role": a.role,
                    "description": a.description,
                }
                for a in other_agents
            ]
            routing_guidance = get_routing_guidance(
                agent.name,
                hub_agent_name,
                other_agent_profiles,
                max_concurrent=MESH_FANOUT_MAX_CONCURRENT,
            )

        async def mesh_node(state: MultiAgentMeshState) -> dict:
            stream_writer = get_stream_writer()

            # Human-in-the-loop: hold at the turn boundary while interrupted.
            await wait_while_paused(
                conversation_id=conversation_id,
                stream_writer=stream_writer,
                agent_name=agent.name,
            )

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
            logger.debug(
                "[%s] mesh_node: round=%d thread_id=%s workspace=%s",
                agent.name, state.get("rounds", 0) + 1, sandbox_thread_id, sandbox_workspace,
            )

            # Stream: Agent turn starting
            stream_writer({
                "type": EventType.AGENT_TURN_START.value,
                "agent_name": agent.name,
                "agent_role": agent.role,
                "turn": len(state.get("turns", [])) + 1,
                "round": state.get("rounds", 0) + 1,
                "sandbox_thread_id": sandbox_thread_id,
                "sandbox_workspace": sandbox_workspace,
            })

            conversation_history = state.get("conversation_history", {})
            context_parts: list[str] = []

            # Stream: Building context
            stream_writer({
                "type": EventType.CONTEXT_BUILDING.value,
                "agent_name": agent.name,
            })

            # Human-in-the-loop: pick up user messages posted mid-run so this
            # turn (and graph retrieval for later turns) sees the guidance.
            human_guidance = drain_human_guidance(
                conversation_id=conversation_id,
                stream_writer=stream_writer,
                graph_context_provider=graph_context_provider,
                graph_config=graph_config,
            )
            # First so the guidance survives tail-truncation by the token budget.
            if human_guidance:
                context_parts += [human_guidance, ""]

            # Shared working memory: pin guidance, then inject the digest so
            # prior findings survive history windows and truncation.
            ensure_working_memory(conversation_id, state["original_input"])
            if human_guidance:
                record_guidance_in_memory(conversation_id, human_guidance)
            memory_block = working_memory_block(conversation_id)
            if memory_block:
                context_parts += [memory_block, ""]

            all_recent_messages = []
            for other_agent_name in state["agent_names"]:
                if other_agent_name != agent.name and conversation_history.get(other_agent_name):
                    for msg in conversation_history[other_agent_name][-3:]:
                        all_recent_messages.append(f"{other_agent_name}: {msg}")

            if conversation_history.get(agent.name):
                for msg in conversation_history[agent.name][-2:]:
                    all_recent_messages.append(f"{agent.name}: {msg}")

            history_text = "\n".join(all_recent_messages[-5:]).strip() or "(empty)"
            logger.debug(
                "[%s] mesh_node: history_messages=%d history_chars=%d",
                agent.name, len(all_recent_messages), len(history_text),
            )

            graph_context_text = ""
            context_chunks = []
            if graph_context_provider and conversation_id:
                pack = graph_context_provider.build_graph_context(
                    conversation_id=conversation_id,
                    query=state["input"],
                    config=graph_config,
                )
                graph_context_text = pack.text
                context_chunks = pack.chunk_ids

                # Stream: Context retrieved
                stream_writer({
                    "type": EventType.CONTEXT_RETRIEVED.value,
                    "agent_name": agent.name,
                    "node_ids": pack.node_ids,
                    "edge_ids": pack.edge_ids,
                    "chunk_ids": pack.chunk_ids,
                })

            if state.get("rounds", 0) == 0:
                context_parts.append(f"user input: {state['original_input']}")
                context_parts.append("context:")
                context_parts.append(graph_context_text or "(empty)")
            else:
                previous_agent_name = state["turns"][-1].agent_name if state.get("turns") else "user"
                question_payload = state.get("input", "").strip() or "1. Please clarify the next required step."
                context_parts.append(f"user input: {state['original_input']}")
                context_parts.append(f"agent {previous_agent_name} ask agent {agent.name}:")
                context_parts.append(question_payload)
                context_parts.append("history:")
                context_parts.append(history_text)
                context_parts.append("context:")
                context_parts.append(graph_context_text or "(empty)")

            user_input = "\n".join(context_parts)
            logger.debug(
                "[%s] mesh_node: context built — graph_context_chars=%d user_input_chars=%d",
                agent.name, len(graph_context_text), len(user_input),
            )

            system_prompt_with_routing = agent.system_prompt
            if routing_guidance:
                system_prompt_with_routing = f"{system_prompt_with_routing}\n\n{routing_guidance}"
            system_prompt_with_routing += self._build_round_budget_context(
                rounds_used=int(state.get("rounds", 0)),
                max_rounds=max_rounds,
            )

            budget_result = apply_context_token_budget(
                llm=llm,
                system_prompt=system_prompt_with_routing,
                user_input=user_input,
                max_context_tokens=MAX_CONTEXT_TOKENS,
                reserved_output_tokens=RESERVED_OUTPUT_TOKENS,
            )
            user_input = budget_result.text
            logger.debug(
                "[%s] mesh_node: token budget — input_tokens=%d max=%d truncated=%s provider=%s model=%s",
                agent.name, budget_result.input_tokens, budget_result.max_input_tokens,
                budget_result.truncated, budget_result.provider, budget_result.model,
            )

            bound_tools = []
            if agent.tools:
                for toolkit in agent.tools.values():
                    bound_tools.extend(toolkit.get_tools())

            # Default human-in-the-loop tool: every agent can interrupt and ask
            # the user a question mid-run (subagents inherit it too).
            if conversation_id:
                from backend.domain.tools.ask_user import AskUserToolkit

                bound_tools.extend(
                    AskUserToolkit(
                        conversation_id=conversation_id,
                        agent_name=agent.name,
                    ).get_tools()
                )
            # Default memory tools: save/recall shared working-memory notes.
            bound_tools.extend(memory_toolkit_tools(conversation_id, agent.name))

            # Sandbox: scope to the shared conversation workspace + inject tools
            # when the chat has files (before TaskToolkit so subagents inherit).
            attach_conversation_sandbox(
                bound_tools, conversation_id=conversation_id, agent_name=agent.name
            )

            # Agent Mode: expose the `task` tool so this agent can delegate to
            # subagents (which inherit these tools minus `task`).
            if agent.subagent_enabled:
                from backend.domain.tools.task import TaskToolkit

                task_toolkit = TaskToolkit(
                    llm=llm,
                    subagent_tools=list(bound_tools),
                    max_concurrent=SUBAGENT_MAX_CONCURRENT,
                    parent_agent_name=agent.name,
                )
                bound_tools.extend(task_toolkit.get_tools())

            logger.debug(
                "[%s] mesh_node: bound_tools=%s",
                agent.name, [t.name for t in bound_tools],
            )

            # Stream: LLM request starting
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
                "has_tools": len(bound_tools) > 0,
            })

            logger.debug("[%s] mesh_node: invoking LLM...", agent.name)
            response = await safe_chat(llm,
                agent_name=agent.name,
                system=system_prompt_with_routing,
                user=user_input,
                tools=bound_tools or None,
                parallel_tools=agent.subagent_enabled,
            )
            logger.debug(
                "[%s] mesh_node: LLM response received — response_chars=%d",
                agent.name, len(response),
            )

            # Stream: LLM response received
            stream_writer({
                "type": EventType.LLM_RESPONSE_COMPLETE.value,
                "agent_name": agent.name,
                "response_length": len(response),
            })

            reasoning, action_payload = self._split_reasoning_and_action(response)
            logger.debug(
                "[%s] mesh_node: split — reasoning_chars=%d action_payload_chars=%d",
                agent.name, len(reasoning), len(action_payload),
            )

            # Parallel fan-out: if this agent dispatched a wave, run the named
            # targets concurrently and synthesize, all within this node (one
            # state update per channel — no reducer changes needed).
            fanout_pairs = self._parse_fanout(
                action_payload, state["agent_names"], agent.name
            )
            if fanout_pairs:
                logger.debug(
                    "[%s] mesh_node: FANOUT -> %s",
                    agent.name, [n for n, _ in fanout_pairs],
                )
                return await self._execute_fanout(
                    coordinator=agent,
                    fanout_pairs=fanout_pairs,
                    coordinator_reasoning=reasoning,
                    coordinator_system=system_prompt_with_routing,
                    state=state,
                    llm=llm,
                    all_agents=all_agents,
                    stream_writer=stream_writer,
                    conversation_id=conversation_id,
                    graph_context_provider=graph_context_provider,
                    graph_config=graph_config,
                )

            # Working memory: full-fidelity note outlives the 5-message
            # rolling history window above.
            record_turn_in_memory(
                conversation_id,
                agent_name=agent.name,
                turn=state.get("rounds", 0) + 1,
                content=reasoning,
                kind="result",
            )

            if graph_context_provider and conversation_id:
                graph_context_provider.ingest_message(
                    conversation_id=conversation_id,
                    message_id=f"agent-{agent.name}-{uuid4().hex}",
                    speaker=agent.name,
                    content=reasoning,
                    config=graph_config,
                )
                # Stream: Message ingested to knowledge graph
                stream_writer({
                    "type": EventType.MESSAGE_INGESTED.value,
                    "agent_name": agent.name,
                })

            turns = state["turns"]
            new_turn = GraphTurn(
                turn=len(turns) + 1,
                agent_name=agent.name,
                agent_role=agent.role,
                content=reasoning,
            )

            # Deep-copy the inner lists: dict.copy() is shallow and would mutate
            # the previous state's list in place, corrupting LangGraph snapshots.
            new_history = {k: list(v) for k, v in conversation_history.items()}
            new_history.setdefault(agent.name, []).append(reasoning)

            discussion_ended = self._has_discussion_end_signal(action_payload)
            next_agent = self._extract_target_agent_from_message(
                action_payload,
                state["agent_names"],
                agent.name,
            )
            logger.debug(
                "[%s] mesh_node: routing — discussion_ended=%s next_agent=%s",
                agent.name, discussion_ended, next_agent,
            )
            next_input = ""
            if not discussion_ended and next_agent:
                questions = self._extract_questions_for_next_agent(action_payload)
                if not questions:
                    questions = [
                        "Please continue with the highest-priority next analysis and include concrete evidence."
                    ]
                next_input = self._format_question_payload(questions)

            # Stream: Turn completed with turn object
            stream_writer({
                "type": EventType.TURN_COMPLETE.value,
                "turn": new_turn,
                "next_agent": next_agent,
                "discussion_ended": discussion_ended,
            })

            return {
                "turns": [*turns, new_turn],
                "conversation_history": new_history,
                "input": next_input,
                "current_agent": agent.name,
                "final_response": reasoning,
                "last_action": action_payload,
                "final_agent": agent.name,
                "rounds": state.get("rounds", 0) + 1,
            }

        return mesh_node

    def _decide_next_agent(
        self,
        state: MultiAgentMeshState,
        current_agent_name: str,
        max_rounds: int,
        all_agent_names: list[str],
    ) -> str:
        """
        Conditional function to determine which agent should speak next.
        
        Decision logic:
        1. If max_rounds reached → END
        2. Check if last message contains end-of-discussion signal → END
        3. Extract next agent name from last message or use round-robin
        4. Otherwise → route to next agent in round-robin fashion
        
        Args:
            state: Current graph state
            current_agent_name: Name of agent who just spoke
            max_rounds: Maximum rounds allowed
            all_agent_names: List of all available agents
            
        Returns:
            Name of next agent to speak or "end"
        """
        turns = state.get("turns", [])
        rounds = state.get("rounds", 0)

        if rounds >= max_rounds:
            logger.debug(
                "_decide_next_agent: current=%s rounds=%d/%d -> end (max_rounds reached)",
                current_agent_name, rounds, max_rounds,
            )
            return "end"

        if len(turns) == 0:
            hub_agent = state["hub_agent"]
            if current_agent_name == hub_agent:
                decision = all_agent_names[1] if len(all_agent_names) > 1 else "end"
                logger.debug(
                    "_decide_next_agent: current=%s (hub, first turn) -> %s",
                    current_agent_name, decision,
                )
                return decision
            logger.debug(
                "_decide_next_agent: current=%s (spoke, first turn) -> hub=%s",
                current_agent_name, hub_agent,
            )
            return hub_agent

        last_turn = turns[-1]
        last_content = state.get("last_action", "") or last_turn.content

        if self._has_discussion_end_signal(last_content):
            logger.debug(
                "_decide_next_agent: current=%s -> end (DISCUSSION_END signal)",
                current_agent_name,
            )
            return "end"

        next_agent = self._extract_target_agent_from_message(
            last_content, all_agent_names, current_agent_name
        )
        if next_agent:
            logger.debug(
                "_decide_next_agent: current=%s -> %s (explicit NEXT_AGENT tag)",
                current_agent_name, next_agent,
            )
            return next_agent

        decision = self._get_next_agent_roundrobin(
            current_agent_name, all_agent_names, state["hub_agent"]
        )
        logger.debug(
            "_decide_next_agent: current=%s -> %s (round-robin)",
            current_agent_name, decision,
        )
        return decision

    def _extract_target_agent_from_message(
        self,
        message: str,
        agent_names: list[str],
        current_agent_name: str,
    ) -> str | None:
        """
        Try to extract target agent name from message content.
        
        Args:
            message: Message content
            agent_names: List of all agent names
            current_agent_name: Current agent's name
            
        Returns:
            Target agent name if found, else None
        """
        match = self._NEXT_AGENT_RE.search(message)
        if not match:
            logger.debug("_extract_target_agent: no <NEXT_AGENT> tag found")
            return None

        candidate = match.group(1).strip().strip("`\"'")
        if candidate.startswith("<") and candidate.endswith(">"):
            candidate = candidate[1:-1].strip()

        if not candidate:
            logger.debug("_extract_target_agent: <NEXT_AGENT> tag empty")
            return None

        normalized = {name.lower(): name for name in agent_names}
        target = normalized.get(candidate.lower())
        if not target:
            logger.debug(
                "_extract_target_agent: candidate=%r not in agent_names=%s",
                candidate, agent_names,
            )
            return None

        if target.lower() == current_agent_name.lower():
            logger.debug(
                "_extract_target_agent: candidate=%r resolves to self (%s), ignoring",
                candidate, current_agent_name,
            )
            return None

        logger.debug(
            "_extract_target_agent: candidate=%r -> resolved=%s",
            candidate, target,
        )
        return target

    # ------------------------------------------------------------------ #
    # Parallel fan-out                                                     #
    # ------------------------------------------------------------------ #

    def _get_fanout_semaphore(self) -> asyncio.Semaphore:
        """Lazily create the wave-concurrency semaphore on the active loop."""
        sem = getattr(self, "_fanout_semaphore", None)
        if sem is None:
            sem = asyncio.Semaphore(MESH_FANOUT_MAX_CONCURRENT)
            self._fanout_semaphore = sem
        return sem

    def _parse_fanout(
        self,
        action_payload: str,
        agent_names: list[str],
        self_name: str,
    ) -> list[tuple[str, str]]:
        """Parse a `<FANOUT>` block into ordered (agent_name, task) pairs.

        Returns [] (→ caller falls back to single-routing) unless at least two
        distinct, valid, non-self target agents are found.
        """
        match = self._FANOUT_RE.search(action_payload)
        if not match:
            return []

        normalized = {name.lower(): name for name in agent_names}
        pairs: list[tuple[str, str]] = []
        seen: set[str] = set()
        for raw_name, raw_task in self._FANOUT_PAIR_RE.findall(match.group(1)):
            candidate = raw_name.strip().strip("`\"'")
            if candidate.startswith("<") and candidate.endswith(">"):
                candidate = candidate[1:-1].strip()
            target = normalized.get(candidate.lower())
            if not target or target.lower() == self_name.lower() or target in seen:
                continue
            seen.add(target)
            pairs.append((target, raw_task.strip()))

        if len(pairs) < 2:
            logger.debug(
                "_parse_fanout: %d valid target(s) (< 2) — fall back to single routing",
                len(pairs),
            )
            return []
        # Respect the advertised cap so the model cannot over-fan.
        return pairs[:MESH_FANOUT_MAX_CONCURRENT]

    def _build_branch_chat_kwargs(
        self,
        *,
        branch_agent: GraphAgentDefinition,
        task_text: str,
        state: MultiAgentMeshState,
        llm: LLMProvider,
        conversation_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
    ) -> dict:
        """Assemble safe_chat kwargs for one fan-out branch.

        Branches do NOT carry routing guidance — they execute their delegated
        sub-task and report back; the coordinator synthesizes and routes. Built
        sequentially in the node (before the gather) so graph-context reads are
        not raced across branches.
        """
        context_parts: list[str] = []
        memory_block = working_memory_block(conversation_id)
        if memory_block:
            context_parts += [memory_block, ""]
        context_parts.append(f"user input: {state['original_input']}")
        context_parts.append(
            "You have been delegated this sub-task as part of a parallel wave. "
            "Work on it independently and report your findings:"
        )
        context_parts.append(task_text or "Continue with the highest-priority analysis.")

        graph_context_text = ""
        if graph_context_provider and conversation_id:
            pack = graph_context_provider.build_graph_context(
                conversation_id=conversation_id,
                query=task_text or state.get("input", "") or state["original_input"],
                config=graph_config,
            )
            graph_context_text = pack.text
        context_parts.append("context:")
        context_parts.append(graph_context_text or "(empty)")

        user_input = "\n".join(context_parts)
        budget_result = apply_context_token_budget(
            llm=llm,
            system_prompt=branch_agent.system_prompt,
            user_input=user_input,
            max_context_tokens=MAX_CONTEXT_TOKENS,
            reserved_output_tokens=RESERVED_OUTPUT_TOKENS,
        )
        user_input = budget_result.text

        bound_tools: list = []
        if branch_agent.tools:
            for toolkit in branch_agent.tools.values():
                bound_tools.extend(toolkit.get_tools())
        if conversation_id:
            from backend.domain.tools.ask_user import AskUserToolkit

            bound_tools.extend(
                AskUserToolkit(
                    conversation_id=conversation_id,
                    agent_name=branch_agent.name,
                ).get_tools()
            )
        bound_tools.extend(memory_toolkit_tools(conversation_id, branch_agent.name))
        attach_conversation_sandbox(
            bound_tools, conversation_id=conversation_id, agent_name=branch_agent.name
        )
        if branch_agent.subagent_enabled:
            from backend.domain.tools.task import TaskToolkit

            task_toolkit = TaskToolkit(
                llm=llm,
                subagent_tools=list(bound_tools),
                max_concurrent=SUBAGENT_MAX_CONCURRENT,
                parent_agent_name=branch_agent.name,
            )
            bound_tools.extend(task_toolkit.get_tools())

        return {
            "system": branch_agent.system_prompt,
            "user": user_input,
            "tools": bound_tools or None,
            "parallel_tools": branch_agent.subagent_enabled,
        }

    async def _execute_fanout(
        self,
        *,
        coordinator: GraphAgentDefinition,
        fanout_pairs: list[tuple[str, str]],
        coordinator_reasoning: str,
        coordinator_system: str,
        state: MultiAgentMeshState,
        llm: LLMProvider,
        all_agents: list[GraphAgentDefinition],
        stream_writer,
        conversation_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
    ) -> dict:
        """Run a parallel wave then synthesize, returning the merged state dict.

        Layout of appended turns (1 superstep = 1 round):
            coordinator (fan-out decision) | branch_1 .. branch_N | synthesis
        ``last_action`` is the synthesis action so the existing conditional
        edge router keeps working unchanged — fan-out is invisible to the graph.
        """
        turns = state["turns"]
        agent_by_name = {a.name: a for a in all_agents}
        base_turn = len(turns) + 1  # coordinator's own turn number

        # Record/ingest the coordinator's fan-out decision as its own turn.
        record_turn_in_memory(
            conversation_id,
            agent_name=coordinator.name,
            turn=base_turn,
            content=coordinator_reasoning,
            kind="decision",
        )
        if graph_context_provider and conversation_id:
            graph_context_provider.ingest_message(
                conversation_id=conversation_id,
                message_id=f"agent-{coordinator.name}-{uuid4().hex}",
                speaker=coordinator.name,
                content=coordinator_reasoning,
                config=graph_config,
            )
        coordinator_turn = GraphTurn(
            turn=base_turn,
            agent_name=coordinator.name,
            agent_role=coordinator.role,
            content=coordinator_reasoning,
        )
        stream_writer({
            "type": EventType.TURN_COMPLETE.value,
            "turn": coordinator_turn,
            "fanout_dispatch": True,
        })

        target_names = [name for name, _ in fanout_pairs]
        stream_writer({
            "type": EventType.FANOUT_START.value,
            "agent_name": coordinator.name,
            "targets": target_names,
        })

        # Pre-build each branch's chat kwargs sequentially (graph reads not raced).
        prebuilt: dict[str, dict] = {}
        branches: list[tuple[GraphAgentDefinition, str]] = []
        for target_name, task_text in fanout_pairs:
            branch_agent = agent_by_name[target_name]
            prebuilt[target_name] = self._build_branch_chat_kwargs(
                branch_agent=branch_agent,
                task_text=task_text,
                state=state,
                llm=llm,
                conversation_id=conversation_id,
                graph_context_provider=graph_context_provider,
                graph_config=graph_config,
            )
            branches.append((branch_agent, task_text))

        results = await run_fanout_wave(
            branches=branches,
            llm=llm,
            build_branch_chat_kwargs=lambda a, _t: prebuilt[a.name],
            semaphore=self._get_fanout_semaphore(),
            stream_writer=stream_writer,
            conversation_id=conversation_id,
            graph_context_provider=graph_context_provider,
            graph_config=graph_config,
            base_turn_number=base_turn,
            split_fn=self._split_reasoning_and_action,
        )

        stream_writer({
            "type": EventType.FANOUT_COMPLETE.value,
            "agent_name": coordinator.name,
            "targets": target_names,
        })

        branch_turns = [
            GraphTurn(
                turn=r.turn,
                agent_name=r.agent_name,
                agent_role=r.agent_role,
                content=r.content,
            )
            for r in results
        ]

        # Coordinator synthesizes the wave's results, then emits one control action.
        synthesis_user = (
            "You dispatched a parallel wave. Here are the specialists' results:\n\n"
            + "\n\n".join(
                f"### {r.agent_name} (sub-task: {r.task})\n{r.content}" for r in results
            )
        )
        synthesis_system = f"{coordinator_system}\n\n{FANOUT_SYNTHESIS_GUIDANCE}"
        synth_raw = await safe_chat(
            llm,
            agent_name=coordinator.name,
            system=synthesis_system,
            user=synthesis_user,
        )
        synth_reasoning, synth_action = self._split_reasoning_and_action(synth_raw)

        synthesis_turn_number = base_turn + len(results) + 1
        record_turn_in_memory(
            conversation_id,
            agent_name=coordinator.name,
            turn=synthesis_turn_number,
            content=synth_reasoning,
            kind="result",
        )
        if graph_context_provider and conversation_id:
            graph_context_provider.ingest_message(
                conversation_id=conversation_id,
                message_id=f"agent-{coordinator.name}-{uuid4().hex}",
                speaker=coordinator.name,
                content=synth_reasoning,
                config=graph_config,
            )
        synthesis_turn = GraphTurn(
            turn=synthesis_turn_number,
            agent_name=coordinator.name,
            agent_role=coordinator.role,
            content=synth_reasoning,
        )

        discussion_ended = self._has_discussion_end_signal(synth_action)
        next_agent = self._extract_target_agent_from_message(
            synth_action, state["agent_names"], coordinator.name
        )
        next_input = ""
        if not discussion_ended and next_agent:
            questions = self._extract_questions_for_next_agent(synth_action)
            if not questions:
                questions = [
                    "Please continue with the highest-priority next analysis and include concrete evidence."
                ]
            next_input = self._format_question_payload(questions)

        stream_writer({
            "type": EventType.TURN_COMPLETE.value,
            "turn": synthesis_turn,
            "next_agent": next_agent,
            "discussion_ended": discussion_ended,
        })

        # Update conversation history with every turn produced this wave.
        new_history = {k: list(v) for k, v in state.get("conversation_history", {}).items()}
        new_history.setdefault(coordinator.name, []).append(coordinator_reasoning)
        for r in results:
            new_history.setdefault(r.agent_name, []).append(r.content)
        new_history.setdefault(coordinator.name, []).append(synth_reasoning)

        return {
            "turns": [*turns, coordinator_turn, *branch_turns, synthesis_turn],
            "conversation_history": new_history,
            "input": next_input,
            "current_agent": coordinator.name,
            "final_response": synth_reasoning,
            "last_action": synth_action,
            "final_agent": coordinator.name,
            "rounds": state.get("rounds", 0) + 1,
        }

    def _has_discussion_end_signal(self, message: str) -> bool:
        """Return True when explicit `<DISCUSSION_END>...</DISCUSSION_END>` tag is present."""
        return bool(self._DISCUSSION_END_RE.search(message))

    def _split_reasoning_and_action(self, message: str) -> tuple[str, str]:
        """Split model output into user-visible reasoning and machine-readable action blocks."""
        if not message:
            return "", ""

        action_blocks = [m.group(0).strip() for m in self._CONTROL_BLOCK_RE.finditer(message)]
        action_payload = "\n".join(block for block in action_blocks if block).strip()

        reasoning = self._CONTROL_BLOCK_RE.sub("", message)
        reasoning = re.sub(r"\n{3,}", "\n\n", reasoning).strip()

        return reasoning, action_payload

    def _extract_questions_for_next_agent(self, message: str) -> list[str]:
        """Extract the handoff questions from `<ASK_NEXT_AGENT>...</ASK_NEXT_AGENT>` block."""
        match = self._ASK_NEXT_AGENT_RE.search(message)
        if not match:
            return []

        block = match.group(1).strip()
        if not block:
            return []

        questions: list[str] = []
        for line in block.splitlines():
            normalized = line.strip()
            if not normalized:
                continue
            cleaned = re.sub(r"^\d+[\.)]\s*", "", normalized).strip("- ")
            if cleaned:
                questions.append(cleaned)

        return questions

    def _format_question_payload(self, questions: list[str]) -> str:
        """Convert questions to the compact numbered payload passed to the next agent."""
        lines = [f"{index}. {question}" for index, question in enumerate(questions, start=1)]
        return "\n".join(lines)

    def _get_next_agent_roundrobin(
        self,
        current_agent_name: str,
        agent_names: list[str],
        hub_agent_name: str,
    ) -> str:
        """
        Get next agent in round-robin fashion, biased towards hub.
        
        Args:
            current_agent_name: Current agent
            agent_names: All available agents
            hub_agent_name: Hub agent name
            
        Returns:
            Next agent name
        """
        current_idx = agent_names.index(current_agent_name)
        
        if current_agent_name != hub_agent_name:
            return hub_agent_name
        
        next_idx = (current_idx + 1) % len(agent_names)
        next_agent = agent_names[next_idx]
        
        if next_agent == hub_agent_name:
            next_idx = (next_idx + 1) % len(agent_names)
            next_agent = agent_names[next_idx]
        
        return next_agent

