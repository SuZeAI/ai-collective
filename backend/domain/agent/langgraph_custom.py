from __future__ import annotations

import operator
from typing import Annotated, TypedDict
from uuid import uuid4

from langgraph.graph import END, START, StateGraph

from backend.application.ports.agent_graph import (
    AgentGraphOrchestrator,
    CustomGraphSpec,
    GraphAgentDefinition,
    GraphContextProvider,
    GraphRunResult,
    GraphTurn,
)
from backend.application.ports.llm import LLMProvider
from backend.domain.memory.knowledge_graph import GraphContextConfig
from backend.domain.agent._graph_runtime import recursion_config, run_to_final_state
from backend.domain.agent.langgraph_orchestrator import LangGraphAgentOrchestrator


def _last(_old, new):
    """Last-write-wins reducer so parallel fan-out branches can update the same
    scalar channel in one superstep without raising InvalidUpdateError."""
    return new


class CustomState(TypedDict):
    input: Annotated[str, _last]
    original_input: str
    turns: Annotated[list[GraphTurn], operator.add]
    final_response: Annotated[str, _last]
    final_agent: Annotated[str | None, _last]
    rounds: Annotated[int, operator.add]


class LangGraphCustomOrchestrator(AgentGraphOrchestrator):
    """User-defined topology.

    The frontend draws a directed graph of agent nodes (mode == "custom"). Each
    node is one agent; edges define routing. Built on the same LLM node as the
    sequential pipeline, so every agent inherits streaming, working memory,
    ask_user, subagents and the token budget.

    Semantics:
      - A node with several outgoing edges fans out — successors run in parallel.
      - A node with several incoming edges merges — it reads every prior branch's
        output via the shared working-memory digest.
      - A cycle loops until total turns reach ``max_rounds`` (the per-node router
        routes to END once ``rounds >= max_rounds``).

    Known limitation: with conditional routing a diamond whose branches have
    unequal length can run the merge node more than once. The round guard bounds
    this and the working memory keeps results coherent.
    """

    def __init__(self) -> None:
        # Reuse the sequential node factory verbatim (no copy-paste).
        self._node_factory = LangGraphAgentOrchestrator()

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
        custom_graph: CustomGraphSpec | None = None,
    ) -> GraphRunResult:
        if not agents:
            raise ValueError("At least one agent definition is required")

        graph = self._build_graph(
            agents, llm, max_rounds, custom_graph,
            conversation_id, graph_context_provider, graph_config,
        )
        self._ingest_user_message(user_input, conversation_id, graph_context_provider, graph_config)

        final_state = await run_to_final_state(graph, self._initial_state(user_input), max_rounds)
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
        custom_graph: CustomGraphSpec | None = None,
    ):
        if not agents:
            raise ValueError("At least one agent definition is required")

        graph = self._build_graph(
            agents, llm, max_rounds, custom_graph,
            conversation_id, graph_context_provider, graph_config,
        )
        self._ingest_user_message(user_input, conversation_id, graph_context_provider, graph_config)

        async for event in graph.astream(
            self._initial_state(user_input),
            config=recursion_config(max_rounds),
            stream_mode="custom",
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
        custom_graph: CustomGraphSpec | None,
        conversation_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
    ):
        names = [a.name for a in agents]
        name_set = set(names)

        # Keep only edges whose endpoints are real agents, drop self-loops-to-self
        # duplicates while preserving order.
        edges: list[tuple[str, str]] = []
        if custom_graph and custom_graph.edges:
            seen: set[tuple[str, str]] = set()
            for src, dst in custom_graph.edges:
                if src in name_set and dst in name_set and (src, dst) not in seen:
                    seen.add((src, dst))
                    edges.append((src, dst))

        # No usable edges → fall back to a simple sequential chain so a custom
        # team that was never wired still runs sensibly.
        if not edges:
            edges = [(names[i], names[i + 1]) for i in range(len(names) - 1)]

        successors: dict[str, list[str]] = {n: [] for n in names}
        has_incoming: set[str] = set()
        for src, dst in edges:
            if dst not in successors[src]:
                successors[src].append(dst)
            has_incoming.add(dst)

        # Entry points: explicit, else roots (no incoming), else the first node.
        entry = [n for n in (custom_graph.entry if custom_graph else ()) if n in name_set]
        if not entry:
            entry = [n for n in names if n not in has_incoming]
        if not entry:
            entry = [names[0]]

        builder: StateGraph = StateGraph(CustomState)
        for agent in agents:
            inner = self._node_factory._make_llm_node(
                agent=agent,
                llm=llm,
                conversation_id=conversation_id,
                graph_context_provider=graph_context_provider,
                graph_config=graph_config,
            )
            builder.add_node(agent.name, self._make_delta_node(inner))

        path_map = {n: n for n in names}
        path_map[END] = END
        for name in names:

            def _make_router(_node: str):
                def router(state: CustomState):
                    if state["rounds"] >= max_rounds:
                        return END
                    nxt = successors.get(_node, [])
                    return nxt if nxt else END
                return router

            builder.add_conditional_edges(name, _make_router(name), path_map)

        for e in entry:
            builder.add_edge(START, e)

        return builder.compile()

    @staticmethod
    def _make_delta_node(inner):
        """Wrap the sequential node (which returns absolute state) so it emits a
        reducer-friendly delta: only the turn(s) it added and a +1 round."""
        async def node(state: CustomState) -> dict:
            result = await inner(state)
            all_turns = result.get("turns", [])
            added = all_turns[len(state.get("turns", [])):]
            return {
                "input": result.get("input", state["input"]),
                "turns": list(added),
                "final_response": result.get("final_response", "") or "",
                "final_agent": result.get("final_agent"),
                "rounds": 1,
            }
        return node

    @staticmethod
    def _initial_state(user_input: str) -> CustomState:
        return {
            "input": user_input,
            "original_input": user_input,
            "turns": [],
            "final_response": "",
            "final_agent": None,
            "rounds": 0,
        }

    @staticmethod
    def _ingest_user_message(
        user_input: str,
        conversation_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
    ) -> None:
        if graph_context_provider and conversation_id:
            graph_context_provider.ingest_message(
                conversation_id=conversation_id,
                message_id=f"user-{uuid4().hex}",
                speaker="user",
                content=user_input,
                config=graph_config,
            )
