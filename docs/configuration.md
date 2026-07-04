# Configuration

Configuration is split across three layered sources, low → high priority:

```
code defaults  <  config.yml  <  .env  <  OS environment
```

- **`config.yml`** — **non-secret** operational config (provider/model, modes,
  timeouts, ports, URLs, budgets). Committed to git. Organized into sections;
  the `UPPER_CASE` leaf keys are the canonical env-var names. Edit this for
  behavior changes. Relocate with `CONFIG_FILE=/path/to/config.yml`.
- **`.env`** — **secrets only** (API keys, `JWT_SECRET_KEY`, DB/router
  credentials). Gitignored. Copy from `.env.template`. Overrides `config.yml`,
  so you can also pin an environment-specific value of any key here.
- **OS environment** — overrides everything (e.g. values injected by Docker/CI).

Both files are merged into the process environment at startup
(`backend/api/config_loader.py`), so every value reaches the pydantic `Settings`
object (`backend/api/settings.py`) **and** the modules that read `os.getenv`
directly. MCP servers are declared separately in `mcp.yml` — see
[MCP_GUIDE.md](MCP_GUIDE.md). Names are case-insensitive; the column below uses
the canonical upper-case form.

## Application

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_NAME` | `ai-collective-backend` | FastAPI app title |
| `ENVIRONMENT` | `development` | `production` enables safety checks (see below) |
| `API_PREFIX` | `/api/v1` | Prefix for all routers |
| `CORS_ORIGINS` | localhost dev origins | Comma-separated allowed origins |
| `FRONTEND_URL` | `http://localhost:8080` | Used for OAuth redirects |
| `LOG_LEVEL` | `info` | One of CRITICAL/ERROR/WARNING/INFO/DEBUG (invalid values ignored) |

### Production safety check

When `ENVIRONMENT=production`, the app **refuses to start** unless
`JWT_SECRET_KEY` is non-default and ≥ 32 chars. Generate one with:

```bash
openssl rand -hex 32
```

## Authentication / JWT

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET_KEY` | dev placeholder | HMAC signing key — **must** be overridden in production |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` (7 days) | Access-token lifetime |

### Google sign-in

| Variable | Description |
|----------|-------------|
| `GOOGLE_LOGIN_CLIENT_ID` / `GOOGLE_LOGIN_CLIENT_SECRET` | OAuth client credentials |
| `GOOGLE_LOGIN_REDIRECT_URI` | Login callback URL |
| `GOOGLE_OAUTH_REDIRECT_URI` | Tool/workspace integration callback URL |

## LLM providers

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `google` | `google` \| `anthropic` \| `openai` \| open-weight |
| `LLM_MODEL` | — | Model id (provider default if unset) |
| `LLM_API_BASE` | — | Custom base URL |
| `GOOGLE_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | — | Provider keys. May list **several keys** comma-separated to enable rotation (plural `*_API_KEYS` aliases also accepted). |
| `OPEN_WEIGHT_API_KEY` (alias `OPENROUTER_API_KEY`) | — | Open-weight / [openrouter.ai](https://openrouter.ai) key (≠ the 9Router gateway) |

### Key rotation & failover

Survive per-key rate/quota limits — see [LLM_KEY_ROTATION.md](LLM_KEY_ROTATION.md) for the full guide.

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_FAILOVER_STRATEGY` | `rotate` | `rotate` (built-in multi-key rotation) \| `9router` (delegate to the gateway). Aliases: `router`, `nine-router`, `off`. |
| `LLM_ROTATE_MAX_REQUESTS_PER_MIN` | `0` | Proactive per-key RPM budget (`0` = unlimited). Skip a key before it crosses this in a rolling 60s window. |
| `LLM_ROTATE_MAX_TOKENS_PER_MIN` | `0` | Proactive per-key TPM budget (`0` = unlimited). |
| `LLM_KEY_COOLDOWN_SECONDS` | `60` | How long an errored key is skipped before retry. |

When `LLM_FAILOVER_STRATEGY=rotate` (default), rotation triggers reactively on
429/quota/5xx/invalid-key errors **and** proactively on the RPM/TPM budgets above.

To instead route every request through the bundled [9Router](9ROUTER_SETUP.md)
multi-provider proxy, set `LLM_FAILOVER_STRATEGY=9router`, `LLM_PROVIDER=openai`,
`LLM_API_BASE=http://nine-router:20128/v1`, and use a 9Router-issued key as
`OPENAI_API_KEY`. Container knobs: `ROUTER_PORT`, `ROUTER_PUBLIC_URL`,
`ROUTER_JWT_SECRET`, `ROUTER_INITIAL_PASSWORD` (compose profile `router`).

## Agent / tools

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_MAX_TOOL_ROUNDS` | `6` | Max LLM↔tool rounds per agent turn |
| `TOOL_TIMEOUT_SECONDS` | `0` | Per-tool timeout (0 = disabled) |
| `SUBAGENT_MAX_CONCURRENT` | `3` | Max concurrent subagents |
| `SUBAGENT_MAX_TURNS` | `6` | Subagent tool-round budget |
| `AGENT_CONTEXT_TOKEN_LIMIT` | `12000` | Context-token budget per agent prompt |
| `AGENT_OUTPUT_TOKEN_RESERVE` | `2000` | Tokens reserved for output |
| `AGENT_LLM_TIMEOUT_SECONDS` | `120` | Per `llm.chat` call timeout (`safe_chat`) |
| `AGENT_LLM_MAX_RETRIES` | `2` | Retries on transient LLM failures |

### LLM middleware

Cross-cutting behaviours layered on the `create_agent` path. See
[LLM_MIDDLEWARE.md](LLM_MIDDLEWARE.md) for the full stack and ordering.

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_LOOP_DETECTION_ENABLED` | `true` | Short-circuit repeated-identical tool calls |
| `LLM_LOOP_DETECTION_MAX_REPEATS` | `3` | Repeats before the soft nudge |
| `LLM_TOOL_RETRY_MAX` | `2` | Retries for transient tool failures (0 = off) |
| `LLM_TOOL_CALL_LIMIT` | `0` | Run-wide cap on tool executions (0 = off) |
| `LLM_MODEL_RETRY_MAX` | `0` | Model-call retries on transient errors (0 = off) |
| `LLM_FALLBACK_MODELS` | — | Comma-separated fallback model ids |
| `LLM_CONTEXT_EDITING_ENABLED` | `false` | Prune old tool outputs when input grows large |
| `LLM_SUMMARIZATION_ENABLED` / `LLM_SUMMARIZATION_MODEL` | `false` / — | LLM-based history summarization |
| `LLM_ROLLING_SUMMARY_ENABLED` | `false` | LLM-free history compactor (fold oldest → summary) |
| `LLM_ROLLING_SUMMARY_TRIGGER_TOKENS` / `LLM_ROLLING_SUMMARY_KEEP_MESSAGES` | `6000` / `10` | Trigger and tail kept verbatim |
| `LLM_LTM_MIDDLEWARE_ENABLED` | `false` | Recall long-term memory before model, persist after |
| `LLM_TOOL_CACHE_ENABLED` | `false` | Serve identical idempotent tool calls from cache |
| `LLM_TOOL_CACHE_DENY_TOOLS` | — | Comma-separated tools to never cache |
| `LLM_RUN_TOKEN_BUDGET` | `0` | Soft-stop a run past this many tokens (0 = off) |
| `LLM_PII_REDACTION_ENABLED` | `false` | Redact emails/cards/secrets from tool results |
| `LLM_GUARDRAIL_DENY_TOOLS` / `LLM_GUARDRAIL_DENY_PATTERNS` | — | Block tools by name / arg regex |

## Storage

| Variable | Default | Description |
|----------|---------|-------------|
| `STORAGE_BACKEND` | `json` | `json` \| `mongo` |
| `STORAGE_DIR` | `<root>/storage` | JSON storage directory |
| `MONGO_URI` / `MONGO_DB` | local defaults | MongoDB connection |

**`json` backend and multiple instances:** each JSON repository caches its collection in memory per-process and rewrites the whole file on every write. `tasks.py`/`connections.py` merge into the current on-disk state under one lock acquisition (via `JsonFileStore.read_modify_write`) so concurrent writers across instances can't silently drop each other's writes, but every repository's `list()`/`get()` still reads from that process's in-memory cache — a second instance's write isn't visible until this instance's own next write refreshes its cache. Use `mongo` for genuine multi-instance/production deployments; `json` is intended for single-instance/local dev regardless of `LOCK_BACKEND`.

## Task queue / locks / sandbox

| Variable | Default | Description |
|----------|---------|-------------|
| `TASK_QUEUE_BACKEND` | `memory` | `memory` \| `rabbitmq` |
| `TASK_QUEUE_MAX_CONCURRENT` | `3` | Max concurrent tasks |
| `RABBITMQ_URL` | — | Required when backend is `rabbitmq` |
| `LOCK_BACKEND` | `threading` | `threading` \| `redis` |
| `REDIS_URL` | — | Required when lock backend is `redis` |
| `SANDBOX_MODE` | `local` | `local` \| `docker` \| `k8s` |
| `SANDBOX_PROVISIONER_URL` | — | Required when sandbox mode is `k8s` |
| `SANDBOX_TIMEOUT` | `120` | Command timeout (seconds) |

## Knowledge graph

| Variable | Default | Description |
|----------|---------|-------------|
| `GRAPH_BUILD_MODE` | `static` | `static` (spaCy/rules) \| `llm` (richer, costs tokens) |
| `GRAPH_LLM_PROVIDER` / `GRAPH_LLM_MODEL` | — | Optional dedicated extraction LLM |
| `GRAPH_DB_BACKEND` | `auto` | `auto` (follow `STORAGE_BACKEND`) \| `neo4j` |
| `NEO4J_URI` | — | e.g. `bolt://localhost:7687` (required for `neo4j`) |
| `NEO4J_USER` / `NEO4J_PASSWORD` | `neo4j` / — | Neo4j credentials (secrets → `.env`) |
| `NEO4J_DATABASE` | `neo4j` | Target database |

Falls back to the `STORAGE_BACKEND` graph repo if the driver/server is
unavailable. Install with `pip install '.[neo4j]'`; local dev container via the
`neo4j` compose profile. See [LONG_TERM_MEMORY.md](LONG_TERM_MEMORY.md).

## Embeddings & long-term memory

Real vector RAG + cross-conversation memory. **OFF by default** (lexical
fallback). Full guide: [LONG_TERM_MEMORY.md](LONG_TERM_MEMORY.md).

| Variable | Default | Description |
|----------|---------|-------------|
| `EMBEDDING_ENABLED` | `false` | Turn on real vector embeddings |
| `EMBEDDING_PROVIDER` | `hashing` | `hashing` (no dep) \| `google` \| `openai` \| `open_weight` |
| `EMBEDDING_MODEL` | — | Provider-specific model id |
| `EMBEDDING_DIM` | `256` | Vector dimension (hashing) |
| `LONG_TERM_MEMORY_ENABLED` | `false` | Enable cross-conversation memory |
| `LTM_RECALL_TOP_K` | `5` | Records recalled per query |
| `LTM_MIN_IMPORTANCE` | `0.0` | Minimum importance to recall |
| `LTM_CONSOLIDATE_ON_RUN_END` | `true` | Promote salient working-memory notes at run end |
| `LTM_DEDUPE_THRESHOLD` | `0.92` | Similarity above which records merge |
| `LTM_DIGEST_CHARS` | `2000` | Injected recall-digest size cap |

### RAG retrieval (additional context for the knowledge graph)

| Variable | Default | Description |
|----------|---------|-------------|
| `RETRIEVAL_MODE` | `bm25` | `bm25` (local, no service) \| `qdrant` (vector) \| `neo4j` (graph) \| `hybrid` (Qdrant + Neo4j, GraphRAG) |
| `RETRIEVAL_TOP_K` | `5` | Chunks retrieved per query |
| `RETRIEVAL_HOPS` | `1` | Graph expansion depth (`neo4j`/`hybrid`) |
| `RETRIEVAL_MAX_CHARS` | `1500` | Size cap of the injected RAG block |

`qdrant`/`hybrid` need `EMBEDDING_ENABLED` + a Qdrant service; `neo4j`/`hybrid`
use the knowledge graph (best with `GRAPH_DB_BACKEND=neo4j`). Any mode falls back
to BM25 on failure.

### Vector store (ANN index for recall)

| Variable | Default | Description |
|----------|---------|-------------|
| `VECTOR_STORE_BACKEND` | `none` | `none` (brute force) \| `faiss` \| `qdrant` |
| `VECTOR_STORE_PATH` | `<STORAGE_DIR>/vector_store` | FAISS index directory |
| `VECTOR_STORE_OVERFETCH` | `5` | Candidates fetched before scope filtering |
| `QDRANT_URL` | — | Qdrant endpoint (required for `qdrant`) |
| `QDRANT_API_KEY` | — | Optional; blank for the local dev container |
| `QDRANT_COLLECTION` | `ltm_memory` | Collection name |

Only used when embeddings are enabled; degrades to brute force if the backend is
unavailable. Install with `pip install '.[faiss]'` / `'.[qdrant]'`; local dev
containers via the `qdrant` compose profile.

## Security / networking knobs

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOW_PRIVATE_HTTP` | unset | `1` disables the SSRF guard (local dev only) |

## Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_CONSOLE` | enabled | `false` disables console logging |
| `LOG_FILE` | enabled | `false` disables file logging |
| `LOG_MAX_BYTES` | `10485760` (10 MB) | Rotating file size before rollover |
| `LOG_BACKUP_COUNT` | `5` | Number of rotated log files kept |
