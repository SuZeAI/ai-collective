from __future__ import annotations

import asyncio
import re
from typing import TypedDict
from uuid import uuid4

from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from server.domain.prompt.routing_prompt import get_routing_guidance
from server.app.ports.staff_graph import (
    StaffGraphOrchestrator,
    GraphStaffDefinition,
    GraphContextProvider,
    GraphRunResult,
    GraphTurn,
)
from server.app.ports.llm import LLMProvider
from server.domain.event.schema import EventType
from server.domain.memory.knowledge_graph import GraphContextConfig
from server.domain.staff._graph_runtime import (
    FANOUT_SYNTHESIS_GUIDANCE,
    MESH_FANOUT_MAX_CONCURRENT,
    attach_subagent_toolkit,
    build_agent_tools,
    build_turn_messages,
    drain_human_guidance,
    ensure_working_memory,
    record_guidance_in_memory,
    record_turn_in_memory,
    recursion_config,
    raise_if_llm_failed,
    run_fanout_wave,
    run_to_final_state,
    safe_chat,
    wait_while_paused,
    working_memory_block,
)
from server.domain.staff.staff_state import (
    StaffStates,
    append_assistant_turn,
    append_user_turn,
    init_staff_states,
    llm_ready_messages,
)
from server.api.settings import settings
from server.log import get_logger

logger = get_logger(__name__)

MAX_CONTEXT_TOKENS = max(1024, settings.staff.context_token_limit)
RESERVED_OUTPUT_TOKENS = max(256, settings.staff.output_token_reserve)


class MultiAgentMeshState(TypedDict):
    """State for multi-staff_member mesh topology with central hub"""
    input: str
    original_input: str
    turns: list[GraphTurn]
    conversation_history: dict[str, list[str]]
    staff_states: StaffStates
    current_agent: str
    hub_staff: str
    staff_names: list[str]
    discussion_ended: bool
    final_response: str
    last_action: str
    rounds: int


class MultiAgentMeshOrchestrator(StaffGraphOrchestrator):
    """
    Orchestrator for multi-staff_member mesh topology where one central staff_member
    connects bidirectionally to all other staff. The conditional function
    determines which staff_member speaks next based on conversation content.

    Topology: 1 hub staff_member ↔ N spoke staff
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
        staff: list[GraphStaffDefinition],
        llm: LLMProvider,
        max_rounds: int,
        conversation_id: str | None = None,
        graph_context_provider: GraphContextProvider | None = None,
        graph_config: GraphContextConfig | None = None,
        custom_graph=None,  # accepted for protocol parity; ignored by this mode
    ) -> GraphRunResult:
        """
        Execute multi-staff_member mesh graph where all staff can connect to each other.

        Args:
            user_input: Initial input to start the discussion
            staff: List of staff. First staff_member acts as hub/starter.
            llm: LLM provider for staff_member responses
            max_rounds: Maximum discussion rounds before forced stop

        Returns:
            GraphRunResult with conversation turns and final response
        """
        if not staff:
            raise ValueError("At least one staff_member definition is required")

        logger.debug(
            "MeshOrchestrator.run: staff=%s max_rounds=%d conversation_id=%s",
            [a.name for a in staff], max_rounds, conversation_id,
        )

        if len(staff) == 1:
            logger.debug("MeshOrchestrator.run: single-staff_member fallback -> %s", staff[0].name)
            return await self._run_single_agent(
                user_input=user_input,
                staff_member=staff[0],
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

        hub_staff = staff[0]
        all_staff_names = [a.name for a in staff]

        for staff_member in staff:
            builder.add_node(
                staff_member.name,
                self._make_mesh_llm_node(
                    staff_member=staff_member,
                    llm=llm,
                    max_rounds=max_rounds,
                    all_staff=staff,
                    hub_staff_name=hub_staff.name,
                    conversation_id=conversation_id,
                    graph_context_provider=graph_context_provider,
                    graph_config=graph_config,
                ),
            )

        for staff_member in staff:
            def should_route_to_next(state, current_staff_name=staff_member.name):
                return self._decide_next_staff(
                    state,
                    current_staff_name,
                    max_rounds,
                    all_staff_names,
                )

            routing_options = {name: name for name in all_staff_names if name != staff_member.name}
            routing_options["end"] = END

            builder.add_conditional_edges(
                staff_member.name,
                should_route_to_next,
                routing_options,
            )

        builder.add_edge(START, hub_staff.name)
        graph = builder.compile()
        logger.debug(
            "MeshOrchestrator.run: graph compiled — hub=%s staff=%s",
            hub_staff.name, all_staff_names,
        )

        initial: MultiAgentMeshState = {
            "input": user_input,
            "original_input": user_input,
            "turns": [],
            "conversation_history": {
                staff_member.name: [] for staff_member in staff
            },
            "staff_states": init_staff_states(staff),
            "current_agent": hub_staff.name,
            "hub_staff": hub_staff.name,
            "staff_names": all_staff_names,
            "discussion_ended": False,
            "final_response": "",
            "last_action": "",
            "rounds": 0,
        }

        final_state, error = await run_to_final_state(graph, initial, max_rounds)
        turns = list(final_state.get("turns", []))
        final_response = final_state.get("final_response") or (
            turns[-1].content if turns else ""
        )
        rounds = int(final_state.get("rounds", len(turns)))
        logger.debug(
            "MeshOrchestrator.run: complete — turns=%d rounds=%d final_staff=%s",
            len(turns), rounds, turns[-1].staff_name if turns else None,
        )
        return GraphRunResult(
            turns=turns,
            final_response=final_response,
            final_staff=turns[-1].staff_name if turns else None,
            rounds=rounds,
            error=error,
        )

    async def run_stream(
        self,
        *,
        user_input: str,
        staff: list[GraphStaffDefinition],
        llm: LLMProvider,
        max_rounds: int,
        conversation_id: str | None = None,
        graph_context_provider: GraphContextProvider | None = None,
        graph_config: GraphContextConfig | None = None,
        custom_graph=None,  # accepted for protocol parity; ignored by this mode
    ):
        """Streaming version using get_stream_writer for real-time custom events"""
        if not staff:
            raise ValueError("At least one staff_member definition is required")

        logger.debug(
            "MeshOrchestrator.run_stream: staff=%s max_rounds=%d conversation_id=%s",
            [a.name for a in staff], max_rounds, conversation_id,
        )

        if len(staff) == 1:
            logger.debug("MeshOrchestrator.run_stream: single-staff_member fallback -> %s", staff[0].name)
            async for turn in self._run_single_agent_stream(
                user_input=user_input,
                staff_member=staff[0],
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

        hub_staff = staff[0]
        all_staff_names = [a.name for a in staff]

        for staff_member in staff:
            builder.add_node(
                staff_member.name,
                self._make_mesh_llm_node(
                    staff_member=staff_member,
                    llm=llm,
                    max_rounds=max_rounds,
                    all_staff=staff,
                    hub_staff_name=hub_staff.name,
                    conversation_id=conversation_id,
                    graph_context_provider=graph_context_provider,
                    graph_config=graph_config,
                ),
            )

        for staff_member in staff:
            def should_route_to_next(state, current_staff_name=staff_member.name):
                return self._decide_next_staff(
                    state,
                    current_staff_name,
                    max_rounds,
                    all_staff_names,
                )

            routing_options = {name: name for name in all_staff_names if name != staff_member.name}
            routing_options["end"] = END

            builder.add_conditional_edges(
                staff_member.name,
                should_route_to_next,
                routing_options,
            )

        builder.add_edge(START, hub_staff.name)
        graph = builder.compile()
        logger.debug(
            "MeshOrchestrator.run_stream: graph compiled — hub=%s staff=%s, streaming...",
            hub_staff.name, all_staff_names,
        )

        initial: MultiAgentMeshState = {
            "input": user_input,
            "original_input": user_input,
            "turns": [],
            "conversation_history": {
                staff_member.name: [] for staff_member in staff
            },
            "staff_states": init_staff_states(staff),
            "current_agent": hub_staff.name,
            "hub_staff": hub_staff.name,
            "staff_names": all_staff_names,
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
        staff_member: GraphStaffDefinition,
        llm: LLMProvider,
        max_rounds: int,
        conversation_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
    ) -> GraphRunResult:
        """Fallback execution path when only one staff_member is provided."""
        logger.debug("_run_single_agent: staff_member=%s max_rounds=%d", staff_member.name, max_rounds)
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
            staff_member.name,
            self._make_mesh_llm_node(
                staff_member=staff_member,
                llm=llm,
                max_rounds=max_rounds,
                all_staff=[staff_member],
                hub_staff_name=staff_member.name,
                conversation_id=conversation_id,
                graph_context_provider=graph_context_provider,
                graph_config=graph_config,
            ),
        )
        builder.add_edge(START, staff_member.name)
        builder.add_edge(staff_member.name, END)
        graph = builder.compile()

        initial: MultiAgentMeshState = {
            "input": user_input,
            "original_input": user_input,
            "turns": [],
            "conversation_history": {staff_member.name: []},
            "staff_states": init_staff_states([staff_member]),
            "current_agent": staff_member.name,
            "hub_staff": staff_member.name,
            "staff_names": [staff_member.name],
            "discussion_ended": False,
            "final_response": "",
            "last_action": "",
            "rounds": 0,
        }
        final_state, error = await run_to_final_state(graph, initial, max_rounds)
        turns = list(final_state.get("turns", []))
        final_response = final_state.get("final_response") or (
            turns[-1].content if turns else ""
        )
        rounds = int(final_state.get("rounds", len(turns)))
        return GraphRunResult(
            turns=turns,
            final_response=final_response,
            final_staff=turns[-1].staff_name if turns else None,
            rounds=rounds,
            error=error,
        )

    async def _run_single_agent_stream(
        self,
        *,
        user_input: str,
        staff_member: GraphStaffDefinition,
        llm: LLMProvider,
        max_rounds: int,
        conversation_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
    ):
        """Streaming fallback when only one staff_member is provided."""
        logger.debug("_run_single_agent_stream: staff_member=%s max_rounds=%d", staff_member.name, max_rounds)
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
            staff_member.name,
            self._make_mesh_llm_node(
                staff_member=staff_member,
                llm=llm,
                max_rounds=max_rounds,
                all_staff=[staff_member],
                hub_staff_name=staff_member.name,
                conversation_id=conversation_id,
                graph_context_provider=graph_context_provider,
                graph_config=graph_config,
            ),
        )
        builder.add_edge(START, staff_member.name)
        builder.add_edge(staff_member.name, END)
        graph = builder.compile()

        initial: MultiAgentMeshState = {
            "input": user_input,
            "original_input": user_input,
            "turns": [],
            "conversation_history": {staff_member.name: []},
            "staff_states": init_staff_states([staff_member]),
            "current_agent": staff_member.name,
            "hub_staff": staff_member.name,
            "staff_names": [staff_member.name],
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
        staff_member: GraphStaffDefinition,
        llm: LLMProvider,
        max_rounds: int,
        all_staff: list[GraphStaffDefinition] = None,
        hub_staff_name: str = None,
        conversation_id: str | None = None,
        graph_context_provider: GraphContextProvider | None = None,
        graph_config: GraphContextConfig | None = None,
    ):
        """
        Create an LLM node function for multi-staff_member mesh communication with streaming support.

        Args:
            staff_member: The staff_member for this node
            llm: LLM provider
            all_staff: List of all staff (for routing guidance)
            hub_staff_name: Name of hub staff_member (for routing guidance)

        Returns:
            Async function that processes the staff_member's turn with stream_writer support
        """

        routing_guidance = staff_member.routing_guidance
        if not routing_guidance and all_staff and hub_staff_name:
            other_agents = [a for a in all_staff if a.name != staff_member.name]
            other_agent_profiles = [
                {
                    "name": a.name,
                    "role": a.role,
                    "description": a.description,
                }
                for a in other_agents
            ]
            routing_guidance = get_routing_guidance(
                staff_member.name,
                hub_staff_name,
                other_agent_profiles,
                max_concurrent=MESH_FANOUT_MAX_CONCURRENT,
            )

        # routing_guidance depends only on this node's static profile data, so
        # this system prompt is byte-identical for every turn/round of this
        # staff_member — the round budget (which DOES change every turn) goes
        # in the per-turn context instead, so the compiled-agent cache and
        # upstream provider prompt-caching see a stable prefix.
        fixed_system_prompt = staff_member.system_prompt
        if routing_guidance:
            fixed_system_prompt = f"{fixed_system_prompt}\n\n{routing_guidance}"

        async def mesh_node(state: MultiAgentMeshState) -> dict:
            stream_writer = get_stream_writer()

            # Human-in-the-loop: hold at the turn boundary while interrupted.
            await wait_while_paused(
                conversation_id=conversation_id,
                stream_writer=stream_writer,
                staff_name=staff_member.name,
            )

            # Generate a unique thread_id for this staff_member turn.
            # Also creates {SANDBOX_WORKSPACE}/{thread_id}/ immediately.
            from server.infra.sandbox.sandbox_session import (
                new_thread_id as _new_thread_id,
                get_thread_workspace as _get_thread_workspace,
            )
            from server.api.settings import settings as _settings
            sandbox_thread_id = _new_thread_id(
                staff_name=staff_member.name,
                task_id=conversation_id,
            )
            sandbox_workspace = _get_thread_workspace(
                _settings.sandbox_workspace or "", sandbox_thread_id
            )
            logger.debug(
                "[%s] mesh_node: round=%d thread_id=%s workspace=%s",
                staff_member.name, state.get("rounds", 0) + 1, sandbox_thread_id, sandbox_workspace,
            )

            # Stream: Staff turn starting
            stream_writer({
                "type": EventType.AGENT_TURN_START.value,
                "agent_name": staff_member.name,
                "staff_role": staff_member.role,
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
                "agent_name": staff_member.name,
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
            for other_staff_name in state["staff_names"]:
                if other_staff_name != staff_member.name and conversation_history.get(other_staff_name):
                    for msg in conversation_history[other_staff_name][-3:]:
                        all_recent_messages.append(f"{other_staff_name}: {msg}")

            if conversation_history.get(staff_member.name):
                for msg in conversation_history[staff_member.name][-2:]:
                    all_recent_messages.append(f"{staff_member.name}: {msg}")

            history_text = "\n".join(all_recent_messages[-5:]).strip() or "(empty)"
            logger.debug(
                "[%s] mesh_node: history_messages=%d history_chars=%d",
                staff_member.name, len(all_recent_messages), len(history_text),
            )

            graph_context_text = ""
            if graph_context_provider and conversation_id:
                pack = graph_context_provider.build_graph_context(
                    conversation_id=conversation_id,
                    query=state["input"],
                    config=graph_config,
                )
                graph_context_text = pack.text

                # Stream: Context retrieved
                stream_writer({
                    "type": EventType.CONTEXT_RETRIEVED.value,
                    "agent_name": staff_member.name,
                    "node_ids": pack.node_ids,
                    "edge_ids": pack.edge_ids,
                    "chunk_ids": pack.chunk_ids,
                })

            round_budget_text = self._build_round_budget_context(
                rounds_used=int(state.get("rounds", 0)),
                max_rounds=max_rounds,
            )

            if state.get("rounds", 0) == 0:
                input_text = state["original_input"]
                context_parts.append(f"user input: {state['original_input']}")
                context_parts.append("context:")
                context_parts.append(graph_context_text or "(empty)")
            else:
                previous_staff_name = state["turns"][-1].staff_name if state.get("turns") else "user"
                input_text = state.get("input", "").strip() or "1. Please clarify the next required step."
                context_parts.append(f"user input: {state['original_input']}")
                context_parts.append(f"staff_member {previous_staff_name} ask staff_member {staff_member.name}:")
                context_parts.append("history:")
                context_parts.append(history_text)
                context_parts.append("context:")
                context_parts.append(graph_context_text or "(empty)")
            context_parts.append(round_budget_text)

            bound_tools = build_agent_tools(staff_member, conversation_id=conversation_id)
            attach_subagent_toolkit(bound_tools, staff_member, llm=llm)

            logger.debug(
                "[%s] mesh_node: bound_tools=%s",
                staff_member.name, [t.name for t in bound_tools],
            )

            # fixed_system_prompt stays byte-identical every turn so the
            # compiled-agent cache and upstream provider prompt-caching see a
            # stable prefix; only context_parts is budget-trimmed.
            turn, budget_result = build_turn_messages(
                llm=llm,
                system_prompt=fixed_system_prompt,
                context_text="\n".join(context_parts),
                input_text=input_text,
                max_context_tokens=MAX_CONTEXT_TOKENS,
                reserved_output_tokens=RESERVED_OUTPUT_TOKENS,
            )
            logger.debug(
                "[%s] mesh_node: token budget — input_tokens=%d max=%d truncated=%s provider=%s model=%s",
                staff_member.name, budget_result.input_tokens, budget_result.max_input_tokens,
                budget_result.truncated, budget_result.provider, budget_result.model,
            )

            # Stream: LLM request starting
            stream_writer({
                "type": EventType.LLM_REQUEST_START.value,
                "agent_name": staff_member.name,
                "context_length": sum(len(m["content"]) for m in turn.as_messages()),
                "context_tokens": budget_result.input_tokens,
                "context_token_limit": budget_result.max_input_tokens,
                "context_truncated": budget_result.truncated,
                "tokenizer_family": budget_result.tokenizer_family,
                "llm_provider": budget_result.provider,
                "llm_model": budget_result.model,
                "has_tools": len(bound_tools) > 0,
            })

            logger.debug("[%s] mesh_node: invoking LLM...", staff_member.name)
            own_history = llm_ready_messages(state.get("staff_states", {}), staff_member.name)
            response = await safe_chat(llm,
                staff_name=staff_member.name,
                system=fixed_system_prompt,
                messages=[*own_history, *turn.as_messages()],
                tools=bound_tools or None,
                parallel_tools=staff_member.subagent_enabled,
            )
            raise_if_llm_failed(response)
            logger.debug(
                "[%s] mesh_node: LLM response received — response_chars=%d",
                staff_member.name, len(response),
            )

            # Stream: LLM response received
            stream_writer({
                "type": EventType.LLM_RESPONSE_COMPLETE.value,
                "agent_name": staff_member.name,
                "response_length": len(response),
            })

            reasoning, action_payload = self._split_reasoning_and_action(response)
            logger.debug(
                "[%s] mesh_node: split — reasoning_chars=%d action_payload_chars=%d",
                staff_member.name, len(reasoning), len(action_payload),
            )

            new_staff_states = append_assistant_turn(
                append_user_turn(state.get("staff_states", {}), staff_member.name, input_text),
                staff_member.name,
                reasoning,
            )

            # Parallel fan-out: if this staff_member dispatched a wave, run the named
            # targets concurrently and synthesize, all within this node (one
            # state update per channel — no reducer changes needed).
            fanout_pairs = self._parse_fanout(
                action_payload, state["staff_names"], staff_member.name
            )
            if fanout_pairs:
                logger.debug(
                    "[%s] mesh_node: FANOUT -> %s",
                    staff_member.name, [n for n, _ in fanout_pairs],
                )
                return await self._execute_fanout(
                    coordinator=staff_member,
                    fanout_pairs=fanout_pairs,
                    coordinator_reasoning=reasoning,
                    coordinator_system=fixed_system_prompt,
                    staff_states=new_staff_states,
                    state=state,
                    llm=llm,
                    all_staff=all_staff,
                    stream_writer=stream_writer,
                    conversation_id=conversation_id,
                    graph_context_provider=graph_context_provider,
                    graph_config=graph_config,
                )

            # Working memory: full-fidelity note outlives the 5-message
            # rolling history window above.
            record_turn_in_memory(
                conversation_id,
                staff_name=staff_member.name,
                turn=state.get("rounds", 0) + 1,
                content=reasoning,
                kind="result",
            )

            if graph_context_provider and conversation_id:
                graph_context_provider.ingest_message(
                    conversation_id=conversation_id,
                    message_id=f"staff_member-{staff_member.name}-{uuid4().hex}",
                    speaker=staff_member.name,
                    content=reasoning,
                    config=graph_config,
                )
                # Stream: Message ingested to knowledge graph
                stream_writer({
                    "type": EventType.MESSAGE_INGESTED.value,
                    "agent_name": staff_member.name,
                })

            turns = state["turns"]
            new_turn = GraphTurn(
                turn=len(turns) + 1,
                staff_name=staff_member.name,
                staff_role=staff_member.role,
                content=reasoning,
            )

            # Deep-copy the inner lists: dict.copy() is shallow and would mutate
            # the previous state's list in place, corrupting LangGraph snapshots.
            new_history = {k: list(v) for k, v in conversation_history.items()}
            new_history.setdefault(staff_member.name, []).append(reasoning)

            discussion_ended = self._has_discussion_end_signal(action_payload)
            next_staff = self._extract_target_agent_from_message(
                action_payload,
                state["staff_names"],
                staff_member.name,
            )
            logger.debug(
                "[%s] mesh_node: routing — discussion_ended=%s next_staff=%s",
                staff_member.name, discussion_ended, next_staff,
            )
            next_input = ""
            if not discussion_ended and next_staff:
                questions = self._extract_questions_for_next_staff(action_payload)
                if not questions:
                    questions = [
                        "Please continue with the highest-priority next analysis and include concrete evidence."
                    ]
                next_input = self._format_question_payload(questions)

            # Stream: Turn completed with turn object
            stream_writer({
                "type": EventType.TURN_COMPLETE.value,
                "turn": new_turn,
                "next_staff": next_staff,
                "discussion_ended": discussion_ended,
            })

            return {
                "turns": [*turns, new_turn],
                "conversation_history": new_history,
                "staff_states": new_staff_states,
                "input": next_input,
                "current_agent": staff_member.name,
                "final_response": reasoning,
                "last_action": action_payload,
                "final_staff": staff_member.name,
                "rounds": state.get("rounds", 0) + 1,
            }

        return mesh_node

    def _decide_next_staff(
        self,
        state: MultiAgentMeshState,
        current_staff_name: str,
        max_rounds: int,
        all_staff_names: list[str],
    ) -> str:
        """
        Conditional function to determine which staff_member should speak next.

        Decision logic:
        1. If max_rounds reached → END
        2. Check if last message contains end-of-discussion signal → END
        3. Extract next staff_member name from last message or use round-robin
        4. Otherwise → route to next staff_member in round-robin fashion

        Args:
            state: Current graph state
            current_staff_name: Name of staff_member who just spoke
            max_rounds: Maximum rounds allowed
            all_staff_names: List of all available staff

        Returns:
            Name of next staff_member to speak or "end"
        """
        turns = state.get("turns", [])
        rounds = state.get("rounds", 0)

        if rounds >= max_rounds:
            logger.debug(
                "_decide_next_staff: current=%s rounds=%d/%d -> end (max_rounds reached)",
                current_staff_name, rounds, max_rounds,
            )
            return "end"

        if len(turns) == 0:
            hub_staff = state["hub_staff"]
            if current_staff_name == hub_staff:
                decision = all_staff_names[1] if len(all_staff_names) > 1 else "end"
                logger.debug(
                    "_decide_next_staff: current=%s (hub, first turn) -> %s",
                    current_staff_name, decision,
                )
                return decision
            logger.debug(
                "_decide_next_staff: current=%s (spoke, first turn) -> hub=%s",
                current_staff_name, hub_staff,
            )
            return hub_staff

        last_turn = turns[-1]
        last_content = state.get("last_action", "") or last_turn.content

        if self._has_discussion_end_signal(last_content):
            logger.debug(
                "_decide_next_staff: current=%s -> end (DISCUSSION_END signal)",
                current_staff_name,
            )
            return "end"

        next_staff = self._extract_target_agent_from_message(
            last_content, all_staff_names, current_staff_name
        )
        if next_staff:
            logger.debug(
                "_decide_next_staff: current=%s -> %s (explicit NEXT_AGENT tag)",
                current_staff_name, next_staff,
            )
            return next_staff

        decision = self._get_next_staff_roundrobin(
            current_staff_name, all_staff_names, state["hub_staff"]
        )
        logger.debug(
            "_decide_next_staff: current=%s -> %s (round-robin)",
            current_staff_name, decision,
        )
        return decision

    def _extract_target_agent_from_message(
        self,
        message: str,
        staff_names: list[str],
        current_staff_name: str,
    ) -> str | None:
        """
        Try to extract target staff_member name from message content.

        Args:
            message: Message content
            staff_names: List of all staff_member names
            current_staff_name: Current staff_member's name

        Returns:
            Target staff_member name if found, else None
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

        normalized = {name.lower(): name for name in staff_names}
        target = normalized.get(candidate.lower())
        if not target:
            logger.debug(
                "_extract_target_agent: candidate=%r not in staff_names=%s",
                candidate, staff_names,
            )
            return None

        if target.lower() == current_staff_name.lower():
            logger.debug(
                "_extract_target_agent: candidate=%r resolves to self (%s), ignoring",
                candidate, current_staff_name,
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
        staff_names: list[str],
        self_name: str,
    ) -> list[tuple[str, str]]:
        """Parse a `<FANOUT>` block into ordered (staff_name, task) pairs.

        Returns [] (→ caller falls back to single-routing) unless at least two
        distinct, valid, non-self target staff are found.
        """
        match = self._FANOUT_RE.search(action_payload)
        if not match:
            return []

        normalized = {name.lower(): name for name in staff_names}
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
        branch_agent: GraphStaffDefinition,
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

        input_text = task_text or "Continue with the highest-priority analysis."
        turn, _budget_result = build_turn_messages(
            llm=llm,
            system_prompt=branch_agent.system_prompt,
            context_text="\n".join(context_parts),
            input_text=input_text,
            max_context_tokens=MAX_CONTEXT_TOKENS,
            reserved_output_tokens=RESERVED_OUTPUT_TOKENS,
        )

        bound_tools = build_agent_tools(branch_agent, conversation_id=conversation_id)
        attach_subagent_toolkit(bound_tools, branch_agent, llm=llm)

        return {
            "system": branch_agent.system_prompt,
            "messages": turn.as_messages(),
            "tools": bound_tools or None,
            "parallel_tools": branch_agent.subagent_enabled,
        }

    async def _execute_fanout(
        self,
        *,
        coordinator: GraphStaffDefinition,
        fanout_pairs: list[tuple[str, str]],
        coordinator_reasoning: str,
        coordinator_system: str,
        staff_states: StaffStates,
        state: MultiAgentMeshState,
        llm: LLMProvider,
        all_staff: list[GraphStaffDefinition],
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
        staff_by_name = {a.name: a for a in all_staff}
        base_turn = len(turns) + 1  # coordinator's own turn number

        # Record/ingest the coordinator's fan-out decision as its own turn.
        record_turn_in_memory(
            conversation_id,
            staff_name=coordinator.name,
            turn=base_turn,
            content=coordinator_reasoning,
            kind="decision",
        )
        if graph_context_provider and conversation_id:
            graph_context_provider.ingest_message(
                conversation_id=conversation_id,
                message_id=f"staff_member-{coordinator.name}-{uuid4().hex}",
                speaker=coordinator.name,
                content=coordinator_reasoning,
                config=graph_config,
            )
        coordinator_turn = GraphTurn(
            turn=base_turn,
            staff_name=coordinator.name,
            staff_role=coordinator.role,
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
        branches: list[tuple[GraphStaffDefinition, str]] = []
        for target_name, task_text in fanout_pairs:
            branch_agent = staff_by_name[target_name]
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
                staff_name=r.staff_name,
                staff_role=r.staff_role,
                content=r.content,
            )
            for r in results
        ]

        # Coordinator synthesizes the wave's results, then emits one control action.
        synthesis_user = (
            "You dispatched a parallel wave. Here are the specialists' results:\n\n"
            + "\n\n".join(
                f"### {r.staff_name} (sub-task: {r.task})\n{r.content}" for r in results
            )
        )
        # coordinator_system is fixed_system_prompt (fixed) and
        # FANOUT_SYNTHESIS_GUIDANCE is a static constant, so synthesis_system
        # stays stable across every synthesis call for this coordinator.
        synthesis_system = f"{coordinator_system}\n\n{FANOUT_SYNTHESIS_GUIDANCE}"
        synth_raw = await safe_chat(
            llm,
            staff_name=coordinator.name,
            system=synthesis_system,
            messages=[{"role": "user", "content": synthesis_user}],
        )
        raise_if_llm_failed(synth_raw)
        synth_reasoning, synth_action = self._split_reasoning_and_action(synth_raw)

        synthesis_turn_number = base_turn + len(results) + 1
        record_turn_in_memory(
            conversation_id,
            staff_name=coordinator.name,
            turn=synthesis_turn_number,
            content=synth_reasoning,
            kind="result",
        )
        if graph_context_provider and conversation_id:
            graph_context_provider.ingest_message(
                conversation_id=conversation_id,
                message_id=f"staff_member-{coordinator.name}-{uuid4().hex}",
                speaker=coordinator.name,
                content=synth_reasoning,
                config=graph_config,
            )
        synthesis_turn = GraphTurn(
            turn=synthesis_turn_number,
            staff_name=coordinator.name,
            staff_role=coordinator.role,
            content=synth_reasoning,
        )

        discussion_ended = self._has_discussion_end_signal(synth_action)
        next_staff = self._extract_target_agent_from_message(
            synth_action, state["staff_names"], coordinator.name
        )
        next_input = ""
        if not discussion_ended and next_staff:
            questions = self._extract_questions_for_next_staff(synth_action)
            if not questions:
                questions = [
                    "Please continue with the highest-priority next analysis and include concrete evidence."
                ]
            next_input = self._format_question_payload(questions)

        stream_writer({
            "type": EventType.TURN_COMPLETE.value,
            "turn": synthesis_turn,
            "next_staff": next_staff,
            "discussion_ended": discussion_ended,
        })

        # Update conversation history with every turn produced this wave.
        new_history = {k: list(v) for k, v in state.get("conversation_history", {}).items()}
        new_history.setdefault(coordinator.name, []).append(coordinator_reasoning)
        for r in results:
            new_history.setdefault(r.staff_name, []).append(r.content)
        new_history.setdefault(coordinator.name, []).append(synth_reasoning)

        # staff_states already carries the coordinator's fan-out-decision turn
        # (appended by mesh_node before this call); add each branch's own
        # exchange and the coordinator's synthesis exchange.
        new_staff_states = staff_states
        for r in results:
            new_staff_states = append_user_turn(new_staff_states, r.staff_name, r.task)
            new_staff_states = append_assistant_turn(new_staff_states, r.staff_name, r.content)
        new_staff_states = append_user_turn(new_staff_states, coordinator.name, synthesis_user)
        new_staff_states = append_assistant_turn(new_staff_states, coordinator.name, synth_reasoning)

        return {
            "turns": [*turns, coordinator_turn, *branch_turns, synthesis_turn],
            "conversation_history": new_history,
            "staff_states": new_staff_states,
            "input": next_input,
            "current_agent": coordinator.name,
            "final_response": synth_reasoning,
            "last_action": synth_action,
            "final_staff": coordinator.name,
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

    def _extract_questions_for_next_staff(self, message: str) -> list[str]:
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
        """Convert questions to the compact numbered payload passed to the next staff_member."""
        lines = [f"{index}. {question}" for index, question in enumerate(questions, start=1)]
        return "\n".join(lines)

    def _get_next_staff_roundrobin(
        self,
        current_staff_name: str,
        staff_names: list[str],
        hub_staff_name: str,
    ) -> str:
        """
        Get next staff_member in round-robin fashion, biased towards hub.

        Args:
            current_staff_name: Current staff_member
            staff_names: All available staff
            hub_staff_name: Hub staff_member name

        Returns:
            Next staff_member name
        """
        current_idx = staff_names.index(current_staff_name)

        if current_staff_name != hub_staff_name:
            return hub_staff_name

        next_idx = (current_idx + 1) % len(staff_names)
        next_staff = staff_names[next_idx]

        if next_staff == hub_staff_name:
            next_idx = (next_idx + 1) % len(staff_names)
            next_staff = staff_names[next_idx]

        return next_staff
