# Agent Orchestration

Multi-agent runs are built on **LangGraph**. Each topology compiles a graph of
agent nodes and streams turns back to the caller. Code lives in
`server/domain/staff/`.

## Topologies

| Mode | File | Shape |
|------|------|-------|
| `sequential` | `langgraph_orchestrator.py` | Agents run once each, in order |
| `ring` | `langgraph_ring.py` | Agents take turns in a circle until `max_rounds` |
| `supervisor` | `langgraph_supervisor.py` | A lead delegates to workers, then synthesizes |
| `tree` | `langgraph_tree.py` | Binary-tree delegation down/up |
| `mesh` | `langgraph_mesh.py` | Agents address each other freely via control tags |

The mode is selected in `api/deps.get_staff_graph_service(mode=...)`.

Each orchestrator exposes `run(...)` (returns a `GraphRunResult`) and
`run_stream(...)` (yields custom SSE events). Both take `user_input`, the agent
definitions, an `LLMProvider`, `max_rounds`, and an optional graph-context
provider for knowledge-graph retrieval.

## Shared runtime (`_graph_runtime.py`)

All topologies share three helpers:

- **`recursion_config(max_rounds)`** — derives a LangGraph `recursion_limit`
  (`max(25, max_rounds*2 + 10)`) so long-but-legitimate runs don't hit the
  default 25-superstep ceiling. Passed to every `ainvoke`/`astream`.
- **`run_to_final_state(graph, initial, max_rounds)`** — drives the graph with
  values-mode streaming and returns the **latest partial state** if the
  recursion limit is hit or a node raises, instead of discarding every turn.
- **`safe_chat(llm, ...)`** — wraps `llm.chat` with a bounded timeout
  (`AGENT_LLM_TIMEOUT_SECONDS`) and retry/backoff (`AGENT_LLM_MAX_RETRIES`).
  On exhaustion it returns an error string used as the turn content, so one
  transient provider failure can't abort the whole run.

## Token budgeting

`token_budget.apply_context_token_budget` trims the system+user context to
`AGENT_CONTEXT_TOKEN_LIMIT` minus `AGENT_OUTPUT_TOKEN_RESERVE`. Note: the
budget currently estimates only system+user text and does not account for
bound tool-schema tokens — keep tool schemas modest when near the limit.

## State immutability

LangGraph state snapshots must not be mutated in place. When updating
collections in state, build new containers (e.g. the mesh topology deep-copies
`conversation_history` before appending) rather than mutating the incoming
dict/list.

## Subagents

Agents may spawn subagents (`subagents.py`) bounded by `SUBAGENT_MAX_CONCURRENT`
and `SUBAGENT_MAX_TURNS`. Subagents can be granted sandboxed `bash`/file tools;
treat the sandbox as the security boundary and label untrusted user/context
input in prompts to reduce prompt-injection surface.

## Conversation persistence on restart

Starting a **completed** or **stopped** task again no longer wipes its history.
Instead of deleting the messages and resetting the knowledge graph, the restart
(`PUT /tasks/{id}/status` → `in-progress`, in `api/routers/tasks.py`):

- **keeps** all prior messages and the graph, and
- appends a `— New session started <ts> —` divider message,

so the re-run reads as a continuation of one long conversation rather than a
blank slate. This is consistent with how a follow-up on a completed task already
behaved, and it is what feeds the long-running dialogue into long-term-memory
consolidation.

For a deliberate fresh start there is an explicit, owner/admin-gated action:

| Method | Path | Effect |
|--------|------|--------|
| `DELETE` | `/tasks/{id}/history` | Wipe the task's messages **and** graph context |

On the frontend this is the **Clear history** button in TaskManager
(`api.clearTaskHistory` → `RunEngineContext.clearHistory`). The run engine keeps
the transcript across a restart (`clearTransientRunState` resets only transient
interaction state, not the conversation).
