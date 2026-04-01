from __future__ import annotations

from typing import TypedDict
from uuid import uuid4

from langgraph.graph import END, START, StateGraph

from backend.application.ports.agent_graph import (
    AgentGraphOrchestrator,
    GraphAgentDefinition,
    GraphContextProvider,
    GraphRunResult,
    GraphTurn,
)
from backend.application.ports.llm import LLMProvider
from backend.domain.memory.knowledge_graph import GraphContextConfig


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
        """Streaming version that yields GraphTurn events as agents process"""
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

        # Stream events from the graph
        async for event in graph.astream(initial):
            # event is a dict like {node_name: state_update}
            state_update = next(iter(event.values())) if event else {}
            
            # Yield new turns as they're added
            if "turns" in state_update:
                new_turns = state_update["turns"]
                # Only yield the last turn (the one that was just added)
                if new_turns:
                    yield new_turns[-1]

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
            bound_tools = []
            if agent.tools:
                for toolkit in agent.tools.values():
                    bound_tools.extend(toolkit.get_tools())

            user_input = state["input"]
            if graph_context_provider and conversation_id:
                pack = graph_context_provider.build_graph_context(
                    conversation_id=conversation_id,
                    query=state["input"],
                    config=graph_config,
                )
                if pack.text:
                    user_input = f"{pack.text}\n\nIncoming request:\n{state['input']}"

            output = await llm.chat(
                system=agent.system_prompt,
                user=user_input,
                tools=bound_tools or None,
            )

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

            return {
                **state,
                "input": output,
                "turns": [*state["turns"], next_turn],
                "final_response": output,
                "final_agent": agent.name,
                "rounds": state["rounds"] + 1,
            }

        return node
