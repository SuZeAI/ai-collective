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
from backend.domain.agent._graph_runtime import (
    drain_human_guidance,
    recursion_config,
    run_to_final_state,
    safe_chat,
    wait_while_paused,
)


MAX_CONTEXT_TOKENS = max(1024, int(os.getenv("AGENT_CONTEXT_TOKEN_LIMIT", "12000")))
RESERVED_OUTPUT_TOKENS = max(256, int(os.getenv("AGENT_OUTPUT_TOKEN_RESERVE", "2000")))

# Max recent history entries kept in ring state to limit token growth
_RING_HISTORY_WINDOW = 8


class MultiAgentRingState(TypedDict):
    """State for ring topology: agents execute in circular order until max_rounds is reached."""
    input: str
    original_input: str
    turns: list[GraphTurn]
    conversation_history: list[str]
    rounds: int
    final_response: str
    final_agent: str | None


class LangGraphRingOrchestrator(AgentGraphOrchestrator):
    """
    Ring topology orchestrator.

    Agents execute in circular order:
        Agent 0 → Agent 1 → ... → Agent N → Agent 0 → ...

    The loop continues until `max_rounds` total agent turns are completed.
    Every agent sees the accumulated conversation history of the ring so far.
    """

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

        if graph_context_provider and conversation_id:
            graph_context_provider.ingest_message(
                conversation_id=conversation_id,
                message_id=f"user-{uuid4().hex}",
                speaker="user",
                content=user_input,
                config=graph_config,
            )

        graph = self._build_graph(
            agents=agents,
            llm=llm,
            max_rounds=max_rounds,
            conversation_id=conversation_id,
            graph_context_provider=graph_context_provider,
            graph_config=graph_config,
        )
        initial = self._make_initial_state(user_input)
        final_state = await run_to_final_state(graph, initial, max_rounds)

        turns = list(final_state.get("turns", []))
        return GraphRunResult(
            turns=turns,
            final_response=final_state.get("final_response") or (turns[-1].content if turns else ""),
            final_agent=final_state.get("final_agent"),
            rounds=int(final_state.get("rounds", len(turns))),
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

        if graph_context_provider and conversation_id:
            graph_context_provider.ingest_message(
                conversation_id=conversation_id,
                message_id=f"user-{uuid4().hex}",
                speaker="user",
                content=user_input,
                config=graph_config,
            )

        graph = self._build_graph(
            agents=agents,
            llm=llm,
            max_rounds=max_rounds,
            conversation_id=conversation_id,
            graph_context_provider=graph_context_provider,
            graph_config=graph_config,
        )
        initial = self._make_initial_state(user_input)

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
        agents: list[GraphAgentDefinition],
        llm: LLMProvider,
        max_rounds: int,
        conversation_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
    ):
        n = len(agents)
        builder: StateGraph = StateGraph(MultiAgentRingState)

        for i, agent in enumerate(agents):
            next_agent_name = agents[(i + 1) % n].name

            builder.add_node(
                agent.name,
                self._make_ring_node(
                    agent=agent,
                    agent_index=i,
                    agents=agents,
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

            routing_map: dict[str, str] = {"end": END, next_agent_name: next_agent_name}
            builder.add_conditional_edges(agent.name, _make_router(next_agent_name), routing_map)

        builder.add_edge(START, agents[0].name)
        return builder.compile()

    @staticmethod
    def _make_initial_state(user_input: str) -> MultiAgentRingState:
        return {
            "input": user_input,
            "original_input": user_input,
            "turns": [],
            "conversation_history": [],
            "rounds": 0,
            "final_response": "",
            "final_agent": None,
        }

    # ------------------------------------------------------------------ #
    # Node factory                                                         #
    # ------------------------------------------------------------------ #

    def _make_ring_node(
        self,
        *,
        agent: GraphAgentDefinition,
        agent_index: int,
        agents: list[GraphAgentDefinition],
        llm: LLMProvider,
        max_rounds: int,
        conversation_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
    ):
        n = len(agents)

        async def ring_node(state: MultiAgentRingState) -> dict:
            stream_writer = get_stream_writer()

            # Human-in-the-loop: hold at the turn boundary while interrupted.
            await wait_while_paused(
                conversation_id=conversation_id,
                stream_writer=stream_writer,
                agent_name=agent.name,
            )

            current_round = state["rounds"]
            pass_number = current_round // n + 1
            prev_agent_name = agents[(agent_index - 1) % n].name if current_round > 0 else "user"
            next_agent_name = agents[(agent_index + 1) % n].name

            stream_writer({
                "type": EventType.AGENT_START.value,
                "agent_name": agent.name,
                "agent_role": agent.role,
                "turn": current_round + 1,
                "ring_position": agent_index + 1,
                "ring_size": n,
                "pass_number": pass_number,
            })

            stream_writer({"type": EventType.CONTEXT_BUILDING.value, "agent_name": agent.name})

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
                        "agent_name": agent.name,
                        "node_ids": pack.node_ids,
                        "edge_ids": pack.edge_ids,
                        "chunk_ids": pack.chunk_ids,
                    })

            recent_history = state.get("conversation_history", [])[-_RING_HISTORY_WINDOW:]
            history_text = "\n".join(recent_history) if recent_history else "(none)"

            context_parts: list[str] = []
            # First so the guidance survives tail-truncation by the token budget.
            if human_guidance:
                context_parts += [human_guidance, ""]
            context_parts += [
                f"user input: {state['original_input']}",
                f"ring topology | pass {pass_number} | position {agent_index + 1}/{n}",
                f"previous speaker: {prev_agent_name}",
                f"next speaker in ring: {next_agent_name}",
                f"remaining turns after yours: {max(0, max_rounds - current_round - 1)}",
                "",
                "conversation so far:",
                history_text,
            ]
            if graph_context_text:
                context_parts += ["", "context:", graph_context_text]

            # Pass the latest message (previous agent output) when not the first turn
            if current_round > 0 and state.get("input") and state["input"] != state["original_input"]:
                context_parts += ["", "latest message from previous agent:", state["input"]]

            user_input = "\n".join(context_parts)

            budget_result = apply_context_token_budget(
                llm=llm,
                system_prompt=agent.system_prompt,
                user_input=user_input,
                max_context_tokens=MAX_CONTEXT_TOKENS,
                reserved_output_tokens=RESERVED_OUTPUT_TOKENS,
            )
            user_input = budget_result.text

            bound_tools: list = []
            if agent.tools:
                for toolkit in agent.tools.values():
                    bound_tools.extend(toolkit.get_tools())

            # Default human-in-the-loop tool: every agent can interrupt and ask
            # the user a question mid-run.
            if conversation_id:
                from backend.domain.tools.ask_user import AskUserToolkit

                bound_tools.extend(
                    AskUserToolkit(
                        conversation_id=conversation_id,
                        agent_name=agent.name,
                    ).get_tools()
                )

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

            output = await safe_chat(llm,
                system=agent.system_prompt,
                user=user_input,
                tools=bound_tools or None,
            )

            stream_writer({
                "type": EventType.LLM_RESPONSE_COMPLETE.value,
                "agent_name": agent.name,
                "response_length": len(output),
            })

            new_turn = GraphTurn(
                turn=current_round + 1,
                agent_name=agent.name,
                agent_role=agent.role,
                content=output,
            )

            new_history = [*state.get("conversation_history", [])]
            # Keep mid-run human guidance visible to later ring turns (the
            # interject queue is drained once, so persist it in history).
            if human_guidance:
                new_history.append(human_guidance)
            new_history.append(f"{agent.name}: {output}")

            if graph_context_provider and conversation_id:
                graph_context_provider.ingest_message(
                    conversation_id=conversation_id,
                    message_id=f"agent-{agent.name}-{uuid4().hex}",
                    speaker=agent.name,
                    content=output,
                    config=graph_config,
                )
                stream_writer({"type": EventType.MESSAGE_INGESTED.value, "agent_name": agent.name})

            stream_writer({"type": EventType.TURN_COMPLETE.value, "turn": new_turn})

            return {
                **state,
                "input": output,
                "turns": [*state["turns"], new_turn],
                "conversation_history": new_history,
                "final_response": output,
                "final_agent": agent.name,
                "rounds": current_round + 1,
            }

        return ring_node
