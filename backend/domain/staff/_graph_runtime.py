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
from dataclasses import dataclass
from typing import Any, Callable
from uuid import uuid4
import logging

try:  # pragma: no cover - import shape differs slightly across langgraph versions
    from langgraph.errors import GraphRecursionError
except Exception:  # pragma: no cover
    class GraphRecursionError(Exception):  # type: ignore[no-redef]
        """Fallback if langgraph does not expose GraphRecursionError."""

from backend.api.settings import settings
from backend.application.ports.staff_graph import GraphStaffDefinition, GraphTurn
from backend.domain.event.schema import EventType

logger = logging.getLogger(__name__)

# Per-LLM-call wall-clock timeout and transient-failure retry policy.
LLM_TIMEOUT_SECONDS = max(10, settings.staff.llm_timeout_seconds)
LLM_MAX_RETRIES = max(0, settings.staff.llm_max_retries)
_LLM_RETRY_BASE_DELAY = 1.5

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
    from backend.infrastructure.llm.usage_tracker import current_usage_staff

    token = current_usage_staff.set(staff_name or "")
    try:
        last_exc: Exception | None = None
        for attempt in range(LLM_MAX_RETRIES + 1):
            try:
                async with asyncio.timeout(LLM_TIMEOUT_SECONDS):
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
                    staff_name, LLM_TIMEOUT_SECONDS,
                )
                return f"[error] The model call timed out after {LLM_TIMEOUT_SECONDS}s."
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


# How often a held run re-checks whether the user resumed it.
PAUSE_POLL_SECONDS = 0.25


async def wait_while_paused(
    *,
    conversation_id: str | None,
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
    if not conversation_id:
        return
    from backend.infrastructure import task_run_registry

    if not task_run_registry.is_paused(conversation_id):
        return
    if stream_writer:
        stream_writer({
            "type": EventType.RUN_PAUSED.value,
            "agent_name": staff_name,
        })
    polls = 0
    heartbeat_every = max(1, int(15 / PAUSE_POLL_SECONDS))  # ~15s
    max_polls = max(1, int(settings.staff.pause_timeout_seconds / PAUSE_POLL_SECONDS))
    while task_run_registry.is_paused(conversation_id):
        await asyncio.sleep(PAUSE_POLL_SECONDS)
        polls += 1
        if polls >= max_polls:
            # Abandoned pause — auto-resume so this run stops permanently
            # occupying a task-queue concurrency slot.
            logger.warning(
                "Run %s auto-resumed after sitting paused for %ds with no response",
                conversation_id, settings.staff.pause_timeout_seconds,
            )
            task_run_registry.signal_resume(conversation_id)
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
    conversation_id: str | None,
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
    if not conversation_id:
        return ""
    # Local import: the registry lives in infrastructure; nodes already cross
    # this boundary for sandbox/session helpers, and importing lazily keeps
    # domain importable without the full app wiring (e.g. in unit tests).
    from backend.infrastructure import task_run_registry

    pending = task_run_registry.drain_user_messages(conversation_id)
    if not pending:
        return ""

    if graph_context_provider:
        for msg in pending:
            try:
                graph_context_provider.ingest_message(
                    conversation_id=conversation_id,
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


# ------------------------------------------------------------------ #
# Shared working memory (anti-context-loss layer)                       #
#                                                                       #
# Every helper below is best-effort: working memory must never break a #
# run. See backend/domain/memory/working_memory.py for the model and   #
# docs/AGENT_MEMORY.md for the design.                                  #
# ------------------------------------------------------------------ #

def ensure_working_memory(conversation_id: str | None, task: str) -> None:
    """Idempotently record the run's original task in working memory."""
    if not conversation_id:
        return
    try:
        from backend.infrastructure import working_memory_store

        working_memory_store.set_task(conversation_id, task)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to init working memory for %s", conversation_id)


def working_memory_block(conversation_id: str | None) -> str:
    """Render the shared working-memory digest for prompt injection.

    Inject it *early* in the user context (right after human guidance) so it
    survives tail-truncation by the token budget. Returns '' when memory is
    disabled, empty, or unavailable.
    """
    if not conversation_id:
        return ""
    try:
        from backend.infrastructure import working_memory_store

        return working_memory_store.render_digest(conversation_id)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to render working memory for %s", conversation_id)
        return ""


def record_turn_in_memory(
    conversation_id: str | None,
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
    if not conversation_id or not (content or "").strip():
        return
    try:
        from backend.infrastructure import working_memory_store

        working_memory_store.record_note(
            conversation_id, staff_member=staff_name, content=content, kind=kind, turn=turn,
        )
    except Exception:  # noqa: BLE001
        logger.exception("Failed to record turn in working memory for %s", conversation_id)


def record_guidance_in_memory(conversation_id: str | None, guidance: str) -> None:
    """Pin mid-run human guidance so no later staff_member can lose it."""
    if not conversation_id or not (guidance or "").strip():
        return
    try:
        from backend.infrastructure import working_memory_store

        working_memory_store.record_note(
            conversation_id, staff_member="user", content=guidance, kind="guidance", pinned=True,
        )
    except Exception:  # noqa: BLE001
        logger.exception("Failed to record guidance in working memory for %s", conversation_id)


def memory_toolkit_tools(conversation_id: str | None, staff_name: str) -> list[Any]:
    """Build the default memory tools for an staff_member ([] when unavailable)."""
    if not conversation_id:
        return []
    try:
        from backend.domain.memory.working_memory import WORKING_MEMORY_ENABLED
        from backend.domain.tools.memory_tool import MemoryToolkit

        if not WORKING_MEMORY_ENABLED:
            return []
        return MemoryToolkit(
            conversation_id=conversation_id, staff_name=staff_name
        ).get_tools()
    except Exception:  # noqa: BLE001
        logger.exception("Failed to build memory toolkit for %s", conversation_id)
        return []


def attach_conversation_sandbox(
    bound_tools: list[Any],
    *,
    conversation_id: str | None,
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
    if not conversation_id:
        return False
    try:
        from backend.infrastructure.llm.sandbox_middleware import (
            ensure_conversation_sandbox,
        )

        cs = ensure_conversation_sandbox(conversation_id)
        if cs is None or not cs.has_files:
            return False

        from backend.infrastructure.sandbox.sandbox_session import use_conversation_thread

        use_conversation_thread(conversation_id)

        existing = {getattr(t, "name", "") for t in bound_tools}
        if "sandbox_bash" not in existing:
            from backend.domain.tools.sandbox_tools import SandboxToolkit

            bound_tools.extend(SandboxToolkit(session_id=cs.thread_id).get_tools())
        # Document understanding (extract pdf/excel/csv text, read tables, fetch URLs,
        # describe images) — available whenever a chat has files.
        if "document_extract_text" not in existing:
            from backend.domain.tools.document_tools import DocumentToolkit

            bound_tools.extend(DocumentToolkit().get_tools())
        return True
    except Exception:  # noqa: BLE001
        logger.exception("attach_conversation_sandbox failed for %s", conversation_id)
        return False


def build_agent_tools(agent: GraphStaffDefinition, *, conversation_id: str | None) -> list[Any]:
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
    if agent.tools:
        for toolkit in agent.tools.values():
            bound_tools.extend(toolkit.get_tools())

    if conversation_id:
        from backend.domain.tools.ask_user import AskUserToolkit

        bound_tools.extend(
            AskUserToolkit(conversation_id=conversation_id, staff_name=agent.name).get_tools()
        )
    bound_tools.extend(memory_toolkit_tools(conversation_id, agent.name))

    attach_conversation_sandbox(bound_tools, conversation_id=conversation_id, staff_name=agent.name)

    return bound_tools


def attach_subagent_toolkit(
    bound_tools: list[Any], agent: GraphStaffDefinition, *, llm: Any
) -> list[Any]:
    """If ``agent`` has subagent delegation enabled, append the `task` tool
    (TaskToolkit) so it can delegate to subagents that inherit ``bound_tools``
    minus `task`.

    Every topology (ring/orchestrator/tree/mesh) wired this identical block
    inline; centralising it here is what keeps a future topology from
    forgetting it or a shared field (e.g. max_concurrent) drifting out of
    sync between them. Mutates and returns ``bound_tools`` for chaining.
    """
    if agent.subagent_enabled:
        from backend.domain.tools.task import TaskToolkit

        task_toolkit = TaskToolkit(
            llm=llm,
            subagent_tools=list(bound_tools),
            max_concurrent=SUBAGENT_MAX_CONCURRENT,
            parent_staff_name=agent.name,
        )
        bound_tools.extend(task_toolkit.get_tools())
    return bound_tools


def uploads_hint(conversation_id: str | None) -> str:
    """One-line note listing files available in the shared workspace, or ''.

    Prepended to an staff_member's input so it knows files exist and which tools to use.
    """
    if not conversation_id:
        return ""
    try:
        from backend.infrastructure.sandbox.thread_files import list_thread_files

        names = [f.get("filename", "") for f in list_thread_files(conversation_id)]
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


async def run_fanout_wave(
    *,
    branches: list[tuple[GraphStaffDefinition, str]],
    llm: Any,
    build_branch_chat_kwargs: Callable[[GraphStaffDefinition, str], dict],
    semaphore: asyncio.Semaphore,
    stream_writer: Any = None,
    conversation_id: str | None = None,
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
            raw = await safe_chat(llm, staff_name=name, **chat_kwargs)
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
            conversation_id,
            staff_name=res.staff_name,
            turn=res.turn,
            content=res.content,
            kind="result",
        )
        if graph_context_provider and conversation_id and not res.error:
            try:
                graph_context_provider.ingest_message(
                    conversation_id=conversation_id,
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
