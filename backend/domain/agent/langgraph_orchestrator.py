from __future__ import annotations

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
    attach_conversation_sandbox,
    drain_human_guidance,
    ensure_working_memory,
    memory_toolkit_tools,
    uploads_hint,
    record_guidance_in_memory,
    record_turn_in_memory,
    recursion_config,
    run_to_final_state,
    safe_chat,
    wait_while_paused,
    working_memory_block,
)


from backend.api.settings import settings

MAX_CONTEXT_TOKENS = max(1024, settings.agent.context_token_limit)
RESERVED_OUTPUT_TOKENS = max(256, settings.agent.output_token_reserve)
SUBAGENT_MAX_CONCURRENT = max(1, settings.agent.subagent_max_concurrent)


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
        custom_graph=None,  # accepted for protocol parity; ignored by this mode
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

        final_state, error = await run_to_final_state(graph, initial, len(selected_agents))
        turns = list(final_state.get("turns", []))
        final_response = final_state.get("final_response") or (turns[-1].content if turns else "")
        final_agent = final_state.get("final_agent")
        rounds = int(final_state.get("rounds", len(turns)))
        return GraphRunResult(
            turns=turns,
            final_response=final_response,
            final_agent=final_agent,
            rounds=rounds,
            error=error,
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
        agent: GraphAgentDefinition,
        llm: LLMProvider,
        conversation_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
    ):
        async def node(state: MultiAgentState) -> MultiAgentState:
            stream_writer = get_stream_writer()

            # Human-in-the-loop: if the user interrupted the run, hold here
            # (before this agent starts) until they resume.
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

            # Stream: Agent starting
            stream_writer({
                "type": EventType.AGENT_START.value,
                "agent_name": agent.name,
                "agent_role": agent.role,
                "turn": state["rounds"] + 1,
                "sandbox_thread_id": sandbox_thread_id,
                "sandbox_workspace": sandbox_workspace,
            })

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

            # Sandbox: when this chat has files, scope the run to the shared
            # conversation workspace and auto-inject the sandbox tools (before
            # TaskToolkit so subagents inherit them).
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

            user_input = uploads_hint(conversation_id) + state["input"]

            # Stream: Building context
            stream_writer({
                "type": EventType.CONTEXT_BUILDING.value,
                "agent_name": agent.name,
            })

            # Human-in-the-loop: pick up any user messages posted mid-run so
            # this agent (and every one after it) sees the latest guidance.
            human_guidance = drain_human_guidance(
                conversation_id=conversation_id,
                stream_writer=stream_writer,
                graph_context_provider=graph_context_provider,
                graph_config=graph_config,
            )

            if graph_context_provider and conversation_id:
                pack = graph_context_provider.build_graph_context(
                    conversation_id=conversation_id,
                    query=state["input"],
                    config=graph_config,
                )
                if pack.text:
                    user_input = f"{pack.text}\n\nIncoming request:\n{state['input']}"
                    # Stream: Context retrieved
                    stream_writer({
                        "type": EventType.CONTEXT_RETRIEVED.value,
                        "agent_name": agent.name,
                        "node_ids": pack.node_ids,
                        "edge_ids": pack.edge_ids,
                        "chunk_ids": pack.chunk_ids,
                    })

            # Shared working memory: in a pipeline only the previous agent's
            # output flows forward — the digest restores everything earlier.
            ensure_working_memory(conversation_id, state["original_input"])
            if human_guidance:
                record_guidance_in_memory(conversation_id, human_guidance)
            memory_block = working_memory_block(conversation_id)
            if memory_block:
                user_input = f"{memory_block}\n\n{user_input}"

            # Prepend so the guidance survives tail-truncation by the token budget.
            if human_guidance:
                user_input = f"{human_guidance}\n\n{user_input}"

            budget_result = apply_context_token_budget(
                llm=llm,
                system_prompt=agent.system_prompt,
                user_input=user_input,
                max_context_tokens=MAX_CONTEXT_TOKENS,
                reserved_output_tokens=RESERVED_OUTPUT_TOKENS,
            )
            user_input = budget_result.text

            # Stream: LLM processing started
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
                agent_name=agent.name,
                system=agent.system_prompt,
                user=user_input,
                tools=bound_tools or None,
                parallel_tools=agent.subagent_enabled,
            )

            # Stream: LLM response received
            stream_writer({
                "type": EventType.LLM_RESPONSE_COMPLETE.value,
                "agent_name": agent.name,
                "response_length": len(output),
            })

            next_turn = GraphTurn(
                turn=state["rounds"] + 1,
                agent_name=agent.name,
                agent_role=agent.role,
                content=output,
            )

            # Working memory: keep this stage's result available to all later
            # pipeline stages, not just the immediate next one.
            record_turn_in_memory(
                conversation_id,
                agent_name=agent.name,
                turn=state["rounds"] + 1,
                content=output,
                kind="result",
            )

            if graph_context_provider and conversation_id:
                graph_context_provider.ingest_message(
                    conversation_id=conversation_id,
                    message_id=f"agent-{agent.name}-{uuid4().hex}",
                    speaker=agent.name,
                    content=output,
                    config=graph_config,
                )
                # Stream: Message ingested
                stream_writer({
                    "type": EventType.MESSAGE_INGESTED.value,
                    "agent_name": agent.name,
                })

            # Stream: Turn completed
            stream_writer({
                "type": EventType.TURN_COMPLETE.value,
                "turn": next_turn,
            })

            return {
                **state,
                "input": output,
                "turns": [*state["turns"], next_turn],
                "final_response": output,
                "final_agent": agent.name,
                "rounds": state["rounds"] + 1,
            }

        return node
