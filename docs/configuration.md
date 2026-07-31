# Configuration

**`config.yml` is the single, complete source for every setting, including
secrets.** Precedence:

```
code defaults  <  config.yml  (${VAR} / $VAR expanded from .env / OS environment)
```

- To change behavior (provider list, timeouts, ports, feature toggles), **edit
  `config.yml` directly** — it is a nested, lowercase-key YAML file where each
  top-level section maps 1:1 onto a `Settings` sub-model
  (`backend/api/settings.py`) and each leaf key equals that sub-model's field
  name.
- No part of the backend reads a bare OS/`.env` variable to configure itself.
  The **only** way an env var reaches a setting is an explicit `${VAR}` (or
  `${VAR:-default}`) reference written inline in `config.yml` — used for
  secrets (API keys, `JWT_SECRET_KEY`, DB URIs, `ADMIN_PASSWORD`, …). `.env` is
  gitignored and loaded into the process environment at startup; copy it from
  `.env.template` and fill in the secrets it references. OS environment
  variables (e.g. injected by Docker/CI) resolve the same `${VAR}` references
  and take priority over `.env`.
- Relocate the file with `CONFIG_FILE=/path/to/config.yml`. The test suite
  layers an optional `CONFIG_OVERRIDE_FILE=/path` on top (deep-merged) to swap
  a handful of ops knobs without duplicating the whole file
  (`backend/api/config_loader.py`).
- MCP servers are declared separately in `mcp.yml`, referenced from
  `mcp.config_file` — see [MCP_GUIDE.md](MCP_GUIDE.md).
- Per-tool/per-skill credentials are **not** here at all — they live in each
  skill's `config` dict (stored in MongoDB, edited via the UI).

Tables below show the `config.yml` key path and default. A few docs elsewhere
in this repo (and some script/CLI help text) still reference the historical
`UPPER_CASE` env-var-style names from before this file existed — those names
no longer do anything by themselves; they map onto the same fields shown here.

## Application (`app:`) & logging (`logging:`)

| Key | Default | Description |
|-----|---------|-------------|
| `app.app_name` | `ai-collective-backend` | FastAPI app title |
| `app.environment` | `development` | `development` \| `production` — gates the production safety check below |
| `app.api_prefix` | `/api/v1` | Prefix for all routers |
| `app.cors_origins` | localhost dev origins | Comma-separated allowed CORS origins |
| `app.frontend_url` | `http://localhost:8080` | Base URL of the frontend app (OAuth redirects) |
| `app.vite_api_base_url` | `http://localhost:8000/api/v1` | API base URL baked into the Vite frontend build |
| `logging.log_level` | `info` | `critical` \| `error` \| `warning` \| `info` \| `debug` |
| `logging.log_console` | `true` | Log to stdout/stderr |
| `logging.log_file` | `false` | Log to a rotating file under `logs/` |
| `logging.log_max_bytes` | `10485760` (10 MB) | Rotating log file size cap |
| `logging.log_backup_count` | `5` | Rotated log files kept |

### Production safety check

When `app.environment=production`, the app **refuses to start** unless
`auth.jwt_secret_key` is non-default and ≥ 32 chars. Generate one with:

```bash
openssl rand -hex 32
```

## Authentication / JWT (`auth:`)

| Key | Default | Description |
|-----|---------|-------------|
| `auth.jwt_secret_key` | dev placeholder (`${JWT_SECRET_KEY}`) | HMAC signing key — **must** be overridden in production |
| `auth.jwt_algorithm` | `HS256` | JWT signing algorithm |
| `auth.jwt_access_token_expire_minutes` | `10080` (7 days) | Access-token lifetime |
| `auth.google_login_client_id` / `auth.google_login_client_secret` | `${GOOGLE_LOGIN_CLIENT_ID}` / `${GOOGLE_LOGIN_CLIENT_SECRET}` | Google sign-in OAuth client credentials |
| `auth.google_login_redirect_uri` | `.../auth/google/callback` | Login callback URL |
| `auth.google_oauth_redirect_uri` | `.../auth/oauth/callback` | Google Workspace tool-integration callback URL |
| `auth.google_oauth_client_secret_path` / `auth.credentials_path` / `auth.service_account_path` | — | Paths to Google OAuth/service-account JSON files |

## LLM providers — the `models:` registry

There is no single "active provider" env var. `config.yml`'s top-level
`models:` is a **list** of model entries (`ModelConfig`); the active model is
whichever entry has `enabled: true` first (or a Settings-UI override). Add a
provider by adding an entry to this list, not by setting an env var:

```yaml
models:
  - name: gemini                 # unique; selectable as the active model
    display_name: Gemini 3 Flash
    provider_name: Google        # selects one of the 7 built-in provider wrappers
    model: gemini-3-flash-preview
    api_key: $GOOGLE_API_KEY      # sourced from .env; may be several comma-separated keys for rotation
    supports_vision: true
    supports_embedding: true      # this entry's key usable as embeddings/tool fallback
    supports_image_gen: true
    supports_tts: true
    supports_video_gen: true
    enabled: true
    failover:
      strategy: rotate           # rotate | 9router (aliases: router, off)
      rotate_max_requests_per_min: 0   # 0 = unlimited
      rotate_max_tokens_per_min: 0
      key_cooldown_seconds: 1
```

Other `ModelConfig` fields: `description`, `base_url` (provider API base
override), `supports_thinking`, `supports_reasoning_effort`,
`when_thinking_enabled` / `when_thinking_disabled` / `thinking` (extra kwargs
merged in based on thinking mode). `provider_name` (falling back to `name`)
picks the provider wrapper; `api_key` may hold several comma-separated keys —
see [LLM_KEY_ROTATION.md](LLM_KEY_ROTATION.md) for the full per-key
rotation/failover guide.

To route every request through the bundled [9Router](9ROUTER_SETUP.md)
multi-provider proxy instead, set an entry's `failover.strategy: 9router`
(or alias `router`), point `base_url` at
`http://nine-router:20128/v1`, and use a 9Router-issued key as `api_key`.
Router container knobs live under `router:` (`router.port`,
`router.public_url`, `router.jwt_secret` from `${ROUTER_JWT_SECRET}`,
`router.initial_password` from `${ROUTER_INITIAL_PASSWORD}`; compose profile
`router`).

## Staff / tools (`staff:`)

| Key | Default | Description |
|-----|---------|-------------|
| `staff.max_tool_rounds` | `6` | Max LLM↔tool rounds per staff turn |
| `staff.tool_timeout_seconds` | `0` | Per-tool timeout (0 = disabled) |
| `staff.subagent_max_concurrent` | `3` | Max concurrent subagents |
| `staff.subagent_max_turns` | `6` | Subagent tool-round budget |
| `staff.context_token_limit` | `12000` | Context-token budget per staff prompt |
| `staff.output_token_reserve` | `2000` | Tokens reserved for output |
| `staff.llm_timeout_seconds` | `120` | Per `llm.chat` call timeout (`safe_chat`) |
| `staff.llm_max_retries` | `2` | Retries on transient LLM failures |
| `staff.ask_user_timeout_seconds` | `600` | `ask_user` prompt wait limit |
| `staff.pause_timeout_seconds` | `1800` | Max time a run may sit paused (`POST /llm/agent-graph/pause`) before it is auto-resumed |
| `staff.mesh_fanout_max_concurrent` | unset | Mesh fan-out concurrency; falls back to `subagent_max_concurrent` when unset |

### LLM middleware (`middleware:`)

Cross-cutting behaviours layered on the `create_agent` path, one nested block
per middleware, keyed by name. See [LLM_MIDDLEWARE.md](LLM_MIDDLEWARE.md) for
the full stack and ordering.

| Key | Default | Description |
|-----|---------|-------------|
| `middleware.loop_detection.enabled` / `.max_repeats` | `true` / `3` | Short-circuit repeated-identical tool calls |
| `middleware.tool_retry.max` | `2` | Retries for transient tool failures (0 = off) |
| `middleware.tool_call_limit.limit` | `0` | Run-wide cap on tool executions (0 = off) |
| `middleware.tool_cache.enabled` / `.deny_tools` | `false` / `""` | Serve identical idempotent tool calls from cache; comma-separated tools to never cache |
| `middleware.guardrail.deny_tools` / `.deny_patterns` | `""` / `""` | Block tools by name / arg regex |
| `middleware.pii_redaction.enabled` | `false` | Redact emails/cards/secrets from tool results |
| `middleware.model_fallback.models` | `""` | Comma-separated fallback model names (`models:` entry names) |
| `middleware.model_retry.max` | `0` | Model-call retries on transient errors (0 = off) |
| `middleware.context_editing.enabled` / `.trigger_tokens` / `.keep` | `false` / `100000` / `3` | Prune old tool outputs when input grows large |
| `middleware.summarization.enabled` / `.model` / `.trigger_tokens` / `.keep_messages` | `false` / — / `8000` / `20` | LLM-based history summarization (`.model` must name a `models:` entry when enabled) |
| `middleware.rolling_summary.enabled` / `.trigger_tokens` / `.keep_messages` | `false` / `6000` / `10` | LLM-free history compactor (fold oldest → summary) |
| `middleware.long_term_memory.enabled` | `false` | Recall long-term memory before model, persist after |
| `middleware.cost_budget.run_token_budget` | `0` | Soft-stop a run past this many tokens (0 = off) |
| `middleware.prompt_cache.enabled` / `.ttl` / `.min_messages` | `false` / `5m` / `0` | Anthropic prompt caching (`cache_control: ephemeral`); no-op on non-Anthropic providers |

## Storage (`storage:` / `mongo:`)

| Key | Default | Description |
|-----|---------|-------------|
| `storage.backend` | `json` | `json` (file) \| `mongo` |
| `storage.dir` | `storage` | Live DB dir (relative to project root) |
| `storage.seed_dir` | — | Read-only default catalog seeded from |
| `storage.file_backend` | `""` (auto) | Where file bytes durably live: `local` \| `s3` \| `""` (auto: `s3` when `minio.enabled`) |
| `mongo.uri` | local default (`${MONGO_URI}`) | MongoDB connection URI |
| `mongo.db` | `ai_collective` | MongoDB database name |

**`json` backend and multiple instances:** each JSON repository caches its collection in memory per-process and rewrites the whole file on every write. `tasks.py`/`connections.py` merge into the current on-disk state under one lock acquisition (via `JsonFileStore.read_modify_write`) so concurrent writers across instances can't silently drop each other's writes, but every repository's `list()`/`get()` still reads from that process's in-memory cache — a second instance's write isn't visible until this instance's own next write refreshes its cache. Use `mongo` for genuine multi-instance/production deployments; `json` is intended for single-instance/local dev regardless of `lock.backend`.

## Task queue / locks / sandbox (`task_queue:` / `lock:` / `sandbox:`)

| Key | Default | Description |
|-----|---------|-------------|
| `task_queue.backend` | `memory` | `memory` \| `rabbitmq` |
| `task_queue.max_concurrent` | `10` | Max staff-graph runs executing at once, system-wide across every company/user (excess runs queue). I/O-bound work (LLM calls), not CPU-bound, so it's safe to raise well past core count if you have the provider rate-limit/cost headroom. |
| `task_queue.rabbitmq_url` | — | Required when backend is `rabbitmq` (`${RABBITMQ_URL}`) |
| `lock.backend` | `threading` | `threading` \| `redis` |
| `lock.redis_url` | — | Required when lock backend is `redis` (`${REDIS_URL}`) |
| `sandbox.mode` | `local` | `local` \| `k8s` (no `docker` mode) |
| `sandbox.timeout` | `120` | Command timeout (seconds) |
| `sandbox.workspace` | — | Local sandbox workspace directory override |
| `sandbox.image` / `.replicas` / `.idle_timeout` / `.provisioner_url` | k8s defaults | k8s sandbox pool image, replica count, idle eviction, provisioner service URL (`${SANDBOX_PROVISIONER_URL}` if set inline) — see [K3S.md](K3S.md) |

## Knowledge graph (`graph:`)

| Key | Default | Description |
|-----|---------|-------------|
| `graph.build_mode` | `static` | `static` (spaCy/rules) \| `llm` (richer, costs tokens) |
| `graph.llm_provider` / `graph.llm_model` | — | Optional dedicated extraction LLM used only when `build_mode=llm` |
| `graph.backend` | `auto` | `auto` (follows `storage.backend`) \| `neo4j` |
| `graph.neo4j_uri` | — | e.g. `bolt://localhost:7687` (required for `neo4j`) |
| `graph.neo4j_user` / `graph.neo4j_password` | `neo4j` / — | Neo4j credentials (`${NEO4J_PASSWORD}`) |
| `graph.neo4j_database` | `neo4j` | Target database |

Falls back to the `storage.backend` graph repo if the driver/server is
unavailable. Install with `pip install '.[neo4j]'`; local dev container via the
`neo4j` compose profile. See [LONG_TERM_MEMORY.md](LONG_TERM_MEMORY.md).

## Embeddings & long-term memory (`embedding:` / `long_term_memory:` / `retrieval:` / `vector_store:`)

Real vector RAG + cross-conversation memory. **OFF by default** (lexical
fallback). Full guide: [LONG_TERM_MEMORY.md](LONG_TERM_MEMORY.md).

| Key | Default | Description |
|-----|---------|-------------|
| `embedding.enabled` | `false` | Turn on real vector embeddings |
| `embedding.provider` | `hashing` | `hashing` (no dep) \| `google` \| `openai` \| `open_weight` |
| `embedding.model` | — | Provider-specific model id |
| `embedding.dim` | `256` | Vector dimension (hashing) |
| `embedding.batch_size` | `64` | Embedding batch size |
| `long_term_memory.enabled` | `false` | Enable cross-conversation memory |
| `long_term_memory.recall_top_k` | `5` | Records recalled per query |
| `long_term_memory.min_importance` | `0.0` | Minimum importance to recall |
| `long_term_memory.consolidate_on_run_end` | `true` | Promote salient working-memory notes at run end |
| `long_term_memory.dedupe_threshold` | `0.92` | Similarity above which records merge |
| `long_term_memory.digest_chars` | `2000` | Injected recall-digest size cap |

### RAG retrieval (additional context for the knowledge graph)

| Key | Default | Description |
|-----|---------|-------------|
| `retrieval.mode` | `bm25` | `bm25` (local, no service) \| `qdrant` (vector) \| `neo4j` (graph) \| `hybrid` (Qdrant + Neo4j, GraphRAG) |
| `retrieval.top_k` | `5` | Chunks retrieved per query |
| `retrieval.hops` | `1` | Graph expansion depth (`neo4j`/`hybrid`) |
| `retrieval.max_chars` | `1500` | Size cap of the injected RAG block |

`qdrant`/`hybrid` need `embedding.enabled` + a Qdrant service; `neo4j`/`hybrid`
use the knowledge graph (best with `graph.backend=neo4j`). Any mode falls back
to BM25 on failure.

### Vector store (ANN index for recall)

| Key | Default | Description |
|-----|---------|-------------|
| `vector_store.backend` | `none` | `none` (brute force) \| `faiss` \| `qdrant` |
| `vector_store.faiss_path` | `<storage.dir>/vector_store` | FAISS index directory |
| `vector_store.overfetch` | `5` | Candidates fetched before scope filtering |
| `vector_store.qdrant_url` | — | Qdrant endpoint (required for `qdrant`, `${QDRANT_URL}` if set inline) |
| `vector_store.qdrant_api_key` | — | Optional; blank for the local dev container |
| `vector_store.qdrant_collection` | `ltm_memory` | Collection name |

Only used when embeddings are enabled; degrades to brute force if the backend is
unavailable. Install with `pip install '.[faiss]'` / `'.[qdrant]'`; local dev
containers via the `qdrant` compose profile.

## Working memory (`working_memory:`)

Per-conversation short-term working memory (distinct from long-term memory
above). See [AGENT_MEMORY.md](AGENT_MEMORY.md).

| Key | Default | Description |
|-----|---------|-------------|
| `working_memory.enabled` | `true` | Enable per-conversation working memory |
| `working_memory.max_notes` | `40` | Max notes kept before compaction |
| `working_memory.compact_tokens` | `1500` | Token threshold that triggers compaction |
| `working_memory.note_chars` / `.summary_chars` / `.digest_chars` | `600` / `3000` / `4000` | Size caps for a note / the summary / the injected digest |

## MCP (`mcp:`)

| Key | Default | Description |
|-----|---------|-------------|
| `mcp.config_file` | `mcp.yml` | Path (relative to project root) to the MCP server declaration file |
| `mcp.auto_seed` | `true` | Seed enabled servers from `mcp.yml` into the skill store on boot |
| `mcp.discovery_timeout_seconds` | `30` | `list_tools` handshake ceiling |
| `mcp.call_timeout_seconds` | `60` | Default per-tool-call timeout |

Per-server config (transport, command/args, url/headers, allowed tools) lives
in `mcp.yml` itself — see [MCP_GUIDE.md](MCP_GUIDE.md).

## Admin bootstrap & seed data (`admin:` / `seed:`)

| Key | Default | Description |
|-----|---------|-------------|
| `admin.email` / `admin.name` | `admin@aicollective.com` / `Administrator` | Bootstrap admin account identity |
| `admin.auto_seed` | `true` | Auto-create the bootstrap admin account on boot |
| `admin.password` | — | Bootstrap admin password (`${ADMIN_PASSWORD}`) |
| `seed.default_data` | `true` | Seed the default catalog data on boot |

## Browser automation (`browser:`)

LLM used by staff browser-automation tools (separate from the `models:`
registry).

| Key | Default | Description |
|-----|---------|-------------|
| `browser.model_name` / `browser.model_provider` | `gemini-2.0-flash` / `google_genai` | Chat model driving browser automation |
| `browser.temperature` / `browser.max_tokens` | `0.0` / `1024` | Sampling temperature / max output tokens |
| `browser.api_base` / `browser.extra_headers` | — | Custom API base / extra HTTP headers |

## Tool runtime defaults (`tools:`)

Non-credential per-tool deploy-time defaults (paths, display names) — actual
tool/skill credentials are user-configured per skill via the UI (stored in
MongoDB), not here. One nested section per tool.

| Key | Default | Description |
|-----|---------|-------------|
| `tools.bird.bird_search_mjs` | `""` | Vendored script path override for `bird_x` (X scraping) |
| `tools.xai.xai_model` | `grok-4-fast` | Default xAI/Grok model name |
| `tools.viber.viber_sender_name` | `AI Assistant` | Default Viber bot sender display name |
| `tools.tts.tts_output_dir` | `""` | Directory text-to-speech output files are written to |

## Security / networking knobs (`security:`)

| Key | Default | Description |
|-----|---------|-------------|
| `security.allow_private_http` | `false` | `true` disables the SSRF guard — allows tools to reach private/loopback IPs (local dev only) |
| `security.last30days_debug` | `false` | Verbose HTTP debug logging |
