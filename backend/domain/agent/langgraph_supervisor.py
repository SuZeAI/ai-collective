from __future__ import annotations

import os
import re
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

_DELEGATION_LOG_WINDOW = 6  # last N delegation entries shown to lead

_LEAD_ROUTING_PROMPT = """
## SUPERVISOR ROLE
You are the **lead agent**. Your job is to complete the user's request by either answering directly or delegating sub-tasks to specialist workers, then synthesizing their results.

### Delegation syntax (place ONLY at the very end of your response):
- Delegate to a worker:
  ```
  <DELEGATE_TO>ExactWorkerName</DELEGATE_TO>
  <TASK>Clear, self-contained task description for the worker</TASK>
  ```
- Return final answer to user:
  ```
  <FINAL_ANSWER>Your complete answer here</FINAL_ANSWER>
  ```

### Rules:
1. Write your reasoning first, then ONE control block at the very end.
2. You may only delegate to one worker per turn.
3. Workers report directly back to you — you decide what to do next.
4. When the task is complete (or rounds are nearly exhausted), output `<FINAL_ANSWER>`.
5. Do not repeat work already done by workers — build on their results.
6. If a worker's result is insufficient, delegate again with a more specific task.

### Available workers:
{worker_profiles}

### Round budget: {rounds_used}/{max_rounds} used — {remaining} remaining.
"""

_WORKER_PROMPT = """
## WORKER ROLE
You are a specialist worker. The lead agent has assigned you a specific task. Execute it thoroughly and return your results directly — the lead will handle next steps.

### Task assigned by lead:
{task}

### Original user request (for context):
{original_input}
"""


class SupervisorState(TypedDict):
    input: str               # Latest message: initial input or subagent result
    original_input: str      # Original user request (never changes)
    turns: list[GraphTurn]
    delegation_log: list[str]  # Chronological log of delegations + results
    current_task: str        # Task text currently being executed by a worker
    current_worker: str | None  # Name of currently active worker (None when lead is up)
    final_answer_reached: bool
    rounds: int
    final_response: str
    final_agent: str | None


class LangGraphSupervisorOrchestrator(AgentGraphOrchestrator):
    """
    Supervisor topology: one lead agent orchestrates N worker agents.

    Flow:
        START → Lead
        Lead → DELEGATE_TO(Worker_i) → Worker_i → Lead  (loop)
        Lead → FINAL_ANSWER → END
        Lead → rounds exhausted → END

    The lead decides which worker to call and what task to assign.
    Workers always report back to the lead.
    Only the lead can end the conversation.
    """

    _DELEGATE_TO_RE = re.compile(
        r"<\s*DELEGATE_TO\s*>(.*?)<\s*/\s*DELEGATE_TO\s*>",
        re.IGNORECASE | re.DOTALL,
    )
    _TASK_RE = re.compile(
        r"<\s*TASK\s*>(.*?)<\s*/\s*TASK\s*>",
        re.IGNORECASE | re.DOTALL,
    )
    _FINAL_ANSWER_RE = re.compile(
        r"<\s*FINAL_ANSWER\s*>(.*?)<\s*/\s*FINAL_ANSWER\s*>",
        re.IGNORECASE | re.DOTALL,
    )
    _CONTROL_BLOCK_RE = re.compile(
        r"<\s*(DELEGATE_TO|TASK|FINAL_ANSWER)\s*>.*?<\s*/\s*\1\s*>",
        re.IGNORECASE | re.DOTALL,
    )

    # ------------------------------------------------------------------ #
    # Public interface                                                     #
    # ------------------------------------------------------------------ #

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

        self._ingest_user_message(user_input, conversation_id, graph_context_provider, graph_config)
        graph = self._build_graph(agents, llm, max_rounds, conversation_id, graph_context_provider, graph_config)
        final_state = await run_to_final_state(graph, self._initial_state(user_input, agents), max_rounds)

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

        self._ingest_user_message(user_input, conversation_id, graph_context_provider, graph_config)
        graph = self._build_graph(agents, llm, max_rounds, conversation_id, graph_context_provider, graph_config)

        async for event in graph.astream(
            self._initial_state(user_input, agents),
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
        conversation_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
    ):
        lead = agents[0]
        workers = agents[1:]
        worker_names = [w.name for w in workers]
        all_node_names = [a.name for a in agents]

        builder: StateGraph = StateGraph(SupervisorState)

        # Lead node
        builder.add_node(
            lead.name,
            self._make_lead_node(
                lead=lead,
                workers=workers,
                llm=llm,
                max_rounds=max_rounds,
                conversation_id=conversation_id,
                graph_context_provider=graph_context_provider,
                graph_config=graph_config,
            ),
        )

        # Worker nodes
        for worker in workers:
            builder.add_node(
                worker.name,
                self._make_worker_node(
                    worker=worker,
                    llm=llm,
                    conversation_id=conversation_id,
                    graph_context_provider=graph_context_provider,
                    graph_config=graph_config,
                ),
            )
            # Workers always return to lead
            builder.add_edge(worker.name, lead.name)

        # Lead conditional routing
        def lead_router(state: SupervisorState) -> str:
            if state.get("final_answer_reached") or state["rounds"] >= max_rounds:
                return "end"
            target = state.get("current_worker")
            if target and target in worker_names:
                return target
            return "end"

        routing_map: dict[str, str] = {"end": END}
        for name in worker_names:
            routing_map[name] = name

        builder.add_conditional_edges(lead.name, lead_router, routing_map)
        builder.add_edge(START, lead.name)

        return builder.compile()

    @staticmethod
    def _initial_state(user_input: str, agents: list[GraphAgentDefinition]) -> SupervisorState:
        return {
            "input": user_input,
            "original_input": user_input,
            "turns": [],
            "delegation_log": [],
            "current_task": "",
            "current_worker": None,
            "final_answer_reached": False,
            "rounds": 0,
            "final_response": "",
            "final_agent": None,
        }

    # ------------------------------------------------------------------ #
    # Node factories                                                       #
    # ------------------------------------------------------------------ #

    def _make_lead_node(
        self,
        *,
        lead: GraphAgentDefinition,
        workers: list[GraphAgentDefinition],
        llm: LLMProvider,
        max_rounds: int,
        conversation_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
    ):
        worker_profiles = "\n".join(
            f"- {w.name}: {w.role}" + (f" — {w.description}" if w.description else "")
            for w in workers
        ) or "- (no workers available)"

        async def lead_node(state: SupervisorState) -> dict:
            stream_writer = get_stream_writer()

            # Human-in-the-loop: hold at the turn boundary while interrupted.
            await wait_while_paused(
                conversation_id=conversation_id,
                stream_writer=stream_writer,
                agent_name=lead.name,
            )

            rounds_used = state["rounds"]
            remaining = max(0, max_rounds - rounds_used)

            stream_writer({
                "type": EventType.AGENT_START.value,
                "agent_name": lead.name,
                "agent_role": lead.role,
                "turn": rounds_used + 1,
                "is_lead": True,
            })
            stream_writer({"type": EventType.CONTEXT_BUILDING.value, "agent_name": lead.name})

            # Human-in-the-loop: the lead is the routing brain, so mid-run user
            # guidance lands here and steers the next delegation/final answer.
            human_guidance = drain_human_guidance(
                conversation_id=conversation_id,
                stream_writer=stream_writer,
                graph_context_provider=graph_context_provider,
                graph_config=graph_config,
            )

            # Knowledge graph context
            graph_ctx = ""
            if graph_context_provider and conversation_id:
                pack = graph_context_provider.build_graph_context(
                    conversation_id=conversation_id,
                    query=state["original_input"],
                    config=graph_config,
                )
                graph_ctx = pack.text
                if graph_ctx:
                    stream_writer({
                        "type": EventType.CONTEXT_RETRIEVED.value,
                        "agent_name": lead.name,
                        "node_ids": pack.node_ids,
                        "edge_ids": pack.edge_ids,
                        "chunk_ids": pack.chunk_ids,
                    })

            # Build lead context
            recent_log = state.get("delegation_log", [])[-_DELEGATION_LOG_WINDOW:]
            log_text = "\n".join(recent_log) if recent_log else "(no prior delegations)"

            routing_guidance = _LEAD_ROUTING_PROMPT.format(
                worker_profiles=worker_profiles,
                rounds_used=rounds_used,
                max_rounds=max_rounds,
                remaining=remaining,
            )

            context_parts: list[str] = []
            # First so the guidance survives tail-truncation by the token budget.
            if human_guidance:
                context_parts += [human_guidance, ""]
            context_parts += [
                f"[User request]: {state['original_input']}",
            ]
            if graph_ctx:
                context_parts += ["", f"[Context]:\n{graph_ctx}"]
            if recent_log:
                context_parts += ["", f"[Delegation history]:\n{log_text}"]
            if state.get("input") and state["input"] != state["original_input"]:
                context_parts += ["", f"[Latest worker report]:\n{state['input']}"]

            user_input_text = "\n".join(context_parts)
            full_system = f"{lead.system_prompt}\n\n{routing_guidance}"

            budget_result = apply_context_token_budget(
                llm=llm,
                system_prompt=full_system,
                user_input=user_input_text,
                max_context_tokens=MAX_CONTEXT_TOKENS,
                reserved_output_tokens=RESERVED_OUTPUT_TOKENS,
            )
            user_input_text = budget_result.text

            bound_tools: list = []
            if lead.tools:
                for toolkit in lead.tools.values():
                    bound_tools.extend(toolkit.get_tools())

            stream_writer({
                "type": EventType.LLM_REQUEST_START.value,
                "agent_name": lead.name,
                "context_length": len(user_input_text),
                "context_tokens": budget_result.input_tokens,
                "context_token_limit": budget_result.max_input_tokens,
                "context_truncated": budget_result.truncated,
                "tokenizer_family": budget_result.tokenizer_family,
                "llm_provider": budget_result.provider,
                "llm_model": budget_result.model,
            })

            raw_output = await safe_chat(llm,
                system=full_system,
                user=user_input_text,
                tools=bound_tools or None,
            )

            stream_writer({
                "type": EventType.LLM_RESPONSE_COMPLETE.value,
                "agent_name": lead.name,
                "response_length": len(raw_output),
            })

            reasoning, action = self._split_reasoning_and_action(raw_output)
            final_answer = self._extract_final_answer(action)
            target_worker, task_text = self._extract_delegation(action)

            new_turn = GraphTurn(
                turn=rounds_used + 1,
                agent_name=lead.name,
                agent_role=lead.role,
                content=reasoning,
            )

            new_log = list(state.get("delegation_log", []))
            # Keep mid-run human guidance visible in later lead turns (the
            # interject queue is drained once, so persist it in the log).
            if human_guidance:
                new_log.append(f"[Turn {rounds_used + 1}] {human_guidance}")
            if target_worker and task_text:
                new_log.append(f"[Turn {rounds_used + 1}] {lead.name} → {target_worker}: {task_text}")

            if graph_context_provider and conversation_id:
                graph_context_provider.ingest_message(
                    conversation_id=conversation_id,
                    message_id=f"agent-{lead.name}-{uuid4().hex}",
                    speaker=lead.name,
                    content=reasoning,
                    config=graph_config,
                )
                stream_writer({"type": EventType.MESSAGE_INGESTED.value, "agent_name": lead.name})

            stream_writer({
                "type": EventType.TURN_COMPLETE.value,
                "turn": new_turn,
                "delegate_to": target_worker,
                "final_answer_reached": bool(final_answer),
            })

            return {
                **state,
                "input": final_answer or state["input"],
                "turns": [*state["turns"], new_turn],
                "delegation_log": new_log,
                "current_task": task_text or "",
                "current_worker": target_worker,
                "final_answer_reached": bool(final_answer),
                "final_response": final_answer or reasoning,
                "final_agent": lead.name,
                "rounds": rounds_used + 1,
            }

        return lead_node

    def _make_worker_node(
        self,
        *,
        worker: GraphAgentDefinition,
        llm: LLMProvider,
        conversation_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
    ):
        async def worker_node(state: SupervisorState) -> dict:
            stream_writer = get_stream_writer()

            # Human-in-the-loop: hold at the turn boundary while interrupted.
            await wait_while_paused(
                conversation_id=conversation_id,
                stream_writer=stream_writer,
                agent_name=worker.name,
            )

            rounds_used = state["rounds"]

            stream_writer({
                "type": EventType.AGENT_START.value,
                "agent_name": worker.name,
                "agent_role": worker.role,
                "turn": rounds_used + 1,
                "is_worker": True,
            })
            stream_writer({"type": EventType.CONTEXT_BUILDING.value, "agent_name": worker.name})

            task_text = state.get("current_task") or state.get("input", "")
            worker_system = (
                f"{worker.system_prompt}\n\n"
                + _WORKER_PROMPT.format(
                    task=task_text,
                    original_input=state["original_input"],
                )
            )

            graph_ctx = ""
            if graph_context_provider and conversation_id:
                pack = graph_context_provider.build_graph_context(
                    conversation_id=conversation_id,
                    query=task_text or state["original_input"],
                    config=graph_config,
                )
                graph_ctx = pack.text
                if graph_ctx:
                    stream_writer({
                        "type": EventType.CONTEXT_RETRIEVED.value,
                        "agent_name": worker.name,
                        "node_ids": pack.node_ids,
                        "edge_ids": pack.edge_ids,
                        "chunk_ids": pack.chunk_ids,
                    })

            user_input_text = task_text
            if graph_ctx:
                user_input_text = f"{task_text}\n\n[Context]:\n{graph_ctx}"

            budget_result = apply_context_token_budget(
                llm=llm,
                system_prompt=worker_system,
                user_input=user_input_text,
                max_context_tokens=MAX_CONTEXT_TOKENS,
                reserved_output_tokens=RESERVED_OUTPUT_TOKENS,
            )
            user_input_text = budget_result.text

            bound_tools: list = []
            if worker.tools:
                for toolkit in worker.tools.values():
                    bound_tools.extend(toolkit.get_tools())

            stream_writer({
                "type": EventType.LLM_REQUEST_START.value,
                "agent_name": worker.name,
                "context_length": len(user_input_text),
                "context_tokens": budget_result.input_tokens,
                "context_token_limit": budget_result.max_input_tokens,
                "context_truncated": budget_result.truncated,
                "tokenizer_family": budget_result.tokenizer_family,
                "llm_provider": budget_result.provider,
                "llm_model": budget_result.model,
            })

            output = await safe_chat(llm,
                system=worker_system,
                user=user_input_text,
                tools=bound_tools or None,
            )

            stream_writer({
                "type": EventType.LLM_RESPONSE_COMPLETE.value,
                "agent_name": worker.name,
                "response_length": len(output),
            })

            new_turn = GraphTurn(
                turn=rounds_used + 1,
                agent_name=worker.name,
                agent_role=worker.role,
                content=output,
            )

            new_log = list(state.get("delegation_log", []))
            new_log.append(f"[Turn {rounds_used + 1}] {worker.name} → Lead: {output[:300]}{'...' if len(output) > 300 else ''}")

            if graph_context_provider and conversation_id:
                graph_context_provider.ingest_message(
                    conversation_id=conversation_id,
                    message_id=f"agent-{worker.name}-{uuid4().hex}",
                    speaker=worker.name,
                    content=output,
                    config=graph_config,
                )
                stream_writer({"type": EventType.MESSAGE_INGESTED.value, "agent_name": worker.name})

            stream_writer({
                "type": EventType.TURN_COMPLETE.value,
                "turn": new_turn,
                "reporting_to_lead": True,
            })

            return {
                **state,
                "input": f"[{worker.name} result]: {output}",
                "turns": [*state["turns"], new_turn],
                "delegation_log": new_log,
                "current_task": "",
                "current_worker": None,
                "final_response": output,
                "final_agent": worker.name,
                "rounds": rounds_used + 1,
            }

        return worker_node

    # ------------------------------------------------------------------ #
    # Helpers                                                              #
    # ------------------------------------------------------------------ #

    def _split_reasoning_and_action(self, message: str) -> tuple[str, str]:
        if not message:
            return "", ""
        actions = [m.group(0).strip() for m in self._CONTROL_BLOCK_RE.finditer(message)]
        action_payload = "\n".join(a for a in actions if a).strip()
        reasoning = self._CONTROL_BLOCK_RE.sub("", message)
        reasoning = re.sub(r"\n{3,}", "\n\n", reasoning).strip()
        return reasoning, action_payload

    def _extract_delegation(self, action_payload: str) -> tuple[str | None, str]:
        delegate_match = self._DELEGATE_TO_RE.search(action_payload)
        task_match = self._TASK_RE.search(action_payload)
        if not delegate_match:
            return None, ""
        target = delegate_match.group(1).strip()
        task = task_match.group(1).strip() if task_match else ""
        return target or None, task

    def _extract_final_answer(self, action_payload: str) -> str:
        match = self._FINAL_ANSWER_RE.search(action_payload)
        return match.group(1).strip() if match else ""

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
