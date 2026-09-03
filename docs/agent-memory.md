# Agent Working Memory

The working memory is a **shared, persistent blackboard per conversation** that
keeps multi-agent runs from losing context mid-task. It complements the
knowledge graph: the graph answers *"what entities/relations have appeared?"*,
the working memory answers *"what have we already done, decided, and found?"*.

## The problem it solves

Every agent turn is a stateless LLM call. Before this layer, context flowed
through three lossy channels:

1. **Windowed logs** — supervisor keeps the last 6 delegation entries, mesh the
   last 5 messages, ring the last 8, tree the last 8. Older results silently
   fell off.
2. **Top-k graph retrieval** — useful, but query-dependent; it can miss the one
   worker result that matters.
3. **Token-budget tail truncation** — `AGENT_CONTEXT_TOKEN_LIMIT` (default
   12 000) cuts the *end* of the context; whatever was assembled last could
   vanish without a trace.

Concretely: supervisor workers received only their task and the original
request — they never saw what sibling workers had already found.

## How it works

```
                ┌──────────────────────────────────────────────┐
                │  WorkingMemory (per conversation_id)          │
                │  • task            (original request)         │
                │  • rolling_summary (compacted old notes)      │
                │  • notes[]         (finding/decision/artifact │
                │                     /todo/guidance/result)    │
                └──────┬───────────────────────────▲────────────┘
        render_digest()│                           │ record_note()
                       ▼                           │
   every agent prompt gets the digest      every turn auto-records its
   injected EARLY (survives truncation)    result; agents also save
                                           explicitly via memory_save
```

- **Auto-capture.** Every topology records a compressed note at each turn
  boundary: worker results, delegations (`decision`), branch reports, pipeline
  stage outputs. No agent cooperation required.
- **Pinned human guidance.** Mid-run user interjections are pinned — they can
  never be compacted away or truncated out.
- **Compaction instead of dropping.** Two triggers, both folding oldest-first
  into one-line bullets in the rolling summary: note count exceeds
  `WORKING_MEMORY_MAX_NOTES`, **or** the estimated token size of the notes
  exceeds `WORKING_MEMORY_COMPACT_TOKENS` (default 1 500 tokens — once memory
  grows past this, it is summarized until it fits again). Context *degrades*,
  it never disappears.
- **Digest injection.** Each agent prompt gets a token-bounded
  `[WORKING MEMORY …]` block placed right after human guidance — i.e. at the
  *head* of the context, where tail truncation cannot reach it.
- **Persistence.** Follows `STORAGE_BACKEND`, like every other repository:
  - `json` (default) — atomic snapshot files at
    `{STORAGE_DIR}/working_memory/{conversation_id}.json`, fronted by an
    in-process cache (single-instance deployments).
  - `mongo` — one document per conversation in the `working_memory`
    collection (unique index on `conversation_id`). **No in-process cache**:
    every operation reads through Mongo, so multiple backend instances see
    each other's notes — this is the multi-instance-safe mode. Writes for one
    conversation are already serialized (one active run per conversation), so
    read-modify-write is safe.

  Either way, snapshots are written after every mutation, so paused/resumed
  runs and follow-up runs on the same conversation resume with full memory.
  If Mongo is configured but unreachable at first use, the store logs the
  error and falls back to file persistence instead of disabling memory.

## Agent-facing tools

Two tools are bound to every agent by default (next to `ask_user`):

| Tool | Purpose |
|------|---------|
| `memory_save(content, kind, pin)` | Persist a key fact, decision, artifact location, or TODO for all agents. `pin=true` keeps it verbatim in every prompt. |
| `memory_recall(query, limit)` | Lexical search over saved notes — for details outside the current digest. |

Subagents (Agent Mode `task` tool) inherit both.

## Configuration

```bash
# .env — all optional
WORKING_MEMORY_ENABLED=true          # master switch
WORKING_MEMORY_MAX_NOTES=40          # verbatim notes kept before compaction
WORKING_MEMORY_COMPACT_TOKENS=1500   # token threshold: above this the oldest
                                     # unpinned notes are summarized away
WORKING_MEMORY_NOTE_CHARS=600        # per-note clip
WORKING_MEMORY_SUMMARY_CHARS=3000    # rolling summary cap
WORKING_MEMORY_DIGEST_CHARS=4000     # rendered digest cap (per prompt)
```

Sizing note: the digest competes with everything else inside
`AGENT_CONTEXT_TOKEN_LIMIT`. The default 4 000 chars ≈ 1 000–1 250 tokens
(~10 % of the default 12 000-token budget). If you lower the token limit,
lower `WORKING_MEMORY_DIGEST_CHARS` proportionally.

## Code map

| Piece | Location |
|-------|----------|
| Domain model (notes, compaction, digest) | `backend/domain/memory/working_memory.py` |
| Registry + JSON persistence | `backend/infra/working_memory_store.py` |
| `memory_save` / `memory_recall` toolkit | `backend/domain/tools/memory_tool.py` |
| Runtime helpers (injection, auto-capture) | `backend/domain/staff/_graph_runtime.py` |
| Topology wiring | `langgraph_supervisor.py`, `langgraph_mesh.py`, `langgraph_ring.py`, `langgraph_tree.py`, `langgraph_orchestrator.py` |

All memory operations are **best-effort**: a persistence or rendering failure
is logged and skipped — it can never abort an agent run.

## Relationship to the knowledge graph

| | Knowledge graph | Working memory |
|--|----------------|----------------|
| Content | entities + relations extracted from messages | curated facts: results, decisions, artifacts, todos |
| Retrieval | top-k by query similarity | full digest every turn + explicit recall |
| Guarantees | may miss items (retrieval) | nothing dropped, only compacted |
| Cost | NLP/LLM extraction per message | plain string handling |

They run side by side; disabling one does not affect the other.

> **Beyond one conversation:** working memory and the graph are per-conversation
> and reset when a run ends. For knowledge that persists **across** tasks (scoped
> by workspace + owner + agent, with vector RAG), see
> [long-term-memory.md](long-term-memory.md).
