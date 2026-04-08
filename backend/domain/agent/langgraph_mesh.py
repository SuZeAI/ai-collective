from __future__ import annotations

import os
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
from backend.log import get_logger


MAX_CONTEXT_TOKENS = max(1024, int(os.getenv("AGENT_CONTEXT_TOKEN_LIMIT", "12000")))
RESERVED_OUTPUT_TOKENS = max(256, int(os.getenv("AGENT_OUTPUT_TOKEN_RESERVE", "2000")))


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
        r"<\s*(ASK_NEXT_AGENT|NEXT_AGENT|DISCUSSION_END)\s*>.*?<\s*/\s*\1\s*>",
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
        conversation_id: str | None = None,
        graph_context_provider: GraphContextProvider | None = None,
        graph_config: GraphContextConfig | None = None,
    ):
        """Streaming version using get_stream_writer for real-time custom events"""
        if not agents:
            raise ValueError("At least one agent definition is required")

        if len(agents) == 1:
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
        async for event in graph.astream(initial, stream_mode="custom"):
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
        node = self._make_mesh_llm_node(
            agent=agent,
            llm=llm,
            max_rounds=max_rounds,
            all_agents=[agent],
            hub_agent_name=agent.name,
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
        max_rounds: int,
        conversation_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
    ):
        """Streaming fallback when only one agent is provided."""
        result = await self._run_single_agent(
            user_input=user_input,
            agent=agent,
            llm=llm,
            max_rounds=max_rounds,
            conversation_id=conversation_id,
            graph_context_provider=graph_context_provider,
            graph_config=graph_config,
        )
        if result.turns:
            yield result.turns[-1]

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
            )

        async def mesh_node(state: MultiAgentMeshState) -> dict:
            stream_writer = get_stream_writer()

            # Stream: Agent turn starting
            stream_writer({
                "type": EventType.AGENT_TURN_START.value,
                "agent_name": agent.name,
                "agent_role": agent.role,
                "turn": len(state.get("turns", [])) + 1,
                "round": state.get("rounds", 0) + 1,
            })

            conversation_history = state.get("conversation_history", {})
            context_parts: list[str] = []

            # Stream: Building context
            stream_writer({
                "type": EventType.CONTEXT_BUILDING.value,
                "agent_name": agent.name,
            })

            all_recent_messages = []
            for other_agent_name in state["agent_names"]:
                if other_agent_name != agent.name and conversation_history.get(other_agent_name):
                    for msg in conversation_history[other_agent_name][-3:]:
                        all_recent_messages.append(f"{other_agent_name}: {msg}")

            if conversation_history.get(agent.name):
                for msg in conversation_history[agent.name][-2:]:
                    all_recent_messages.append(f"{agent.name}: {msg}")

            history_text = "\n".join(all_recent_messages[-5:]).strip() or "(empty)"

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
            get_logger().info(f"Agent '{agent.name}' received context:\n{user_input}")

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

            bound_tools = []
            if agent.tools:
                for toolkit in agent.tools.values():
                    bound_tools.extend(toolkit.get_tools())

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

            response = await llm.chat(
                system=system_prompt_with_routing,
                user=user_input,
                tools=bound_tools or None,
            )

            # Stream: LLM response received
            stream_writer({
                "type": EventType.LLM_RESPONSE_COMPLETE.value,
                "agent_name": agent.name,
                "response_length": len(response),
            })

            reasoning, action_payload = self._split_reasoning_and_action(response)

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

            new_history = conversation_history.copy()
            if agent.name not in new_history:
                new_history[agent.name] = []
            new_history[agent.name].append(reasoning)

            discussion_ended = self._has_discussion_end_signal(action_payload)
            next_agent = self._extract_target_agent_from_message(
                action_payload,
                state["agent_names"],
                agent.name,
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
            return "end"
        
        if len(turns) == 0:
            hub_agent = state["hub_agent"]
            if current_agent_name == hub_agent:
                return all_agent_names[1] if len(all_agent_names) > 1 else "end"
            return hub_agent
        
        last_turn = turns[-1]
        last_content = state.get("last_action", "") or last_turn.content
        
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

