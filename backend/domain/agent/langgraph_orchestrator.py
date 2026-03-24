from __future__ import annotations

from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from backend.application.ports.agent_graph import (
    AgentGraphOrchestrator,
    GraphAgentDefinition,
    GraphRunResult,
    GraphTurn,
)
from backend.application.ports.llm import LLMProvider


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
    ) -> GraphRunResult:
        if not agents:
            raise ValueError("At least one agent definition is required")

        selected_agents = agents[: max(1, max_rounds)]
        builder: StateGraph = StateGraph(MultiAgentState)
        for i, agent in enumerate(selected_agents):
            builder.add_node(agent.name, self._make_llm_node(agent=agent, llm=llm))
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
    ):
        """Streaming version that yields GraphTurn events as agents process"""
        if not agents:
            raise ValueError("At least one agent definition is required")

        selected_agents = agents[: max(1, max_rounds)]
        builder: StateGraph = StateGraph(MultiAgentState)
        for i, agent in enumerate(selected_agents):
            builder.add_node(agent.name, self._make_llm_node(agent=agent, llm=llm))
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

    def _make_llm_node(self, *, agent: GraphAgentDefinition, llm: LLMProvider):
        async def node(state: MultiAgentState) -> MultiAgentState:
            bound_tools = []
            if agent.tools:
                for toolkit in agent.tools.values():
                    bound_tools.extend(toolkit.get_tools())

            output = await llm.chat(
                system=agent.system_prompt,
                user=state["input"],
                tools=bound_tools or None,
            )

            next_turn = GraphTurn(
                turn=state["rounds"] + 1,
                agent_name=agent.name,
                agent_role=agent.role,
                content=output,
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
