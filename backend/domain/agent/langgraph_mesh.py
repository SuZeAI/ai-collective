from __future__ import annotations

import re
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from backend.domain.prompt.routing_prompt import get_routing_guidance
from backend.application.ports.agent_graph import (
    AgentGraphOrchestrator,
    GraphAgentDefinition,
    GraphRunResult,
    GraphTurn,
)
from backend.application.ports.llm import LLMProvider
from backend.log import get_logger


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

    async def run(
        self,
        *,
        user_input: str,
        agents: list[GraphAgentDefinition],
        llm: LLMProvider,
        max_rounds: int,
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

        if len(agents) == 1:
            return await self._run_single_agent(
                user_input=user_input,
                agent=agents[0],
                llm=llm,
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
                    all_agents=agents,
                    hub_agent_name=hub_agent.name,
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
            "rounds": 0,
        }
        
        final_state = await graph.ainvoke(initial)
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

    async def run_stream(
        self,
        *,
        user_input: str,
        agents: list[GraphAgentDefinition],
        llm: LLMProvider,
        max_rounds: int,
    ):
        """Streaming version for real-time multi-agent conversation"""
        if not agents:
            raise ValueError("At least one agent definition is required")

        if len(agents) == 1:
            async for turn in self._run_single_agent_stream(
                user_input=user_input,
                agent=agents[0],
                llm=llm,
            ):
                yield turn
            return

        builder: StateGraph = StateGraph(MultiAgentMeshState)
        
        hub_agent = agents[0]
        all_agent_names = [a.name for a in agents]
        
        for agent in agents:
            builder.add_node(
                agent.name,
                self._make_mesh_llm_node(
                    agent=agent,
                    llm=llm,
                    all_agents=agents,
                    hub_agent_name=hub_agent.name,
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
            "rounds": 0,
        }
        
        async for event in graph.astream(initial):
            for node_name, node_state in event.items():
                if "turns" in node_state:
                    new_turns = node_state.get("turns", [])
                    if new_turns:
                        yield new_turns[-1]

    async def _run_single_agent(
        self,
        *,
        user_input: str,
        agent: GraphAgentDefinition,
        llm: LLMProvider,
    ) -> GraphRunResult:
        """Fallback execution path when only one agent is provided."""
        node = self._make_mesh_llm_node(
            agent=agent,
            llm=llm,
            all_agents=[agent],
            hub_agent_name=agent.name,
        )
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
            "rounds": 0,
        }
        final_state = await node(initial)
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
    ):
        """Streaming fallback when only one agent is provided."""
        result = await self._run_single_agent(
            user_input=user_input,
            agent=agent,
            llm=llm,
        )
        if result.turns:
            yield result.turns[-1]

    def _make_mesh_llm_node(
        self,
        agent: GraphAgentDefinition,
        llm: LLMProvider,
        all_agents: list[GraphAgentDefinition] = None,
        hub_agent_name: str = None,
    ):
        """
        Create an LLM node function for multi-agent mesh communication.
        
        Args:
            agent: The agent for this node
            llm: LLM provider
            all_agents: List of all agents (for routing guidance)
            hub_agent_name: Name of hub agent (for routing guidance)
            
        Returns:
            Async function that processes the agent's turn
        """
        
        routing_guidance = agent.routing_guidance
        if not routing_guidance and all_agents and hub_agent_name:
            other_agents = [a for a in all_agents if a.name != agent.name]
            routing_guidance = get_routing_guidance(
                agent.name, hub_agent_name, [a.name for a in other_agents]
            )

        async def mesh_node(state: MultiAgentMeshState) -> dict:
            conversation_history = state.get("conversation_history", {})
            context_parts = [state["original_input"]]
            
            all_recent_messages = []
            for other_agent_name in state["agent_names"]:
                if other_agent_name != agent.name:
                    if conversation_history.get(other_agent_name):
                        for msg in conversation_history[other_agent_name][-3:]:
                            all_recent_messages.append(f"{other_agent_name}: {msg}")
            
            if conversation_history.get(agent.name):
                for msg in conversation_history[agent.name][-2:]:
                    all_recent_messages.append(f"{agent.name}: {msg}")
            
            context_parts.extend(all_recent_messages[-5:])
            user_input = "\n".join(context_parts)
            get_logger().info(f"Agent '{agent.name}' received context:\n{user_input}")
            system_prompt_with_routing = agent.system_prompt
            if routing_guidance:
                system_prompt_with_routing = f"{agent.system_prompt}\n\n{routing_guidance}"

            bound_tools = []
            if agent.tools:
                for toolkit in agent.tools.values():
                    bound_tools.extend(toolkit.get_tools())
            
            response = await llm.chat(
                system=system_prompt_with_routing,
                user=user_input,
                tools=bound_tools or None,
            )
            
            turns = state["turns"]
            new_turn = GraphTurn(
                turn=len(turns) + 1,
                agent_name=agent.name,
                agent_role=agent.role,
                content=response,
            )
            
            new_history = conversation_history.copy()
            if agent.name not in new_history:
                new_history[agent.name] = []
            new_history[agent.name].append(response)
            
            return {
                "turns": [*turns, new_turn],
                "conversation_history": new_history,
                "input": response,
                "current_agent": agent.name,
                "final_response": response,
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
            return "end"
        
        if len(turns) == 0:
            hub_agent = state["hub_agent"]
            if current_agent_name == hub_agent:
                return all_agent_names[1] if len(all_agent_names) > 1 else "end"
            return hub_agent
        
        last_turn = turns[-1]
        last_content = last_turn.content
        
        if self._has_discussion_end_signal(last_content):
            return "end"
        
        next_agent = self._extract_target_agent_from_message(
            last_content, all_agent_names, current_agent_name
        )
        if next_agent:
            return next_agent
        
        return self._get_next_agent_roundrobin(
            current_agent_name, all_agent_names, state["hub_agent"]
        )

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
            return None

        candidate = match.group(1).strip().strip("`\"'")
        if candidate.startswith("<") and candidate.endswith(">"):
            candidate = candidate[1:-1].strip()

        if not candidate:
            return None

        normalized = {name.lower(): name for name in agent_names}
        target = normalized.get(candidate.lower())
        if not target:
            return None

        if target.lower() == current_agent_name.lower():
            return None

        return target

    def _has_discussion_end_signal(self, message: str) -> bool:
        """Return True when explicit `<DISCUSSION_END>...</DISCUSSION_END>` tag is present."""
        return bool(self._DISCUSSION_END_RE.search(message))

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

