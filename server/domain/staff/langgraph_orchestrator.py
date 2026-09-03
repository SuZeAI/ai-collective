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
    uploads_hint,
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


class MultiAgentState(TypedDict):
    input: str
    original_input: str
    turns: list[GraphTurn]
    staff_states: StaffStates
    final_response: str
    final_staff: str | None
    rounds: int


class LangGraphStaffOrchestrator(StaffGraphOrchestrator):
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

        selected_agents = staff[: max(1, max_rounds)]
        builder: StateGraph = StateGraph(MultiAgentState)
        for i, staff_member in enumerate(selected_agents):
            builder.add_node(
                staff_member.name,
                self._make_llm_node(
                    staff_member=staff_member,
                    llm=llm,
                    conversation_id=conversation_id,
                    graph_context_provider=graph_context_provider,
                    graph_config=graph_config,
                ),
            )
            if i < len(selected_agents) - 1:
                builder.add_edge(staff_member.name, selected_agents[i + 1].name)
            else:
                builder.add_edge(staff_member.name, END)

        builder.add_edge(START, selected_agents[0].name)
        graph = builder.compile()

        initial: MultiAgentState = {
            "input": user_input,
            "original_input": user_input,
            "turns": [],
            "staff_states": init_staff_states(selected_agents),
            "final_response": "",
            "final_staff": None,
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

        final_state, error = await run_to_final_state(graph, initial, len(selected_agents))
        turns = list(final_state.get("turns", []))
        final_response = final_state.get("final_response") or (turns[-1].content if turns else "")
        final_staff = final_state.get("final_staff")
        rounds = int(final_state.get("rounds", len(turns)))
        return GraphRunResult(
            turns=turns,
            final_response=final_response,
            final_staff=final_staff,
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

        selected_agents = staff[: max(1, max_rounds)]
        builder: StateGraph = StateGraph(MultiAgentState)
        for i, staff_member in enumerate(selected_agents):
            builder.add_node(
                staff_member.name,
                self._make_llm_node(
                    staff_member=staff_member,
                    llm=llm,
                    conversation_id=conversation_id,
                    graph_context_provider=graph_context_provider,
                    graph_config=graph_config,
                ),
            )
            if i < len(selected_agents) - 1:
                builder.add_edge(staff_member.name, selected_agents[i + 1].name)
            else:
                builder.add_edge(staff_member.name, END)

        builder.add_edge(START, selected_agents[0].name)
        graph = builder.compile()

        initial: MultiAgentState = {
            "input": user_input,
            "original_input": user_input,
            "turns": [],
            "staff_states": init_staff_states(selected_agents),
            "final_response": "",
            "final_staff": None,
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
        async for event in graph.astream(
            initial, config=recursion_config(len(selected_agents)), stream_mode="custom"
        ):
            # Custom events sent via get_stream_writer() from nodes
            if isinstance(event, dict):
                yield event

    def _make_llm_node(
        self,
        *,
        staff_member: GraphStaffDefinition,
        llm: LLMProvider,
        conversation_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
    ):
        async def node(state: MultiAgentState) -> MultiAgentState:
            stream_writer = get_stream_writer()

            # Human-in-the-loop: if the user interrupted the run, hold here
            # (before this staff_member starts) until they resume.
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

            # Stream: Staff starting
            stream_writer({
                "type": EventType.AGENT_START.value,
                "agent_name": staff_member.name,
                "staff_role": staff_member.role,
                "turn": state["rounds"] + 1,
                "sandbox_thread_id": sandbox_thread_id,
                "sandbox_workspace": sandbox_workspace,
            })

            bound_tools = build_agent_tools(staff_member, conversation_id=conversation_id)
            attach_subagent_toolkit(bound_tools, staff_member, llm=llm)

            # Stream: Building context
            stream_writer({
                "type": EventType.CONTEXT_BUILDING.value,
                "agent_name": staff_member.name,
            })

            # Human-in-the-loop: pick up any user messages posted mid-run so
            # this staff_member (and every one after it) sees the latest guidance.
            human_guidance = drain_human_guidance(
                conversation_id=conversation_id,
                stream_writer=stream_writer,
                graph_context_provider=graph_context_provider,
                graph_config=graph_config,
            )

            context_parts: list[str] = []
            if human_guidance:
                context_parts.append(human_guidance)

            uploads = uploads_hint(conversation_id)
            if uploads:
                context_parts.append(uploads)

            if graph_context_provider and conversation_id:
                pack = graph_context_provider.build_graph_context(
                    conversation_id=conversation_id,
                    query=state["input"],
                    config=graph_config,
                )
                if pack.text:
                    context_parts.append(pack.text)
                    # Stream: Context retrieved
                    stream_writer({
                        "type": EventType.CONTEXT_RETRIEVED.value,
                        "agent_name": staff_member.name,
                        "node_ids": pack.node_ids,
                        "edge_ids": pack.edge_ids,
                        "chunk_ids": pack.chunk_ids,
                    })

            # Shared working memory: in a pipeline only the previous staff_member's
            # output flows forward — the digest restores everything earlier.
            ensure_working_memory(conversation_id, state["original_input"])
            if human_guidance:
                record_guidance_in_memory(conversation_id, human_guidance)
            memory_block = working_memory_block(conversation_id)
            if memory_block:
                context_parts.append(memory_block)

            # staff_member.system_prompt stays byte-identical every turn (never mixed
            # with the context above) so the compiled-agent cache and upstream
            # provider prompt-caching see a stable prefix; only context_text is
            # budget-trimmed, state["input"] (the real turn input) is never truncated.
            turn, budget_result = build_turn_messages(
                llm=llm,
                system_prompt=staff_member.system_prompt,
                context_text="\n\n".join(context_parts),
                input_text=state["input"],
                max_context_tokens=MAX_CONTEXT_TOKENS,
                reserved_output_tokens=RESERVED_OUTPUT_TOKENS,
            )

            # Stream: LLM processing started
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

            # Stream: LLM response received
            stream_writer({
                "type": EventType.LLM_RESPONSE_COMPLETE.value,
                "agent_name": staff_member.name,
                "response_length": len(output),
            })

            next_turn = GraphTurn(
                turn=state["rounds"] + 1,
                staff_name=staff_member.name,
                staff_role=staff_member.role,
                content=output,
            )

            # Working memory: keep this stage's result available to all later
            # pipeline stages, not just the immediate next one.
            record_turn_in_memory(
                conversation_id,
                staff_name=staff_member.name,
                turn=state["rounds"] + 1,
                content=output,
                kind="result",
            )

            if graph_context_provider and conversation_id:
                graph_context_provider.ingest_message(
                    conversation_id=conversation_id,
                    message_id=f"staff_member-{staff_member.name}-{uuid4().hex}",
                    speaker=staff_member.name,
                    content=output,
                    config=graph_config,
                )
                # Stream: Message ingested
                stream_writer({
                    "type": EventType.MESSAGE_INGESTED.value,
                    "agent_name": staff_member.name,
                })

            # Stream: Turn completed
            stream_writer({
                "type": EventType.TURN_COMPLETE.value,
                "turn": next_turn,
            })

            new_staff_states = append_assistant_turn(
                append_user_turn(state.get("staff_states", {}), staff_member.name, turn.input_text),
                staff_member.name,
                output,
            )

            return {
                **state,
                "input": output,
                "turns": [*state["turns"], next_turn],
                "staff_states": new_staff_states,
                "final_response": output,
                "final_staff": staff_member.name,
                "rounds": state["rounds"] + 1,
            }

        return node
