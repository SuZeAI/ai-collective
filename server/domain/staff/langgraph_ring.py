from __future__ import annotations

from typing import TypedDict
from uuid import uuid4

from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

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
    attach_subagent_toolkit,
    build_agent_tools,
    build_turn_messages,
    drain_human_guidance,
    ensure_working_memory,
    record_guidance_in_memory,
    record_turn_in_memory,
    recursion_config,
    raise_if_llm_failed,
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

MAX_CONTEXT_TOKENS = max(1024, settings.staff.context_token_limit)
RESERVED_OUTPUT_TOKENS = max(256, settings.staff.output_token_reserve)

# Max recent history entries kept in ring state to limit token growth
_RING_HISTORY_WINDOW = 8


class MultiAgentRingState(TypedDict):
    """State for ring topology: staff execute in circular order until max_rounds is reached."""
    input: str
    original_input: str
    turns: list[GraphTurn]
    conversation_history: list[str]
    staff_states: StaffStates
    rounds: int
    final_response: str
    final_staff: str | None


class LangGraphRingOrchestrator(StaffGraphOrchestrator):
    """
    Ring topology orchestrator.

    Agents execute in circular order:
        Staff 0 → Staff 1 → ... → Staff N → Staff 0 → ...

    The loop continues until `max_rounds` total staff_member turns are completed.
    Every staff_member sees the accumulated conversation history of the ring so far.
    """

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
        if not staff:
            raise ValueError("At least one staff_member definition is required")

        if graph_context_provider and conversation_id:
            graph_context_provider.ingest_message(
                conversation_id=conversation_id,
                message_id=f"user-{uuid4().hex}",
                speaker="user",
                content=user_input,
                config=graph_config,
            )

        graph = self._build_graph(
            staff=staff,
            llm=llm,
            max_rounds=max_rounds,
            conversation_id=conversation_id,
            graph_context_provider=graph_context_provider,
            graph_config=graph_config,
        )
        initial = self._make_initial_state(user_input, staff)
        final_state, error = await run_to_final_state(graph, initial, max_rounds)

        turns = list(final_state.get("turns", []))
        return GraphRunResult(
            turns=turns,
            final_response=final_state.get("final_response") or (turns[-1].content if turns else ""),
            final_staff=final_state.get("final_staff"),
            rounds=int(final_state.get("rounds", len(turns))),
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
        if not staff:
            raise ValueError("At least one staff_member definition is required")

        if graph_context_provider and conversation_id:
            graph_context_provider.ingest_message(
                conversation_id=conversation_id,
                message_id=f"user-{uuid4().hex}",
                speaker="user",
                content=user_input,
                config=graph_config,
            )

        graph = self._build_graph(
            staff=staff,
            llm=llm,
            max_rounds=max_rounds,
            conversation_id=conversation_id,
            graph_context_provider=graph_context_provider,
            graph_config=graph_config,
        )
        initial = self._make_initial_state(user_input, staff)

        async for event in graph.astream(
            initial, config=recursion_config(max_rounds), stream_mode="custom"
        ):
            if isinstance(event, dict):
                yield event

    # ------------------------------------------------------------------ #
    # Graph construction                                                   #
    # ------------------------------------------------------------------ #

    def _build_graph(
        self,
        staff: list[GraphStaffDefinition],
        llm: LLMProvider,
        max_rounds: int,
        conversation_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
    ):
        n = len(staff)
        builder: StateGraph = StateGraph(MultiAgentRingState)

        for i, staff_member in enumerate(staff):
            next_staff_name = staff[(i + 1) % n].name

            builder.add_node(
                staff_member.name,
                self._make_ring_node(
                    staff_member=staff_member,
                    staff_index=i,
                    staff=staff,
                    llm=llm,
                    max_rounds=max_rounds,
                    conversation_id=conversation_id,
                    graph_context_provider=graph_context_provider,
                    graph_config=graph_config,
                ),
            )

            # Capture loop variables for the closure
            def _make_router(next_name: str, _max_rounds: int = max_rounds):
                def router(state: MultiAgentRingState) -> str:
                    return "end" if state["rounds"] >= _max_rounds else next_name
                return router

            routing_map: dict[str, str] = {"end": END, next_staff_name: next_staff_name}
            builder.add_conditional_edges(staff_member.name, _make_router(next_staff_name), routing_map)

        builder.add_edge(START, staff[0].name)
        return builder.compile()

    @staticmethod
    def _make_initial_state(user_input: str, staff: list[GraphStaffDefinition]) -> MultiAgentRingState:
        return {
            "input": user_input,
            "original_input": user_input,
            "turns": [],
            "conversation_history": [],
            "staff_states": init_staff_states(staff),
            "rounds": 0,
            "final_response": "",
            "final_staff": None,
        }

    # ------------------------------------------------------------------ #
    # Node factory                                                         #
    # ------------------------------------------------------------------ #

    def _make_ring_node(
        self,
        *,
        staff_member: GraphStaffDefinition,
        staff_index: int,
        staff: list[GraphStaffDefinition],
        llm: LLMProvider,
        max_rounds: int,
        conversation_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
    ):
        n = len(staff)

        async def ring_node(state: MultiAgentRingState) -> dict:
            stream_writer = get_stream_writer()

            # Human-in-the-loop: hold at the turn boundary while interrupted.
            await wait_while_paused(
                conversation_id=conversation_id,
                stream_writer=stream_writer,
                staff_name=staff_member.name,
            )

            current_round = state["rounds"]
            pass_number = current_round // n + 1
            prev_staff_name = staff[(staff_index - 1) % n].name if current_round > 0 else "user"
            next_staff_name = staff[(staff_index + 1) % n].name

            stream_writer({
                "type": EventType.AGENT_START.value,
                "agent_name": staff_member.name,
                "staff_role": staff_member.role,
                "turn": current_round + 1,
                "ring_position": staff_index + 1,
                "ring_size": n,
                "pass_number": pass_number,
            })

            stream_writer({"type": EventType.CONTEXT_BUILDING.value, "agent_name": staff_member.name})

            # Human-in-the-loop: surface user messages posted mid-run to this
            # turn and to the shared ring history for later turns.
            human_guidance = drain_human_guidance(
                conversation_id=conversation_id,
                stream_writer=stream_writer,
                graph_context_provider=graph_context_provider,
                graph_config=graph_config,
            )

            graph_context_text = ""
            if graph_context_provider and conversation_id:
                pack = graph_context_provider.build_graph_context(
                    conversation_id=conversation_id,
                    query=state["original_input"],
                    config=graph_config,
                )
                graph_context_text = pack.text
                if pack.text:
                    stream_writer({
                        "type": EventType.CONTEXT_RETRIEVED.value,
                        "agent_name": staff_member.name,
                        "node_ids": pack.node_ids,
                        "edge_ids": pack.edge_ids,
                        "chunk_ids": pack.chunk_ids,
                    })

            recent_history = state.get("conversation_history", [])[-_RING_HISTORY_WINDOW:]
            history_text = "\n".join(recent_history) if recent_history else "(none)"

            # Shared working memory: pin guidance, then inject the digest so
            # prior passes survive the rolling history window and truncation.
            ensure_working_memory(conversation_id, state["original_input"])
            if human_guidance:
                record_guidance_in_memory(conversation_id, human_guidance)
            memory_block = working_memory_block(conversation_id)

            # Pass the latest message (previous staff_member output) when not the
            # first turn; this is the actual turn input, never truncated below.
            if current_round > 0 and state.get("input") and state["input"] != state["original_input"]:
                input_text = state["input"]
            else:
                input_text = state["original_input"]

            context_parts: list[str] = []
            if human_guidance:
                context_parts += [human_guidance, ""]
            if memory_block:
                context_parts += [memory_block, ""]
            context_parts += [
                f"user input: {state['original_input']}",
                f"ring topology | pass {pass_number} | position {staff_index + 1}/{n}",
                f"previous speaker: {prev_staff_name}",
                f"next speaker in ring: {next_staff_name}",
                f"remaining turns after yours: {max(0, max_rounds - current_round - 1)}",
                "",
                "conversation so far:",
                history_text,
            ]
            if graph_context_text:
                context_parts += ["", "context:", graph_context_text]

            bound_tools = build_agent_tools(staff_member, conversation_id=conversation_id)
            attach_subagent_toolkit(bound_tools, staff_member, llm=llm)

            # staff_member.system_prompt stays byte-identical every turn so the
            # compiled-agent cache and upstream provider prompt-caching see a
            # stable prefix; only context_parts is budget-trimmed.
            turn, budget_result = build_turn_messages(
                llm=llm,
                system_prompt=staff_member.system_prompt,
                context_text="\n".join(context_parts),
                input_text=input_text,
                max_context_tokens=MAX_CONTEXT_TOKENS,
                reserved_output_tokens=RESERVED_OUTPUT_TOKENS,
            )

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
            })

            own_history = llm_ready_messages(state.get("staff_states", {}), staff_member.name)
            output = await safe_chat(llm,
                staff_name=staff_member.name,
                system=staff_member.system_prompt,
                messages=[*own_history, *turn.as_messages()],
                tools=bound_tools or None,
                parallel_tools=staff_member.subagent_enabled,
            )
            raise_if_llm_failed(output)

            stream_writer({
                "type": EventType.LLM_RESPONSE_COMPLETE.value,
                "agent_name": staff_member.name,
                "response_length": len(output),
            })

            new_turn = GraphTurn(
                turn=current_round + 1,
                staff_name=staff_member.name,
                staff_role=staff_member.role,
                content=output,
            )

            # Working memory: full-fidelity note outlives the ring history
            # window above.
            record_turn_in_memory(
                conversation_id,
                staff_name=staff_member.name,
                turn=current_round + 1,
                content=output,
                kind="result",
            )

            new_history = [*state.get("conversation_history", [])]
            # Keep mid-run human guidance visible to later ring turns (the
            # interject queue is drained once, so persist it in history).
            if human_guidance:
                new_history.append(human_guidance)
            new_history.append(f"{staff_member.name}: {output}")

            if graph_context_provider and conversation_id:
                graph_context_provider.ingest_message(
                    conversation_id=conversation_id,
                    message_id=f"staff_member-{staff_member.name}-{uuid4().hex}",
                    speaker=staff_member.name,
                    content=output,
                    config=graph_config,
                )
                stream_writer({"type": EventType.MESSAGE_INGESTED.value, "agent_name": staff_member.name})

            stream_writer({"type": EventType.TURN_COMPLETE.value, "turn": new_turn})

            new_staff_states = append_assistant_turn(
                append_user_turn(state.get("staff_states", {}), staff_member.name, input_text),
                staff_member.name,
                output,
            )

            return {
                **state,
                "input": output,
                "turns": [*state["turns"], new_turn],
                "conversation_history": new_history,
                "staff_states": new_staff_states,
                "final_response": output,
                "final_staff": staff_member.name,
                "rounds": current_round + 1,
            }

        return ring_node
