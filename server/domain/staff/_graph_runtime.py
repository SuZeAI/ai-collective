"""Shared runtime helpers for the LangGraph multi-staff_member topologies.

Centralizes two cross-cutting concerns that every topology (ring, supervisor,
tree, mesh, sequential orchestrator) needs:

1. A sane ``recursion_limit`` derived from ``max_rounds`` so that long but
   legitimate runs do not trip LangGraph's default 25-superstep ceiling.
2. Driving a compiled graph to completion in a way that still returns the most
   recent accumulated state if the recursion limit is hit or a node raises,
   instead of discarding the whole run.
"""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass, field
from typing import Any, Callable
from uuid import uuid4
import logging

try:  # pragma: no cover - import shape differs slightly across langgraph versions
    from langgraph.errors import GraphRecursionError
except Exception:  # pragma: no cover
    class GraphRecursionError(Exception):  # type: ignore[no-redef]
        """Fallback if langgraph does not expose GraphRecursionError."""

from server.api.settings import settings
from server.app.ports.staff_graph import (
    GraphContextProvider,
    GraphRunResult,
    GraphStaffDefinition,
    GraphTurn,
)
from server.domain.event.schema import EventType
from server.domain.memory.knowledge_graph import GraphContextConfig
from server.domain.staff.token_budget import TokenBudgetResult, apply_context_token_budget

logger = logging.getLogger(__name__)

# Per-LLM-call wall-clock timeout and transient-failure retry policy.
LLM_TIMEOUT_SECONDS = max(10, settings.staff.llm_timeout_seconds)
LLM_MAX_RETRIES = max(0, settings.staff.llm_max_retries)
_LLM_RETRY_BASE_DELAY = 1.5

# llm.chat() runs its whole tool-calling loop under one wall-clock budget, and
# the ask_user tool can legitimately block inside that loop for up to
# ask_user_timeout_seconds waiting on a human. If the outer budget were just
# LLM_TIMEOUT_SECONDS, any unanswered ask_user would always be killed by this
# timeout (mislabeled as a slow model, and treated as terminal/non-retryable)
# long before ask_user's own timeout could return its graceful fallback
# message. Widen the outer budget to cover that case.
LLM_CALL_TIMEOUT_SECONDS = max(LLM_TIMEOUT_SECONDS, settings.staff.ask_user_timeout_seconds)

# How many fan-out branches (named staff dispatched in one parallel wave) may
# run concurrently. Falls back to the subagent cap so a single env var can tune
# both layers; both are independent semaphores, so the worst-case simultaneous
# llm.chat count is MESH_FANOUT_MAX_CONCURRENT * SUBAGENT_MAX_CONCURRENT.
MESH_FANOUT_MAX_CONCURRENT = max(
    1,
    settings.staff.mesh_fanout_max_concurrent or settings.staff.subagent_max_concurrent,
)

# How many subagents a single staff_member's `task` tool may run concurrently.
SUBAGENT_MAX_CONCURRENT = max(1, settings.staff.subagent_max_concurrent)


async def safe_chat(llm: Any, *, staff_name: str = "", **chat_kwargs: Any) -> str:
    """Call ``llm.chat`` with a bounded timeout and transient-failure retries.

    A single provider hiccup (timeout, 429, 5xx) must not abort an entire
    multi-staff_member run. On exhausting retries this returns a human-readable error
    string (used as the staff_member's turn content) instead of raising, so the graph
    can continue or terminate gracefully and still surface partial results.
    """
    # Attribute every token recorded during this call to the AI staff member
    # making it, so the cost-monitoring page can break spend down per staff_member.
    # contextvars are per-asyncio-task, so concurrent fan-out branches stay isolated.
    from server.infra.llm.usage_tracker import current_usage_staff

    token = current_usage_staff.set(staff_name or "")
    try:
        last_exc: Exception | None = None
        for attempt in range(LLM_MAX_RETRIES + 1):
            try:
                async with asyncio.timeout(LLM_CALL_TIMEOUT_SECONDS):
                    return await llm.chat(**chat_kwargs)
            except asyncio.CancelledError:
                raise
            except TimeoutError:
                # llm.chat() runs a multi-round tool-calling loop internally, and
                # some of those rounds may already have invoked side-effecting
                # tools (Slack/Discord sends, sandbox writes, social posts, ...)
                # before the wall-clock timeout fired. Retrying would risk
                # replaying those side effects, so a timeout is terminal here —
                # unlike a pre-tool-loop connection/429/5xx, which is safe to retry.
                logger.exception(
                    "llm.chat timed out (staff_member=%s) after %ss; not retrying "
                    "to avoid re-running tool calls already made this attempt",
                    staff_name, LLM_CALL_TIMEOUT_SECONDS,
                )
                return f"[error] The model call timed out after {LLM_CALL_TIMEOUT_SECONDS}s."
            except Exception as exc:  # noqa: BLE001 - provider errors are heterogeneous
                last_exc = exc
                if attempt < LLM_MAX_RETRIES:
                    delay = _LLM_RETRY_BASE_DELAY * (2 ** attempt)
                    logger.warning(
                        "llm.chat failed (staff_member=%s attempt=%d/%d): %s; retrying in %.1fs",
                        staff_name, attempt + 1, LLM_MAX_RETRIES + 1, exc, delay,
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.exception(
                        "llm.chat failed permanently (staff_member=%s) after %d attempts",
                        staff_name, LLM_MAX_RETRIES + 1,
                    )
        return f"[error] The model call failed after retries: {last_exc}"
    finally:
        current_usage_staff.reset(token)


EMPTY_RESPONSE_NUDGE = (
    "Your previous response was empty — no reasoning and no content. "
    "Please answer this turn now with your actual output."
)
EMPTY_RESPONSE_MAX_RETRIES = 3


async def safe_chat_retry_empty(
    llm: Any,
    *,
    staff_name: str = "",
    nudge_text: str = EMPTY_RESPONSE_NUDGE,
    max_retries: int = EMPTY_RESPONSE_MAX_RETRIES,
    **chat_kwargs: Any,
) -> str:
    """``safe_chat`` plus a retry loop for empty/blank replies.

    ``safe_chat`` already retries transient provider failures; this covers the
    separate case of a *successful* call whose content is blank (the staff_member
    "said nothing"). Each retry appends ``nudge_text`` as a user turn so the
    staff_member sees its empty reply was rejected, up to ``max_retries`` times,
    then gives up and returns the last (empty) output so callers proceed
    exactly as they would for any other turn content.

    Requires a ``messages`` kwarg (a list of role/content dicts) to append the
    nudge to; callers that don't pass one (e.g. a bespoke ``user``/``system``
    chat shape) get a single plain ``safe_chat`` call with no retry.
    """
    messages = chat_kwargs.pop("messages", None)
    if messages is None:
        return await safe_chat(llm, staff_name=staff_name, **chat_kwargs)
    turn_messages = list(messages)
    output = ""
    for attempt in range(max_retries + 1):
        output = await safe_chat(llm, staff_name=staff_name, messages=turn_messages, **chat_kwargs)
        if output.strip() or output.startswith("[error]"):
            return output
        if attempt < max_retries:
            logger.warning(
                "llm.chat returned an empty response (staff_member=%s, attempt=%d/%d); retrying with a nudge",
                staff_name, attempt + 1, max_retries + 1,
            )
            turn_messages = [*turn_messages, {"role": "user", "content": nudge_text}]
    logger.error(
        "llm.chat kept returning empty responses (staff_member=%s) after %d attempts — giving up",
        staff_name, max_retries + 1,
    )
    return output


def raise_if_llm_failed(output: str) -> None:
    """Stop a serial (chained) run when a staff's turn was a safe_chat() failure.

    safe_chat() intentionally returns an "[error] ..." string instead of
    raising (see its docstring) — but in a serial topology (sequential/ring/
    tree/supervisor's routing, mesh's serial hops) that string becomes the
    *next* staff's whole input, so the failure silently cascades as if it
    were real content instead of stopping the run. Call this right after a
    serial safe_chat() to turn it into a clean run-ending error instead.

    Do NOT call this from the parallel fan-out path (run_fanout_wave) — there,
    each branch's error is deliberately non-fatal so sibling branches and the
    coordinator's synthesis still get a chance to run.
    """
    if output.startswith("[error] The model call "):
        raise RuntimeError(output)


# How often a held run re-checks whether the user resumed it.
PAUSE_POLL_SECONDS = 0.25


async def wait_while_paused(
    *,
    meeting_id: str | None,
    stream_writer: Any = None,
    staff_name: str = "",
) -> None:
    """Human-in-the-loop hold gate, called at the start of every staff_member node.

    When the user interrupts a run (``POST /llm/staff_member-graph/pause``), the
    current staff_member finishes its turn and the *next* node parks here until the
    user resumes (or stops) the run. ``run_paused``/``run_resumed`` events let
    the UI show the hold state. Cancellation or unregistration releases the
    wait so background graph tasks can never hang on a dead run.
    """
    if not meeting_id:
        return
    from server.infra import task_run_registry

    if not task_run_registry.is_paused(meeting_id):
        return
    if stream_writer:
        stream_writer({
            "type": EventType.RUN_PAUSED.value,
            "agent_name": staff_name,
        })
    polls = 0
    heartbeat_every = max(1, int(15 / PAUSE_POLL_SECONDS))  # ~15s
    max_polls = max(1, int(settings.staff.pause_timeout_seconds / PAUSE_POLL_SECONDS))
    while task_run_registry.is_paused(meeting_id):
        await asyncio.sleep(PAUSE_POLL_SECONDS)
        polls += 1
        if polls >= max_polls:
            # Abandoned pause — auto-resume so this run stops permanently
            # occupying a task-queue concurrency slot.
            logger.warning(
                "Run %s auto-resumed after sitting paused for %ds with no response",
                meeting_id, settings.staff.pause_timeout_seconds,
            )
            task_run_registry.signal_resume(meeting_id)
            break
        # Heartbeat so idle SSE connections survive proxy timeouts during a
        # long hold. The UI treats repeated run_paused events as idempotent.
        if stream_writer and polls % heartbeat_every == 0:
            stream_writer({
                "type": EventType.RUN_PAUSED.value,
                "agent_name": staff_name,
                "heartbeat": True,
            })
    if stream_writer:
        stream_writer({
            "type": EventType.RUN_RESUMED.value,
            "agent_name": staff_name,
        })


def drain_human_guidance(
    *,
    meeting_id: str | None,
    stream_writer: Any = None,
    graph_context_provider: Any = None,
    graph_config: Any = None,
) -> str:
    """Human-in-the-loop: consume user messages posted while the run streams.

    Every topology calls this at the start of an staff_member node, before building
    context. Pending messages (queued via ``POST /llm/staff_member-graph/interject``)
    are:

    1. ingested into the knowledge-graph context as ``user`` messages so they
       persist for all later turns and retrieval,
    2. announced on the stream (``user_message_injected``) so the UI can mark
       them as delivered,
    3. returned as a formatted high-priority block the node appends verbatim
       to the current staff_member's prompt — guaranteeing the *next* staff_member sees the
       guidance even if graph retrieval would miss it.

    Returns an empty string when there is nothing pending.
    """
    if not meeting_id:
        return ""
    # Local import: the registry lives in infra; nodes already cross
    # this boundary for sandbox/session helpers, and importing lazily keeps
    # domain importable without the full app wiring (e.g. in unit tests).
    from server.infra import task_run_registry

    pending = task_run_registry.drain_user_messages(meeting_id)
    if not pending:
        return ""

    if graph_context_provider:
        for msg in pending:
            try:
                graph_context_provider.ingest_message(
                    meeting_id=meeting_id,
                    message_id=f"user-interject-{msg['id']}",
                    speaker="user",
                    content=msg["content"],
                    config=graph_config,
                )
            except Exception:  # noqa: BLE001 - guidance must still reach the prompt
                logger.exception("Failed to ingest mid-run user message into graph context")

    if stream_writer:
        stream_writer({
            "type": EventType.USER_MESSAGE_INJECTED.value,
            "message_ids": [msg["id"] for msg in pending],
            "messages": [msg["content"] for msg in pending],
        })

    lines = "\n".join(f"- {msg['content']}" for msg in pending)
    return (
        "[Human guidance received mid-run — the user interjected while staff were "
        "working. Treat these as updated instructions that take priority over "
        "earlier context]:\n" + lines
    )


@dataclass(slots=True)
class TurnMessages:
    """One agent turn's message chain — the ``messages`` state LangChain's
    ``create_agent`` consumes (see
    https://reference.langchain.com/python/langchain/agents/middleware/types/AgentState).

    Keeping ``context`` and ``input_text`` as separate fields (instead of one
    flattened string) is what lets every topology's fixed ``staff_member.system_prompt``
    stay byte-identical every call — see ``build_turn_messages`` — instead of
    getting fused with the per-turn-changing routing/graph/memory text, which
    is what actually breaks both the compiled-agent memo (agent_builder.py)
    and upstream provider prompt-prefix caching.

    ``context`` (routing guidance, retrieved graph context, working memory,
    human-in-the-loop guidance, history windows, ...) is everything that varies
    turn to turn; it is joined into one "user"-role message that precedes the
    actual turn input. It is deliberately NOT "system" — ``create_agent``
    already prepends its own single fixed SystemMessage from
    ``system_prompt``, and stacking a second "system" message on top of it
    every turn is exactly the kind of per-turn system drift this class exists
    to avoid (some providers, e.g. Gemini, only expect one system
    instruction). It is also NOT "assistant" (that would misattribute this
    content as something the model itself said in an earlier turn, corrupting
    its own history) nor "tool" (a ToolMessage must reference a real preceding
    tool_call_id, which this has none of — providers validate that pairing and
    would reject a floating one).
    ``input_text`` is the actual task/report/query for this turn and always
    lands as the final "user"-role message, never truncated.
    """

    input_text: str
    context: list[str] = field(default_factory=list)

    def add_context(self, content: str) -> None:
        if content:
            self.context.append(content)

    def as_messages(self) -> list[dict[str, str]]:
        context_text = "\n\n".join(self.context)
        messages: list[dict[str, str]] = []
        if context_text:
            messages.append({"role": "user", "content": context_text})
        messages.append({"role": "user", "content": self.input_text})
        return messages


def build_turn_messages(
    *,
    llm: Any,
    system_prompt: str,
    context_text: str,
    input_text: str,
    max_context_tokens: int,
    reserved_output_tokens: int,
) -> tuple[TurnMessages, TokenBudgetResult]:
    """Budget-trim ``context_text`` and wrap it with ``input_text`` into a
    ``TurnMessages`` chain. ``system_prompt`` is the staff_member's fixed role
    instructions — callers must pass it through to ``chat(system=...)``
    unchanged (see ``TurnMessages`` docstring for why); only ``context_text``
    is trimmed here (tail kept — see token_budget._truncate_by_token_budget),
    ``input_text`` is never truncated.
    """
    budget_result = apply_context_token_budget(
        llm=llm,
        system_prompt=system_prompt,
        user_input=context_text,
        max_context_tokens=max_context_tokens,
        reserved_output_tokens=reserved_output_tokens,
    )
    turn = TurnMessages(input_text=input_text)
    turn.add_context(budget_result.text)
    return turn, budget_result


# ------------------------------------------------------------------ #
# Shared working memory (anti-context-loss layer)                       #
#                                                                       #
# Every helper below is best-effort: working memory must never break a #
# run. See server/domain/memory/working_memory.py for the model and   #
# docs/agent-memory.md for the design.                                  #
# ------------------------------------------------------------------ #

def ensure_working_memory(meeting_id: str | None, task: str) -> None:
    """Idempotently record the run's original task in working memory."""
    if not meeting_id:
        return
    try:
        from server.infra import working_memory_store

        working_memory_store.set_task(meeting_id, task)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to init working memory for %s", meeting_id)


def working_memory_block(meeting_id: str | None) -> str:
    """Render the shared working-memory digest for prompt injection.

    Inject it *early* in the user context (right after human guidance) so it
    survives tail-truncation by the token budget. Returns '' when memory is
    disabled, empty, or unavailable.
    """
    if not meeting_id:
        return ""
    try:
        from server.infra import working_memory_store

        return working_memory_store.render_digest(meeting_id)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to render working memory for %s", meeting_id)
        return ""


def record_turn_in_memory(
    meeting_id: str | None,
    *,
    staff_name: str,
    turn: int,
    content: str,
    kind: str = "result",
) -> None:
    """Auto-capture a completed turn into working memory (compressed note).

    This is the safety net that keeps context alive when windowed logs roll
    over or the token budget truncates: the note (or its compacted summary
    line) keeps flowing to every later staff_member via the digest.
    """
    if not meeting_id or not (content or "").strip():
        return
    try:
        from server.infra import working_memory_store

        working_memory_store.record_note(
            meeting_id, staff=staff_name, content=content, kind=kind, turn=turn,
        )
    except Exception:  # noqa: BLE001
        logger.exception("Failed to record turn in working memory for %s", meeting_id)


def record_guidance_in_memory(meeting_id: str | None, guidance: str) -> None:
    """Pin mid-run human guidance so no later staff_member can lose it."""
    if not meeting_id or not (guidance or "").strip():
        return
    try:
        from server.infra import working_memory_store

        working_memory_store.record_note(
            meeting_id, staff="user", content=guidance, kind="guidance", pinned=True,
        )
    except Exception:  # noqa: BLE001
        logger.exception("Failed to record guidance in working memory for %s", meeting_id)


def memory_toolkit_tools(meeting_id: str | None, staff_name: str) -> list[Any]:
    """Build the default memory tools for an staff_member ([] when unavailable)."""
    if not meeting_id:
        return []
    try:
        from server.domain.memory.working_memory import WORKING_MEMORY_ENABLED
        from server.domain.tools.memory_tool import MemoryToolkit

        if not WORKING_MEMORY_ENABLED:
            return []
        return MemoryToolkit(
            meeting_id=meeting_id, staff_name=staff_name
        ).get_tools()
    except Exception:  # noqa: BLE001
        logger.exception("Failed to build memory toolkit for %s", meeting_id)
        return []


def attach_meeting_sandbox(
    bound_tools: list[Any],
    *,
    meeting_id: str | None,
    staff_name: str,
) -> bool:
    """If this conversation has files, scope the run to its shared sandbox.

    When the chat has at least one file (a user upload or an staff_member-written file):
      1. Binds the sandbox contextvar to the deterministic conversation-scoped
         thread id (overwriting any random per-turn id set earlier), so every
         staff_member in the chat resolves to the *same* shared workspace and can
         exchange files.
      2. Appends ``SandboxToolkit`` tools to *bound_tools* (idempotent — skips if
         ``sandbox_bash`` is already present from a bound skill).

    Returns ``True`` when sandbox tools were attached. Best-effort: any failure
    logs and returns ``False`` so a run is never broken by sandbox wiring. Must
    be called AFTER ``new_thread_id`` (so the conv id wins the contextvar) and
    BEFORE constructing ``TaskToolkit`` (so subagents inherit the sandbox tools).
    """
    if not meeting_id:
        return False
    try:
        from server.infra.llm.sandbox_middleware import (
            ensure_meeting_sandbox,
        )

        cs = ensure_meeting_sandbox(meeting_id)
        if cs is None or not cs.has_files:
            return False

        from server.infra.sandbox.sandbox_session import use_meeting_thread

        use_meeting_thread(meeting_id)

        existing = {getattr(t, "name", "") for t in bound_tools}
        if "sandbox_bash" not in existing:
            from server.domain.tools.sandbox_tools import SandboxToolkit

            bound_tools.extend(SandboxToolkit(session_id=cs.thread_id).get_tools())
        # Document understanding (extract pdf/excel/csv text, read tables, fetch URLs,
        # describe images) — available whenever a chat has files.
        if "document_extract_text" not in existing:
            from server.domain.tools.document_tools import DocumentToolkit

            bound_tools.extend(DocumentToolkit().get_tools())
        return True
    except Exception:  # noqa: BLE001
        logger.exception("attach_meeting_sandbox failed for %s", meeting_id)
        return False


def build_agent_tools(staff: GraphStaffDefinition, *, meeting_id: str | None) -> list[Any]:
    """Build the tool list every topology binds before calling the LLM for a
    turn: this staff member's skill tools + the default human-in-the-loop
    ask-user tool + shared working-memory tools + the conversation sandbox
    (when files are present).

    Every topology (ring/orchestrator/tree/supervisor/mesh) built this exact
    sequence inline; centralising it here is what keeps them from drifting
    out of sync (e.g. one topology forgetting the ask-user tool).

    Callers append any topology-specific tools afterwards (e.g. TaskToolkit
    for subagent delegation — whether that applies varies per topology/role,
    so it deliberately stays out of this helper).
    """
    bound_tools: list[Any] = []
    if staff.tools:
        for toolkit in staff.tools.values():
            bound_tools.extend(toolkit.get_tools())

    if meeting_id:
        from server.domain.tools.ask_user import AskUserToolkit

        # Capture the real stream writer here, while still inside the outer
        # graph node's own astream() context — llm.chat() (base_langchain.py)
        # runs its tool-calling loop through a nested, non-streaming
        # staff.ainvoke() call, so ask_user calling get_stream_writer() itself
        # at tool-call time would silently resolve to a no-op writer scoped to
        # that disconnected inner run, and every question would go unseen by
        # the frontend until it quietly timed out.
        stream_writer = None
        try:
            from langgraph.config import get_stream_writer

            stream_writer = get_stream_writer()
        except Exception:
            pass

        bound_tools.extend(
            AskUserToolkit(
                meeting_id=meeting_id, staff_name=staff.name, stream_writer=stream_writer
            ).get_tools()
        )
    bound_tools.extend(memory_toolkit_tools(meeting_id, staff.name))

    attach_meeting_sandbox(bound_tools, meeting_id=meeting_id, staff_name=staff.name)

    return bound_tools


def build_bound_tools(
    staff: GraphStaffDefinition, *, meeting_id: str | None, llm: Any
) -> list[Any]:
    """``build_agent_tools`` + ``attach_subagent_toolkit`` for one staff member's turn.

    Every topology (ring/orchestrator/tree/supervisor/mesh) repeats this exact
    two-call sequence for every node and fan-out branch; centralising it here
    is what keeps that pairing from drifting apart.
    """
    bound_tools = build_agent_tools(staff, meeting_id=meeting_id)
    attach_subagent_toolkit(bound_tools, staff, llm=llm)
    return bound_tools


def attach_subagent_toolkit(
    bound_tools: list[Any], staff: GraphStaffDefinition, *, llm: Any
) -> list[Any]:
    """If ``staff`` has subagent delegation enabled, append the `task` tool
    (TaskToolkit) so it can delegate to subagents that inherit ``bound_tools``
    minus `task`.

    Every topology (ring/orchestrator/tree/mesh) wired this identical block
    inline; centralising it here is what keeps a future topology from
    forgetting it or a shared field (e.g. max_concurrent) drifting out of
    sync between them. Mutates and returns ``bound_tools`` for chaining.
    """
    if staff.subagent_enabled:
        from server.domain.tools.task import TaskToolkit

        task_toolkit = TaskToolkit(
            llm=llm,
            subagent_tools=list(bound_tools),
            max_concurrent=SUBAGENT_MAX_CONCURRENT,
            parent_staff_name=staff.name,
        )
        bound_tools.extend(task_toolkit.get_tools())
    return bound_tools


def uploads_hint(meeting_id: str | None) -> str:
    """One-line note listing files available in the shared workspace, or ''.

    Prepended to an staff_member's input so it knows files exist and which tools to use.
    """
    if not meeting_id:
        return ""
    try:
        from server.infra.sandbox.thread_files import list_thread_files

        names = [f.get("filename", "") for f in list_thread_files(meeting_id)]
        names = [n for n in names if n]
        if not names:
            return ""
        listing = ", ".join(names[:20])
        more = "" if len(names) <= 20 else f" (+{len(names) - 20} more)"
        return (
            f"[Files available in ./uploads/: {listing}{more} — use sandbox_ls / "
            f"sandbox_read_file to inspect them, sandbox_write_file to share outputs.]\n\n"
        )
    except Exception:  # noqa: BLE001
        return ""


def assemble_run_result(final_state: dict[str, Any], error: str | None) -> GraphRunResult:
    """Build the GraphRunResult a topology's run() returns from its final graph
    state — turns/final_response/final_staff/rounds all read straight off
    state, falling back to the last turn where a field wasn't set.

    Not used by mesh: it derives final_staff from turns[-1].staff_name instead
    of state["final_staff"], which isn't guaranteed equivalent — that's a
    real (pre-existing) divergence, not something to paper over here.
    """
    turns = list(final_state.get("turns", []))
    return GraphRunResult(
        turns=turns,
        final_response=final_state.get("final_response") or (turns[-1].content if turns else ""),
        final_staff=final_state.get("final_staff"),
        rounds=int(final_state.get("rounds", len(turns))),
        error=error,
    )


def ingest_user_message(
    user_input: str,
    meeting_id: str | None,
    graph_context_provider: GraphContextProvider | None,
    graph_config: GraphContextConfig | None,
) -> None:
    """Record the user's opening message in the knowledge graph, if wired up."""
    if graph_context_provider and meeting_id:
        graph_context_provider.ingest_message(
            meeting_id=meeting_id,
            message_id=f"user-{uuid4().hex}",
            speaker="user",
            content=user_input,
            config=graph_config,
        )


def init_sandbox_thread(staff_name: str, meeting_id: str | None) -> tuple[str, str]:
    """Allocate this turn's sandbox thread id/workspace, creating the dir now."""
    from server.infra.sandbox.sandbox_session import get_thread_workspace, new_thread_id

    sandbox_thread_id = new_thread_id(staff_name=staff_name, task_id=meeting_id)
    sandbox_workspace = get_thread_workspace(settings.sandbox_workspace or "", sandbox_thread_id)
    return sandbox_thread_id, sandbox_workspace


def recursion_config(max_rounds: int) -> dict[str, Any]:
    """Build a LangGraph config whose recursion limit honors ``max_rounds``.

    LangGraph defaults to 25 supersteps. Topologies that loop until
    ``rounds >= max_rounds`` would raise ``GraphRecursionError`` mid-run for any
    ``max_rounds`` near/above that. We allow generous headroom for hub bounces
    (mesh/supervisor route back through a coordinator) and the START edge.
    """
    return {"recursion_limit": max(25, int(max_rounds) * 2 + 10)}


# ------------------------------------------------------------------ #
# Parallel fan-out (topology-level multi-worker)                        #
#                                                                       #
# Lets a coordinator (mesh hub / supervisor lead) dispatch ONE wave of  #
# work to several NAMED staff that run concurrently, then synthesize.  #
# Concurrency is asyncio.gather inside a single graph node, so the node #
# still returns exactly one state update per channel — no state-reducer #
# changes and no InvalidUpdateError that native fan-out edges would hit.#
# Mirrors the proven task.py subagent semaphore pattern.                #
# ------------------------------------------------------------------ #

FANOUT_SYNTHESIS_GUIDANCE = """
## PARALLEL WAVE SYNTHESIS
You dispatched a parallel wave: several specialists worked concurrently on the
sub-tasks below and reported back. Your job now:
1. Merge their findings into one coherent result, attributing key points to the
   staff_member that produced them.
2. Resolve any disagreements explicitly; note unresolved gaps.
3. Do NOT simply concatenate — integrate and de-duplicate.
4. Then emit exactly ONE control action at the very end (route to the next
   staff_member, dispatch another wave, or end), following the control syntax above.
"""


@dataclass
class FanoutBranchResult:
    """Outcome of one staff_member in a parallel fan-out wave."""

    staff_name: str
    staff_role: str
    task: str
    content: str
    error: bool = False
    turn: int = 0


def split_reasoning_and_action(
    message: str, control_block_re: "re.Pattern[str]"
) -> tuple[str, str]:
    """Split model output into user-visible reasoning and machine-readable action blocks.

    Shared by every topology (mesh/supervisor/tree) — each defines its own
    ``_CONTROL_BLOCK_RE`` (the accepted tag set differs per topology) but the
    split logic itself is identical.
    """
    if not message:
        return "", ""
    action_blocks = [m.group(0).strip() for m in control_block_re.finditer(message)]
    action_payload = "\n".join(block for block in action_blocks if block).strip()
    reasoning = control_block_re.sub("", message)
    reasoning = re.sub(r"\n{3,}", "\n\n", reasoning).strip()
    return reasoning, action_payload


def parse_fanout_pairs(
    action_payload: str,
    names: list[str],
    exclude_name: str,
    *,
    fanout_re: "re.Pattern[str]",
    pair_re: "re.Pattern[str]",
    max_concurrent: int = MESH_FANOUT_MAX_CONCURRENT,
) -> list[tuple[str, str]]:
    """Parse a `<FANOUT>` block into ordered (name, task) pairs.

    Shared by every topology that supports parallel dispatch (mesh hub,
    supervisor lead). Returns [] (caller falls back to single-routing/
    delegation) unless at least two distinct, valid, non-excluded targets
    are found.
    """
    match = fanout_re.search(action_payload)
    if not match:
        return []

    normalized = {name.lower(): name for name in names}
    pairs: list[tuple[str, str]] = []
    seen: set[str] = set()
    for raw_name, raw_task in pair_re.findall(match.group(1)):
        candidate = raw_name.strip().strip("`\"'<>")
        target = normalized.get(candidate.lower())
        if not target or target.lower() == exclude_name.lower() or target in seen:
            continue
        seen.add(target)
        pairs.append((target, raw_task.strip()))

    if len(pairs) < 2:
        return []
    # Respect the advertised cap so the model cannot over-fan.
    return pairs[:max_concurrent]


def get_fanout_semaphore(owner: object) -> asyncio.Semaphore:
    """Lazily create a wave-concurrency semaphore cached on ``owner`` (an
    orchestrator instance), bound to the active event loop."""
    sem = getattr(owner, "_fanout_semaphore", None)
    if sem is None:
        sem = asyncio.Semaphore(MESH_FANOUT_MAX_CONCURRENT)
        owner._fanout_semaphore = sem
    return sem


async def run_fanout_wave(
    *,
    branches: list[tuple[GraphStaffDefinition, str]],
    llm: Any,
    build_branch_chat_kwargs: Callable[[GraphStaffDefinition, str], dict],
    semaphore: asyncio.Semaphore,
    stream_writer: Any = None,
    meeting_id: str | None = None,
    graph_context_provider: Any = None,
    graph_config: Any = None,
    base_turn_number: int,
    split_fn: Callable[[str], tuple[str, str]] | None = None,
) -> list[FanoutBranchResult]:
    """Run ``branches`` ((staff_def, task_text) pairs) concurrently.

    Each branch calls ``safe_chat`` (which never raises — it returns an
    ``[error] ...`` string on failure) under ``semaphore`` so at most N run at
    once. ``build_branch_chat_kwargs`` is supplied by the caller because mesh
    and supervisor assemble context/prompt/tools differently.

    Concurrency is confined to the ``llm.chat`` calls. Turn numbering, working
    memory recording, knowledge-graph ingestion and ``TURN_COMPLETE`` events are
    done *after* the gather, sequentially in branch order, so numbering is
    deterministic and the (not coroutine-safe) graph provider is never raced.

    Returns one ``FanoutBranchResult`` per branch, in the input order, with
    ``turn`` assigned as ``base_turn_number + i`` (1-based).
    """

    async def _run_branch(staff_def: GraphStaffDefinition, task_text: str) -> FanoutBranchResult:
        name = staff_def.name
        # Must happen inside this branch's own coroutine (not in the caller's
        # sequential pre-build loop): asyncio.gather snapshots each branch's
        # context independently when it schedules the Task below, so a thread_id
        # set here is isolated to this branch and never bleeds into siblings.
        init_sandbox_thread(name, meeting_id)
        if stream_writer:
            stream_writer({
                "type": EventType.AGENT_TURN_START.value,
                "agent_name": name,
                "staff_role": staff_def.role,
                "parallel": True,
            })
            stream_writer({
                "type": EventType.LLM_REQUEST_START.value,
                "agent_name": name,
                "parallel": True,
            })
        async with semaphore:
            chat_kwargs = build_branch_chat_kwargs(staff_def, task_text)
            raw = await safe_chat_retry_empty(llm, staff_name=name, **chat_kwargs)
        if stream_writer:
            stream_writer({
                "type": EventType.LLM_RESPONSE_COMPLETE.value,
                "agent_name": name,
                "response_length": len(raw),
                "parallel": True,
            })
        content, _ = split_fn(raw) if split_fn else (raw, "")
        return FanoutBranchResult(
            staff_name=name,
            staff_role=staff_def.role,
            task=task_text,
            content=content,
            error=raw.startswith("[error]"),
        )

    raw_results = await asyncio.gather(
        *[_run_branch(a, t) for a, t in branches],
        return_exceptions=True,
    )

    results: list[FanoutBranchResult] = []
    for (staff_def, task_text), r in zip(branches, raw_results):
        if isinstance(r, asyncio.CancelledError):
            raise r
        if isinstance(r, BaseException):
            logger.exception("Fan-out branch '%s' crashed", staff_def.name, exc_info=r)
            r = FanoutBranchResult(
                staff_name=staff_def.name,
                staff_role=staff_def.role,
                task=task_text,
                content=f"[error] branch crashed: {r}",
                error=True,
            )
        results.append(r)

    # Post-gather, sequential: deterministic numbering + recording + streaming.
    for offset, res in enumerate(results, start=1):
        res.turn = base_turn_number + offset
        record_turn_in_memory(
            meeting_id,
            staff_name=res.staff_name,
            turn=res.turn,
            content=res.content,
            kind="result",
        )
        if graph_context_provider and meeting_id and not res.error:
            try:
                graph_context_provider.ingest_message(
                    meeting_id=meeting_id,
                    message_id=f"staff_member-{res.staff_name}-{uuid4().hex}",
                    speaker=res.staff_name,
                    content=res.content,
                    config=graph_config,
                )
            except Exception:  # noqa: BLE001 - ingestion must not break the wave
                logger.exception("Fan-out ingest failed for %s", res.staff_name)
        if stream_writer:
            stream_writer({
                "type": EventType.TURN_COMPLETE.value,
                "turn": GraphTurn(
                    turn=res.turn,
                    staff_name=res.staff_name,
                    staff_role=res.staff_role,
                    content=res.content,
                ),
                "parallel": True,
            })
    return results


async def run_to_final_state(graph: Any, initial: dict, max_rounds: int) -> tuple[dict, str | None]:
    """Run ``graph`` to completion and return its final state.

    Uses values-mode streaming so the latest state snapshot is retained: if the
    recursion limit is reached or a node raises, the best partial state is
    returned rather than losing every turn produced so far. The second
    element of the returned tuple is non-None when that partial-state
    fallback happened, so callers can tell a crash apart from a clean finish
    instead of it looking identical to success.
    """
    config = recursion_config(max_rounds)
    last_state: dict = initial
    error: str | None = None
    try:
        async for state in graph.astream(initial, config=config, stream_mode="values"):
            if isinstance(state, dict):
                last_state = state
    except GraphRecursionError:
        error = f"Graph hit recursion limit (max_rounds={max_rounds})"
        logger.warning("%s; returning partial state.", error)
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
        logger.exception("Graph execution failed; returning partial state.")
    return last_state, error
