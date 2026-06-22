# Long-Term Memory & RAG

Long-term memory (LTM) is **durable knowledge that outlives a single
conversation**. Where the [working memory](AGENT_MEMORY.md) and the knowledge
graph are scoped to one `conversation_id` and reset when a run ends, LTM carries
facts, preferences and episodic notes **across tasks** so agents recall what was
learned in earlier runs.

It is built on a pluggable **embedding backend** (real vector RAG) and an
optional **ANN vector store** (FAISS / Qdrant) for fast semantic recall.
Everything is **OFF by default** — when disabled the system behaves exactly as
before, falling back to lexical retrieval.

## The three-dimensional scope

Each memory record is scoped along three independent dimensions; any dimension
may be empty (`None` = "applies broadly"):

| Dimension | Meaning |
|-----------|---------|
| `workspace_id` | The Business Unit the knowledge belongs to (the run's `team_id`) |
| `owner_id` | The user it belongs to |
| `agent_id` | The agent that learned it (persona / experience) |

A recall query supplies a concrete scope and matches every record that is
**equal-or-broader** on each dimension. So a workspace-wide fact (no owner/agent)
surfaces for any agent in that workspace, while one agent's private note stays
hidden from another agent — scope isolation is enforced both client-side
(brute-force / FAISS) and server-side (Qdrant payload filter).

## How a run uses LTM

The run scope (`owner_id` + the task's `team_id` as workspace) is bound once per
run in the `run-stream` endpoint via a contextvar (`current_memory_scope`).

1. **Recall (before the model):** the `LongTermMemoryMiddleware` recalls a digest
   for the latest user message and injects it as a system message — universal,
   because every agent call goes through `create_agent`.
2. **Consolidate (run end):** on a clean finish the run promotes salient
   short-term knowledge — pinned working-memory notes and `decision`/`result`/
   `artifact` notes — into LTM, deduplicating near-identical records.

Recall scoring blends **semantic similarity** (dense cosine when embeddings are
on) **× importance × recency**, with a lexical term-overlap fallback when no
embedding is available.

## Embeddings (real vector RAG)

`backend/infrastructure/llm/embeddings.py` defines an `EmbeddingProvider`
protocol with pluggable backends, mirroring the LLM provider pattern:

| `EMBEDDING_PROVIDER` | Notes |
|----------------------|-------|
| `hashing` (default) | Dependency-free deterministic bag-of-words vector. No key, no network — works out of the box and in tests. |
| `google` | `GoogleGenerativeAIEmbeddings` (reuses `GOOGLE_API_KEY`) |
| `openai` | `OpenAIEmbeddings` (reuses `OPENAI_API_KEY`) |
| `open_weight` | OpenAI-compatible endpoint (`LLM_API_BASE`) |

Shared vector math (`cosine`, `cosine_dense`, `tokenize`, `lexical_overlap`)
lives in `backend/domain/memory/vectors.py`. A missing optional dependency or a
failed embedding degrades gracefully to the hashing fallback / lexical recall.

## Vector store (ANN index)

By default LTM recall does a brute-force cosine over scope-filtered records in
the repository — fine for small volumes. For scale, plug in an ANN index with
`VECTOR_STORE_BACKEND`:

| Backend | What it is | Scope filtering | Install |
|---------|-----------|-----------------|---------|
| `none` (default) | Brute-force cosine in the repo | client-side | — |
| `faiss` | Local on-disk index (`IndexIDMap2` + inner-product over normalised vectors) | over-fetch then filter (JSON sidecar payloads) | `pip install '.[faiss]'` |
| `qdrant` | External Qdrant service | **server-side** payload filter (`match` OR `is_null` per dimension) | `pip install '.[qdrant]'` |

The store is only built when embeddings are enabled (it needs vectors). On
`remember` the vector is upserted; on `recall` the index returns candidate ids
which are loaded from the repo, re-checked against the scope, and scored. If the
index is unavailable or returns nothing, recall **falls back to brute force** so
results are never silently lost.

Code: `backend/infrastructure/vector_store/` — `base.py` (protocol +
`scope_payload`/`payload_matches`), `faiss_store.py`, `qdrant_store.py`,
`factory.py`.

### Qdrant — local dev

```bash
docker compose -f docker/docker-compose-dev.yaml --profile qdrant up -d
# .env
QDRANT_URL=http://localhost:6333        # no API key needed for the local container
# config.yml › vector_store.backend: qdrant   (and embedding.enabled: true)
```

A local Qdrant container has auth disabled, so `QDRANT_API_KEY` is left blank.
For **Qdrant Cloud** the URL and API key come from the cluster dashboard; for a
self-hosted server with auth, set the same key on the server
(`QDRANT__SERVICE__API_KEY`) and in `QDRANT_API_KEY`.

## Knowledge graph on Neo4j (Graph RAG storage)

The knowledge graph (entities + relations extracted from messages) can be
persisted in **Neo4j** instead of the default JSON/Mongo store. Select it with
`GRAPH_DB_BACKEND=neo4j`; the repository keeps two representations per
conversation:

- a **lossless JSON blob** on a `(:Conversation {id})` node — the authoritative
  source for `get()`, so reconstruction is exact;
- a **native projection** — each entity as an `(:Entity)` node and each relation
  as a `[:RELATES]` relationship — so the graph is browsable/queryable directly
  in Neo4j Browser.

If the driver or server is unavailable the app falls back to the
`STORAGE_BACKEND` graph repo, so it always boots.

```bash
docker compose -f docker/docker-compose-dev.yaml --profile neo4j up -d
# .env
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=neo4j_password
# config.yml › graph.backend: neo4j        Browser: http://localhost:7474
```

Code: `backend/infrastructure/repositories/neo4j_graph_knowledge.py`; wired in
`backend/api/deps.py`. Install with `pip install '.[neo4j]'`.

## RAG retrieval modes (additional information)

Separate from LTM recall, a configurable **RAG layer** injects "additional
information" — the most relevant conversation chunks for the current query — into
the knowledge-graph context. It is selected by `retrieval.mode`:

| `RETRIEVAL_MODE` | How it retrieves | Needs |
|------------------|------------------|-------|
| `bm25` (default) | Local Okapi BM25 over conversation chunks | nothing (no service) |
| `qdrant` | Semantic vector search over chunk embeddings | Qdrant + embeddings |
| `neo4j` | Graph expansion — entities matching the query, then their connected neighbours and chunks | knowledge graph (best in Neo4j) |
| `hybrid` | **Qdrant vector seeds fused with Neo4j graph expansion** (GraphRAG): vectors pick the entry chunks, the graph pulls in connected neighbours | Qdrant + Neo4j + embeddings |

So when the advanced backends are **enabled** you choose `qdrant`, `neo4j`, or
`hybrid` (both together); when **disabled** the default `bm25` provides a solid
local lexical RAG with no external dependency. Every mode falls back to BM25 (and
ultimately to empty) on any failure, so it never breaks context assembly.

The retriever runs synchronously inside
`graph_context_service.build_graph_context` and appends an *"Additional
information (RAG)"* block — it surfaces even when the graph has no entity
relations. Hybrid is the genuine combination of the vector DB and the graph
store: the chunk corpus is the conversation graph (sourced from Neo4j when
`graph.backend=neo4j`), and the seeds come from Qdrant.

Code: `backend/application/service/rag_retrieval.py` (modes),
`backend/domain/memory/bm25.py` (Okapi BM25),
`backend/infrastructure/rag_retrieval_store.py` (process accessor; RAG chunk
vectors use a separate `*_rag` collection / `rag_chunks` FAISS sub-dir so they
never mix with LTM vectors).

```yaml
retrieval:
  mode: bm25          # bm25 | qdrant | neo4j | hybrid
  top_k: 5
  hops: 1             # graph expansion depth (neo4j / hybrid)
```

## Configuration

All toggles live in `config.yml` (non-secret); connection strings / API keys
live in `.env`. See [configuration.md](configuration.md) for the full table.

Three related-but-distinct knobs govern the data layer:

- `vector_store.backend` — ANN index for **LTM record recall** (`none`/`faiss`/`qdrant`).
- `graph.backend` — where the **knowledge graph is stored** (`auto`/`neo4j`).
- `retrieval.mode` — how **RAG additional context** is retrieved (`bm25`/`qdrant`/`neo4j`/`hybrid`).

```yaml
embedding:
  enabled: false            # turn on real vector RAG
  provider: hashing         # hashing | google | openai | open_weight
  dim: 256

long_term_memory:
  enabled: false
  recall_top_k: 5
  consolidate_on_run_end: true
  dedupe_threshold: 0.92

vector_store:
  backend: none             # none | faiss | qdrant
  qdrant_collection: ltm_memory

graph:
  # backend: neo4j          # auto (follow storage backend) | neo4j
```

## Code map

| Piece | Location |
|-------|----------|
| Domain model (`MemoryScope`, `MemoryRecord`, scoring) | `backend/domain/memory/long_term_memory.py` |
| Shared vector math | `backend/domain/memory/vectors.py` |
| Embedding backends | `backend/infrastructure/llm/embeddings.py` |
| Service (recall / remember / consolidate) | `backend/application/service/long_term_memory_service.py` |
| Repositories (Mongo + JSON) | `backend/infrastructure/repositories/{mongo_repositories/long_term_memory.py, json_long_term_memory.py}` |
| Process accessor + run-scope contextvar | `backend/infrastructure/long_term_memory_store.py` |
| Vector stores | `backend/infrastructure/vector_store/` |
| Neo4j graph repo | `backend/infrastructure/repositories/neo4j_graph_knowledge.py` |
| Recall/persist middleware | `LongTermMemoryMiddleware` in `backend/infrastructure/llm/middleware.py` |

All LTM operations are **best-effort**: a persistence, embedding or index
failure is logged and skipped — it can never abort an agent run.

## Relationship to working memory and the graph

| | Working memory | Long-term memory | Knowledge graph |
|--|----------------|------------------|-----------------|
| Scope | one conversation | workspace + owner + agent, across runs | one conversation |
| Content | results/decisions/todos this run | durable facts/preferences/episodes | entities + relations |
| Lifetime | reset on restart | permanent (until pruned) | reset on restart (or kept — see persistence) |
| Retrieval | full digest every turn | top-k semantic recall | top-k graph walk |

They run side by side; each can be enabled independently.

> See also: [AGENT_MEMORY.md](AGENT_MEMORY.md) (working memory),
> [LLM_MIDDLEWARE.md](LLM_MIDDLEWARE.md) (the middleware that injects/persists LTM),
> and the *Conversation persistence on restart* section in
> [agent-orchestration.md](agent-orchestration.md).
