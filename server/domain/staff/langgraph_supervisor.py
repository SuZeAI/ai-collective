from __future__ import annotations

import asyncio
import logging
import re
from typing import TypedDict
from uuid import uuid4

from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from server.api.settings import settings
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
    FANOUT_SYNTHESIS_GUIDANCE,
    MESH_FANOUT_MAX_CONCURRENT,
    assemble_run_result,
    build_bound_tools,
    build_turn_messages,
    drain_human_guidance,
    ensure_working_memory,
    get_fanout_semaphore,
    ingest_user_message,
    init_sandbox_thread,
    parse_fanout_pairs,
    record_guidance_in_memory,
    record_turn_in_memory,
    recursion_config,
    raise_if_llm_failed,
    run_fanout_wave,
    run_to_final_state,
    safe_chat_retry_empty,
    split_reasoning_and_action,
    uploads_hint,
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


logger = logging.getLogger(__name__)

MAX_CONTEXT_TOKENS = max(1024, settings.staff.context_token_limit)
RESERVED_OUTPUT_TOKENS = max(256, settings.staff.output_token_reserve)

_DELEGATION_LOG_WINDOW = 6  # last N delegation entries shown to lead

# How many times to nudge the lead when its reply used none of the required
# control tags (<FANOUT>/<DELEGATE_TO>/<FINAL_ANSWER>) -- without this, a lead
# that merely describes its plan in prose (small/fast models do this more
# often) falls through lead_router's "no target, no final answer -> end"
# branch and silently ends the whole run after a single turn.
_LEAD_FORMAT_RETRIES = 1
_LEAD_FORMAT_RETRY_PROMPT = (
    "Your reply didn't include a valid control tag, so no action can be "
    "taken. Reply again using ONLY one of: <DELEGATE_TO>...</DELEGATE_TO> "
    "with <TASK>...</TASK>, <FANOUT>...</FANOUT>, or "
    "<FINAL_ANSWER>...</FINAL_ANSWER>."
)

_LEAD_ROUTING_PROMPT = """
## SUPERVISOR ROLE
You are the **lead staff_member**. Your job is to complete the user's request by either answering directly or delegating sub-tasks to specialist workers, then synthesizing their results.

### Delegation syntax (place ONLY at the very end of your response):
- Delegate to a worker:
  ```
  <DELEGATE_TO>ExactWorkerName</DELEGATE_TO>
  <TASK>Clear, self-contained task description for the worker</TASK>
  ```
- Dispatch a PARALLEL wave (several workers at once, run concurrently):
  ```
  <FANOUT>
  <DELEGATE_TO>WorkerA</DELEGATE_TO><TASK>independent self-contained task for A</TASK>
  <DELEGATE_TO>WorkerB</DELEGATE_TO><TASK>independent self-contained task for B</TASK>
  </FANOUT>
  ```
- Return final answer to user:
  ```
  <FINAL_ANSWER>Your complete answer here</FINAL_ANSWER>
  ```

### Rules:
1. Write your reasoning first, then ONE control block at the very end.
2. Delegate to one worker with `<DELEGATE_TO>`, OR dispatch 2 to {max_concurrent} workers
   at once with `<FANOUT>` when their tasks are INDEPENDENT (no ordering dependency).
   After a fan-out wave you receive all results together and synthesize them.
3. Workers report directly back to you — you decide what to do next.
4. When the task is complete (or rounds are nearly exhausted), output `<FINAL_ANSWER>`.
5. Do not repeat work already done by workers — build on their results.
6. If a worker's result is insufficient, delegate again with a more specific task.

### Available workers:
{worker_profiles}

### Round budget: {rounds_used}/{max_rounds} used — {remaining} remaining.
"""

_WORKER_ROLE_HEADER = """
## WORKER ROLE
You are a specialist worker. The lead staff_member has assigned you a specific task. Execute it thoroughly and return your results directly — the lead will handle next steps.
"""


class SupervisorState(TypedDict):
    input: str               # Latest message: initial input or subagent result
    original_input: str      # Original user request (never changes)
    turns: list[GraphTurn]
    delegation_log: list[str]  # Chronological log of delegations + results
    staff_states: StaffStates
    current_task: str        # Task text currently being executed by a worker
    current_worker: str | None  # Name of currently active worker (None when lead is up)
    final_answer_reached: bool
    rounds: int
    final_response: str
    final_staff: str | None


class LangGraphSupervisorOrchestrator(StaffGraphOrchestrator):
    """
    Supervisor topology: one lead staff_member orchestrates N worker staff.

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
        r"<\s*(FANOUT|DELEGATE_TO|TASK|FINAL_ANSWER)\s*>.*?<\s*/\s*\1\s*>",
        re.IGNORECASE | re.DOTALL,
    )
    _FANOUT_RE = re.compile(
        r"<\s*FANOUT\s*>(.*?)<\s*/\s*FANOUT\s*>",
        re.IGNORECASE | re.DOTALL,
    )
    _FANOUT_PAIR_RE = re.compile(
        r"<\s*DELEGATE_TO\s*>(.*?)<\s*/\s*DELEGATE_TO\s*>\s*"
        r"<\s*TASK\s*>(.*?)<\s*/\s*TASK\s*>",
        re.IGNORECASE | re.DOTALL,
    )

    # ------------------------------------------------------------------ #
    # Public interface                                                     #
    # ------------------------------------------------------------------ #

    async def run(
        self,
        *,
        user_input: str,
        staff: list[GraphStaffDefinition],
        llm: LLMProvider,
        max_rounds: int,
        meeting_id: str | None = None,
        project_id: str | None = None,
        graph_context_provider: GraphContextProvider | None = None,
        graph_config: GraphContextConfig | None = None,
        custom_graph=None,  # accepted for protocol parity; ignored by this mode
    ) -> GraphRunResult:
        if not staff:
            raise ValueError("At least one staff_member definition is required")

        ingest_user_message(user_input, meeting_id, graph_context_provider, graph_config)
        graph = self._build_graph(
            staff, llm, max_rounds, meeting_id, graph_context_provider, graph_config, project_id=project_id
        )
        final_state, error = await run_to_final_state(graph, self._initial_state(user_input, staff), max_rounds)
        return assemble_run_result(final_state, error)

    async def run_stream(
        self,
        *,
        user_input: str,
        staff: list[GraphStaffDefinition],
        llm: LLMProvider,
        max_rounds: int,
        meeting_id: str | None = None,
        project_id: str | None = None,
        graph_context_provider: GraphContextProvider | None = None,
        graph_config: GraphContextConfig | None = None,
        custom_graph=None,  # accepted for protocol parity; ignored by this mode
    ):
        if not staff:
            raise ValueError("At least one staff_member definition is required")

        ingest_user_message(user_input, meeting_id, graph_context_provider, graph_config)
        graph = self._build_graph(
            staff, llm, max_rounds, meeting_id, graph_context_provider, graph_config, project_id=project_id
        )

        async for event in graph.astream(
            self._initial_state(user_input, staff),
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
        staff: list[GraphStaffDefinition],
        llm: LLMProvider,
        max_rounds: int,
        meeting_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
        project_id: str | None = None,
    ):
        lead = staff[0]
        workers = staff[1:]
        worker_names = [w.name for w in workers]

        builder: StateGraph = StateGraph(SupervisorState)

        # Lead node
        builder.add_node(
            lead.name,
            self._make_lead_node(
                lead=lead,
                workers=workers,
                llm=llm,
                max_rounds=max_rounds,
                meeting_id=meeting_id,
                project_id=project_id,
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
                    meeting_id=meeting_id,
                    project_id=project_id,
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
    def _initial_state(user_input: str, staff: list[GraphStaffDefinition]) -> SupervisorState:
        return {
            "input": user_input,
            "original_input": user_input,
            "turns": [],
            "delegation_log": [],
            "staff_states": init_staff_states(staff),
            "current_task": "",
            "current_worker": None,
            "final_answer_reached": False,
            "rounds": 0,
            "final_response": "",
            "final_staff": None,
        }

    # ------------------------------------------------------------------ #
    # Node factories                                                       #
    # ------------------------------------------------------------------ #

    def _make_lead_node(
        self,
        *,
        lead: GraphStaffDefinition,
        workers: list[GraphStaffDefinition],
        llm: LLMProvider,
        max_rounds: int,
        meeting_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
        project_id: str | None = None,
    ):
        worker_profiles = "\n".join(
            f"- {w.name}: {w.role}" + (f" — {w.description}" if w.description else "")
            for w in workers
        ) or "- (no workers available)"

        async def lead_node(state: SupervisorState) -> dict:
            stream_writer = get_stream_writer()

            # Human-in-the-loop: hold at the turn boundary while interrupted.
            await wait_while_paused(
                meeting_id=meeting_id,
                stream_writer=stream_writer,
                staff_name=lead.name,
            )

            rounds_used = state["rounds"]
            remaining = max(0, max_rounds - rounds_used)

            # Generate a unique thread_id for this staff_member turn.
            # Also creates {SANDBOX_WORKSPACE}/{thread_id}/ immediately.
            sandbox_thread_id, sandbox_workspace = init_sandbox_thread(lead.name, meeting_id)

            stream_writer({
                "type": EventType.AGENT_START.value,
                "agent_name": lead.name,
                "staff_role": lead.role,
                "turn": rounds_used + 1,
                "is_lead": True,
                "sandbox_thread_id": sandbox_thread_id,
                "sandbox_workspace": sandbox_workspace,
            })
            stream_writer({"type": EventType.CONTEXT_BUILDING.value, "agent_name": lead.name})

            # Human-in-the-loop: the lead is the routing brain, so mid-run user
            # guidance lands here and steers the next delegation/final answer.
            human_guidance = drain_human_guidance(
                meeting_id=meeting_id,
                stream_writer=stream_writer,
                graph_context_provider=graph_context_provider,
                graph_config=graph_config,
            )

            # Shared working memory: pin guidance, then build the digest that
            # keeps prior findings alive across log windows and truncation.
            ensure_working_memory(meeting_id, state["original_input"])
            if human_guidance:
                record_guidance_in_memory(meeting_id, human_guidance)
            memory_block = working_memory_block(meeting_id)

            # Knowledge graph context
            graph_ctx = ""
            if graph_context_provider and meeting_id:
                pack = graph_context_provider.build_graph_context(
                    meeting_id=meeting_id,
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
                max_concurrent=MESH_FANOUT_MAX_CONCURRENT,
            )

            # The actual turn input: the latest worker report, or (first turn)
            # the user's original request.
            if state.get("input") and state["input"] != state["original_input"]:
                input_text = state["input"]
            else:
                input_text = state["original_input"]

            context_parts: list[str] = []
            # First so the guidance survives tail-truncation by the token budget.
            if human_guidance:
                context_parts += [human_guidance, ""]
            uploads = uploads_hint(meeting_id)
            if uploads:
                context_parts += [uploads]
            # routing_guidance carries live round counters, so it varies every
            # turn — it belongs in the per-turn context, not the fixed system
            # prompt (which must stay stable for caching to work at all).
            context_parts += [routing_guidance, ""]
            context_parts += [
                f"[User request]: {state['original_input']}",
            ]
            # Early so the shared memory survives tail-truncation.
            if memory_block:
                context_parts += ["", memory_block]
            if graph_ctx:
                context_parts += ["", f"[Context]:\n{graph_ctx}"]
            if recent_log:
                context_parts += ["", f"[Delegation history]:\n{log_text}"]

            bound_tools = build_bound_tools(
                lead, meeting_id=meeting_id, project_id=project_id, llm=llm
            )

            # lead.system_prompt stays byte-identical every turn so the
            # compiled-agent cache and upstream provider prompt-caching see a
            # stable prefix; only context_parts is budget-trimmed.
            turn, budget_result = build_turn_messages(
                llm=llm,
                system_prompt=lead.system_prompt,
                context_text="\n".join(context_parts),
                input_text=input_text,
                max_context_tokens=MAX_CONTEXT_TOKENS,
                reserved_output_tokens=RESERVED_OUTPUT_TOKENS,
            )

            stream_writer({
                "type": EventType.LLM_REQUEST_START.value,
                "agent_name": lead.name,
                "context_length": sum(len(m["content"]) for m in turn.as_messages()),
                "context_tokens": budget_result.input_tokens,
                "context_token_limit": budget_result.max_input_tokens,
                "context_truncated": budget_result.truncated,
                "tokenizer_family": budget_result.tokenizer_family,
                "llm_provider": budget_result.provider,
                "llm_model": budget_result.model,
            })

            own_history = llm_ready_messages(state.get("staff_states", {}), lead.name)
            messages = [*own_history, *turn.as_messages()]
            raw_output = await safe_chat_retry_empty(llm,
                staff_name=lead.name,
                system=lead.system_prompt,
                messages=messages,
                tools=bound_tools or None,
            )
            raise_if_llm_failed(raw_output)
            reasoning, action = self._split_reasoning_and_action(raw_output)

            # Nudge the lead if it used none of the required control tags,
            # instead of silently treating this as a final answer/dead end.
            for _ in range(_LEAD_FORMAT_RETRIES):
                if (
                    self._FANOUT_RE.search(action)
                    or self._DELEGATE_TO_RE.search(action)
                    or self._FINAL_ANSWER_RE.search(action)
                ):
                    break
                messages = [
                    *messages,
                    {"role": "assistant", "content": raw_output},
                    {"role": "user", "content": _LEAD_FORMAT_RETRY_PROMPT},
                ]
                raw_output = await safe_chat_retry_empty(llm,
                    staff_name=lead.name,
                    system=lead.system_prompt,
                    messages=messages,
                    tools=bound_tools or None,
                )
                raise_if_llm_failed(raw_output)
                reasoning, action = self._split_reasoning_and_action(raw_output)

            stream_writer({
                "type": EventType.LLM_RESPONSE_COMPLETE.value,
                "agent_name": lead.name,
                "response_length": len(raw_output),
            })

            new_staff_states = append_assistant_turn(
                append_user_turn(state.get("staff_states", {}), lead.name, input_text),
                lead.name,
                reasoning or raw_output,
            )

            # Parallel fan-out: lead may dispatch several workers at once.
            fanout_pairs = self._parse_fanout(action, [w.name for w in workers], lead.name)
            if fanout_pairs:
                logger.debug(
                    "lead_node: FANOUT -> %s", [n for n, _ in fanout_pairs]
                )
                return await self._execute_lead_fanout(
                    lead=lead,
                    workers=workers,
                    fanout_pairs=fanout_pairs,
                    lead_reasoning=reasoning,
                    lead_system=lead.system_prompt,
                    staff_states=new_staff_states,
                    state=state,
                    llm=llm,
                    stream_writer=stream_writer,
                    meeting_id=meeting_id,
                    project_id=project_id,
                    graph_context_provider=graph_context_provider,
                    graph_config=graph_config,
                    human_guidance=human_guidance,
                )

            final_answer = self._extract_final_answer(action)
            target_worker, task_text = self._extract_delegation(action, [w.name for w in workers])

            # The lead's reply is sometimes pure <DELEGATE_TO>/<TASK> control tags
            # with no free-text commentary — _split_reasoning_and_action strips
            # those out entirely, which would leave the transcript bubble empty.
            # Fall back to a human-readable delegation summary, or the raw
            # output as a last resort (mirrors langgraph_tree.py).
            display_content = reasoning or (
                f"Delegated to {target_worker}: {task_text}" if target_worker and task_text else raw_output
            )
            new_turn = GraphTurn(
                turn=rounds_used + 1,
                staff_name=lead.name,
                staff_role=lead.role,
                content=display_content,
            )

            new_log = list(state.get("delegation_log", []))
            # Keep mid-run human guidance visible in later lead turns (the
            # interject queue is drained once, so persist it in the log).
            if human_guidance:
                new_log.append(f"[Turn {rounds_used + 1}] {human_guidance}")
            if target_worker and task_text:
                new_log.append(f"[Turn {rounds_used + 1}] {lead.name} → {target_worker}: {task_text}")

            # Working memory: keep the routing decision / final answer alive
            # even after the delegation-log window rolls past it.
            if target_worker and task_text:
                record_turn_in_memory(
                    meeting_id,
                    staff_name=lead.name,
                    turn=rounds_used + 1,
                    content=f"Delegated to {target_worker}: {task_text}",
                    kind="decision",
                )
            elif final_answer:
                record_turn_in_memory(
                    meeting_id,
                    staff_name=lead.name,
                    turn=rounds_used + 1,
                    content=f"Final answer delivered: {final_answer}",
                    kind="result",
                )

            if graph_context_provider and meeting_id:
                graph_context_provider.ingest_message(
                    meeting_id=meeting_id,
                    message_id=f"staff_member-{lead.name}-{uuid4().hex}",
                    speaker=lead.name,
                    content=display_content,
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
                "staff_states": new_staff_states,
                "current_task": task_text or "",
                "current_worker": target_worker,
                "final_answer_reached": bool(final_answer),
                "final_response": final_answer or reasoning,
                "final_staff": lead.name,
                "rounds": rounds_used + 1,
            }

        return lead_node

    def _make_worker_node(
        self,
        *,
        worker: GraphStaffDefinition,
        llm: LLMProvider,
        meeting_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
        project_id: str | None = None,
    ):
        async def worker_node(state: SupervisorState) -> dict:
            stream_writer = get_stream_writer()

            # Human-in-the-loop: hold at the turn boundary while interrupted.
            await wait_while_paused(
                meeting_id=meeting_id,
                stream_writer=stream_writer,
                staff_name=worker.name,
            )

            rounds_used = state["rounds"]

            # Generate a unique thread_id for this staff_member turn.
            # Also creates {SANDBOX_WORKSPACE}/{thread_id}/ immediately.
            sandbox_thread_id, sandbox_workspace = init_sandbox_thread(worker.name, meeting_id)

            stream_writer({
                "type": EventType.AGENT_START.value,
                "agent_name": worker.name,
                "staff_role": worker.role,
                "turn": rounds_used + 1,
                "is_worker": True,
                "sandbox_thread_id": sandbox_thread_id,
                "sandbox_workspace": sandbox_workspace,
            })
            stream_writer({"type": EventType.CONTEXT_BUILDING.value, "agent_name": worker.name})

            task_text = state.get("current_task") or state.get("input", "")
            # Fixed (no per-task placeholders) so it stays byte-identical every
            # call — see TurnMessages docstring for why that matters.
            worker_system = f"{worker.system_prompt}\n\n{_WORKER_ROLE_HEADER}"

            # Shared working memory: workers see what the lead and sibling
            # workers already found, instead of starting blind.
            memory_block = working_memory_block(meeting_id)

            graph_ctx = ""
            if graph_context_provider and meeting_id:
                pack = graph_context_provider.build_graph_context(
                    meeting_id=meeting_id,
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

            worker_context_parts = [f"[Original user request, for context]:\n{state['original_input']}"]
            # Memory before graph context so it survives tail-truncation.
            if memory_block:
                worker_context_parts.append(memory_block)
            uploads = uploads_hint(meeting_id)
            if uploads:
                worker_context_parts.append(uploads)
            if graph_ctx:
                worker_context_parts.append(f"[Context]:\n{graph_ctx}")

            bound_tools = build_bound_tools(
                worker, meeting_id=meeting_id, project_id=project_id, llm=llm
            )

            turn, budget_result = build_turn_messages(
                llm=llm,
                system_prompt=worker_system,
                context_text="\n\n".join(worker_context_parts),
                input_text=task_text,
                max_context_tokens=MAX_CONTEXT_TOKENS,
                reserved_output_tokens=RESERVED_OUTPUT_TOKENS,
            )

            stream_writer({
                "type": EventType.LLM_REQUEST_START.value,
                "agent_name": worker.name,
                "context_length": sum(len(m["content"]) for m in turn.as_messages()),
                "context_tokens": budget_result.input_tokens,
                "context_token_limit": budget_result.max_input_tokens,
                "context_truncated": budget_result.truncated,
                "tokenizer_family": budget_result.tokenizer_family,
                "llm_provider": budget_result.provider,
                "llm_model": budget_result.model,
            })

            own_history = llm_ready_messages(state.get("staff_states", {}), worker.name)
            output = await safe_chat_retry_empty(llm,
                staff_name=worker.name,
                system=worker_system,
                messages=[*own_history, *turn.as_messages()],
                tools=bound_tools or None,
            )
            raise_if_llm_failed(output)

            stream_writer({
                "type": EventType.LLM_RESPONSE_COMPLETE.value,
                "agent_name": worker.name,
                "response_length": len(output),
            })

            new_turn = GraphTurn(
                turn=rounds_used + 1,
                staff_name=worker.name,
                staff_role=worker.role,
                content=output,
            )

            new_log = list(state.get("delegation_log", []))
            new_log.append(f"[Turn {rounds_used + 1}] {worker.name} → Lead: {output[:300]}{'...' if len(output) > 300 else ''}")

            # Working memory: the full-fidelity note outlives the windowed
            # delegation log above (which only keeps the last few entries).
            record_turn_in_memory(
                meeting_id,
                staff_name=worker.name,
                turn=rounds_used + 1,
                content=output,
                kind="result",
            )

            if graph_context_provider and meeting_id:
                graph_context_provider.ingest_message(
                    meeting_id=meeting_id,
                    message_id=f"staff_member-{worker.name}-{uuid4().hex}",
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

            new_staff_states = append_assistant_turn(
                append_user_turn(state.get("staff_states", {}), worker.name, task_text),
                worker.name,
                output,
            )

            return {
                **state,
                "input": f"[{worker.name} result]: {output}",
                "turns": [*state["turns"], new_turn],
                "delegation_log": new_log,
                "staff_states": new_staff_states,
                "current_task": "",
                "current_worker": None,
                "final_response": output,
                "final_staff": worker.name,
                "rounds": rounds_used + 1,
            }

        return worker_node

    # ------------------------------------------------------------------ #
    # Helpers                                                              #
    # ------------------------------------------------------------------ #

    def _split_reasoning_and_action(self, message: str) -> tuple[str, str]:
        return split_reasoning_and_action(message, self._CONTROL_BLOCK_RE)

    def _extract_delegation(
        self, action_payload: str, worker_names: list[str] | None = None,
    ) -> tuple[str | None, str]:
        delegate_match = self._DELEGATE_TO_RE.search(action_payload)
        task_match = self._TASK_RE.search(action_payload)
        if not delegate_match:
            return None, ""
        target = delegate_match.group(1).strip()
        task = task_match.group(1).strip() if task_match else ""
        if target and worker_names:
            # The model reliably gets the tag syntax right but is inconsistent
            # about the exact casing of the worker's name (e.g. "researcher"
            # instead of "Researcher") -- match it case-insensitively against
            # the real names, same as parse_fanout_pairs already does for the
            # <FANOUT> path, so lead_router's exact-match check doesn't treat
            # a validly-targeted delegation as "no target" and silently end
            # the run.
            target = {name.lower(): name for name in worker_names}.get(target.lower(), target)
        return target or None, task

    def _extract_final_answer(self, action_payload: str) -> str:
        match = self._FINAL_ANSWER_RE.search(action_payload)
        return match.group(1).strip() if match else ""

    # ------------------------------------------------------------------ #
    # Parallel fan-out                                                     #
    # ------------------------------------------------------------------ #

    def _get_fanout_semaphore(self) -> asyncio.Semaphore:
        return get_fanout_semaphore(self)

    def _parse_fanout(
        self,
        action_payload: str,
        worker_names: list[str],
        lead_name: str,
    ) -> list[tuple[str, str]]:
        """Parse a `<FANOUT>` block into ordered (worker_name, task) pairs.

        Checked BEFORE single delegation so the inner DELEGATE_TO tags are
        not misread as one delegation.
        """
        return parse_fanout_pairs(
            action_payload,
            worker_names,
            lead_name,
            fanout_re=self._FANOUT_RE,
            pair_re=self._FANOUT_PAIR_RE,
        )

    def _build_worker_chat_kwargs(
        self,
        *,
        worker: GraphStaffDefinition,
        task_text: str,
        state: SupervisorState,
        llm: LLMProvider,
        meeting_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
        project_id: str | None = None,
    ) -> dict:
        """Assemble safe_chat kwargs for one fan-out worker (mirrors worker_node).

        Built sequentially in the node (before the gather) so graph-context
        reads are not raced across branches.
        """
        # Fixed (no per-task placeholders) so it stays byte-identical every
        # call — see TurnMessages docstring for why that matters.
        worker_system = f"{worker.system_prompt}\n\n{_WORKER_ROLE_HEADER}"
        memory_block = working_memory_block(meeting_id)

        graph_ctx = ""
        if graph_context_provider and meeting_id:
            pack = graph_context_provider.build_graph_context(
                meeting_id=meeting_id,
                query=task_text or state["original_input"],
                config=graph_config,
            )
            graph_ctx = pack.text

        worker_context_parts = [f"[Original user request, for context]:\n{state['original_input']}"]
        if memory_block:
            worker_context_parts.append(memory_block)
        uploads = uploads_hint(meeting_id)
        if uploads:
            worker_context_parts.append(uploads)
        if graph_ctx:
            worker_context_parts.append(f"[Context]:\n{graph_ctx}")

        bound_tools = build_bound_tools(
            worker, meeting_id=meeting_id, project_id=project_id, llm=llm
        )

        turn, _budget_result = build_turn_messages(
            llm=llm,
            system_prompt=worker_system,
            context_text="\n\n".join(worker_context_parts),
            input_text=task_text,
            max_context_tokens=MAX_CONTEXT_TOKENS,
            reserved_output_tokens=RESERVED_OUTPUT_TOKENS,
        )

        return {
            "system": worker_system,
            "messages": turn.as_messages(),
            "tools": bound_tools or None,
        }

    async def _execute_lead_fanout(
        self,
        *,
        lead: GraphStaffDefinition,
        workers: list[GraphStaffDefinition],
        fanout_pairs: list[tuple[str, str]],
        lead_reasoning: str,
        lead_system: str,
        staff_states: StaffStates,
        state: SupervisorState,
        llm: LLMProvider,
        stream_writer,
        meeting_id: str | None,
        graph_context_provider: GraphContextProvider | None,
        graph_config: GraphContextConfig | None,
        human_guidance: str,
        project_id: str | None = None,
    ) -> dict:
        """Run a parallel worker wave then synthesize, returning merged state.

        Turn layout (1 superstep = 1 round):
            lead (fan-out decision) | worker_1 .. worker_N | lead (synthesis)
        """
        turns = list(state["turns"])
        worker_by_name = {w.name: w for w in workers}
        base_turn = state["rounds"] + 1  # lead's fan-out decision turn

        new_log = list(state.get("delegation_log", []))
        if human_guidance:
            new_log.append(f"[Turn {base_turn}] {human_guidance}")

        # Lead's fan-out decision recorded as its own turn.
        record_turn_in_memory(
            meeting_id,
            staff_name=lead.name,
            turn=base_turn,
            content=f"Dispatched parallel wave: {[n for n, _ in fanout_pairs]}",
            kind="decision",
        )
        if graph_context_provider and meeting_id:
            graph_context_provider.ingest_message(
                meeting_id=meeting_id,
                message_id=f"staff_member-{lead.name}-{uuid4().hex}",
                speaker=lead.name,
                content=lead_reasoning,
                config=graph_config,
            )
        lead_turn = GraphTurn(
            turn=base_turn,
            staff_name=lead.name,
            staff_role=lead.role,
            content=lead_reasoning,
        )
        target_names = [n for n, _ in fanout_pairs]
        new_log.append(f"[Turn {base_turn}] {lead.name} → FANOUT {target_names}")
        stream_writer({
            "type": EventType.TURN_COMPLETE.value,
            "turn": lead_turn,
            "fanout_dispatch": True,
        })
        stream_writer({
            "type": EventType.FANOUT_START.value,
            "agent_name": lead.name,
            "targets": target_names,
        })

        prebuilt: dict[str, dict] = {}
        branches: list[tuple[GraphStaffDefinition, str]] = []
        for worker_name, task_text in fanout_pairs:
            worker = worker_by_name[worker_name]
            prebuilt[worker_name] = self._build_worker_chat_kwargs(
                worker=worker,
                task_text=task_text,
                state=state,
                llm=llm,
                meeting_id=meeting_id,
                project_id=project_id,
                graph_context_provider=graph_context_provider,
                graph_config=graph_config,
            )
            branches.append((worker, task_text))

        results = await run_fanout_wave(
            branches=branches,
            llm=llm,
            build_branch_chat_kwargs=lambda w, _t: prebuilt[w.name],
            semaphore=self._get_fanout_semaphore(),
            stream_writer=stream_writer,
            meeting_id=meeting_id,
            project_id=project_id,
            graph_context_provider=graph_context_provider,
            graph_config=graph_config,
            base_turn_number=base_turn,
            split_fn=None,
        )

        stream_writer({
            "type": EventType.FANOUT_COMPLETE.value,
            "agent_name": lead.name,
            "targets": target_names,
        })

        worker_turns = []
        for r in results:
            worker_turns.append(
                GraphTurn(
                    turn=r.turn,
                    staff_name=r.staff_name,
                    staff_role=r.staff_role,
                    content=r.content,
                )
            )
            snippet = r.content[:300] + ("..." if len(r.content) > 300 else "")
            new_log.append(f"[Turn {r.turn}] {r.staff_name} → Lead: {snippet}")

        # Lead synthesizes the wave's results, then emits one control action.
        synthesis_user = (
            "Your parallel wave returned these worker results:\n\n"
            + "\n\n".join(
                f"### {r.staff_name} (task: {r.task})\n{r.content}" for r in results
            )
        )
        # lead_system is lead.system_prompt (fixed) and FANOUT_SYNTHESIS_GUIDANCE
        # is a static constant, so synthesis_system stays stable across every
        # synthesis call for this lead — a second cacheable variant besides its
        # normal per-turn system prompt.
        synthesis_system = f"{lead_system}\n\n{FANOUT_SYNTHESIS_GUIDANCE}"
        synth_raw = await safe_chat_retry_empty(
            llm,
            staff_name=lead.name,
            system=synthesis_system,
            messages=[{"role": "user", "content": synthesis_user}],
        )
        raise_if_llm_failed(synth_raw)
        synth_reasoning, synth_action = self._split_reasoning_and_action(synth_raw)
        final_answer = self._extract_final_answer(synth_action)
        target_worker, next_task = self._extract_delegation(synth_action, [w.name for w in workers])

        synthesis_turn_number = base_turn + len(results) + 1
        record_turn_in_memory(
            meeting_id,
            staff_name=lead.name,
            turn=synthesis_turn_number,
            content=final_answer or synth_reasoning,
            kind="result" if final_answer else "decision",
        )
        if graph_context_provider and meeting_id:
            graph_context_provider.ingest_message(
                meeting_id=meeting_id,
                message_id=f"staff_member-{lead.name}-{uuid4().hex}",
                speaker=lead.name,
                content=synth_reasoning,
                config=graph_config,
            )
        synthesis_turn = GraphTurn(
            turn=synthesis_turn_number,
            staff_name=lead.name,
            staff_role=lead.role,
            content=synth_reasoning,
        )
        if target_worker and next_task:
            new_log.append(
                f"[Turn {synthesis_turn_number}] {lead.name} → {target_worker}: {next_task}"
            )
        stream_writer({
            "type": EventType.TURN_COMPLETE.value,
            "turn": synthesis_turn,
            "delegate_to": target_worker,
            "final_answer_reached": bool(final_answer),
        })

        # staff_states already carries the lead's fan-out-decision turn
        # (appended by lead_node before this call); add each worker's own
        # exchange and the lead's synthesis exchange.
        new_staff_states = staff_states
        for r in results:
            new_staff_states = append_user_turn(new_staff_states, r.staff_name, r.task)
            new_staff_states = append_assistant_turn(new_staff_states, r.staff_name, r.content)
        new_staff_states = append_user_turn(new_staff_states, lead.name, synthesis_user)
        new_staff_states = append_assistant_turn(new_staff_states, lead.name, synth_reasoning)

        return {
            **state,
            "input": final_answer or state["input"],
            "turns": [*turns, lead_turn, *worker_turns, synthesis_turn],
            "delegation_log": new_log,
            "staff_states": new_staff_states,
            "current_task": next_task or "",
            "current_worker": target_worker,
            "final_answer_reached": bool(final_answer),
            "final_response": final_answer or synth_reasoning,
            "final_staff": lead.name,
            "rounds": base_turn,
        }
