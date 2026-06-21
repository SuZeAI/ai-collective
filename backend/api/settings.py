"""Typed application configuration (single source of truth).

Every configuration value the app reads flows through here. The layering is built
in ``config_loader`` and ``dotenv`` *before* any ``Settings()`` is constructed:

    code defaults  <  config.yml  <  .env  <  OS environment

1. ``dotenv.load_dotenv()`` reads ``.env`` into ``os.environ`` (never overriding
   an existing OS var).
2. ``apply_config_yaml()`` flattens ``config.yml``, expands ``${VAR}`` references
   and ``setdefault``-s each leaf into ``os.environ`` (so ``.env`` / OS win).

Because every value lands in ``os.environ`` by the time ``Settings()`` runs, each
nested ``BaseSettings`` sub-model below reads its own fields straight from the
environment via ``validation_alias`` (the canonical UPPER_CASE env-var name).

Access is **nested**, grouped by config.yml section, e.g.::

    settings.llm.provider
    settings.agent.context_token_limit
    settings.security.allow_private_http

A set of flat ``@property`` delegates is kept on the root for backward
compatibility with existing call-sites (``settings.llm_provider`` …).

Per-tool credentials are NOT configured here anymore — they live in each skill's
``config`` dict (stored in MongoDB, edited via the UI) and reach toolkits through
their constructor kwargs. Only global tool flags remain (``SecuritySettings``).
"""

from __future__ import annotations

import dotenv
from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from backend.api.config_loader import apply_config_yaml

_DEFAULT_JWT_SECRET = "change-me-in-production-use-openssl-rand-hex-32"

# Shared config for every section: read os.environ case-insensitively, accept the
# python field name too, and ignore unrelated env vars.
_SECTION_CONFIG = SettingsConfigDict(
    extra="ignore",
    case_sensitive=False,
    populate_by_name=True,
)


def _split_keys(value: str | None) -> list[str]:
    """Split a comma/whitespace-separated key string into a de-duplicated list."""
    if not value:
        return []
    raw = value.replace("\n", ",").replace(" ", ",")
    out: list[str] = []
    seen: set[str] = set()
    for part in raw.split(","):
        key = part.strip()
        if key and key not in seen:
            seen.add(key)
            out.append(key)
    return out


def _alias(*names: str) -> AliasChoices:
    return AliasChoices(*names)


# ══════════════════════════════════════════════════════════════════════════════
# Section sub-models (one per config.yml section)
# ══════════════════════════════════════════════════════════════════════════════
class AppSettings(BaseSettings):
    model_config = _SECTION_CONFIG

    app_name: str = Field(default="ai-collective-backend", validation_alias=_alias("APP_NAME"))
    # "development" | "production" — gates the production safety checks on the root.
    environment: str = Field(default="development", validation_alias=_alias("ENVIRONMENT"))
    api_prefix: str = Field(default="/api/v1", validation_alias=_alias("API_PREFIX"))
    cors_origins: str = Field(
        default=(
            "http://localhost:5173,http://127.0.0.1:5173,"
            "http://localhost:8080,http://127.0.0.1:8080,"
            "http://localhost:2026,http://127.0.0.1:2026"
        ),
        validation_alias=_alias("CORS_ORIGINS"),
    )
    frontend_url: str = Field(default="http://localhost:8080", validation_alias=_alias("FRONTEND_URL"))
    vite_api_base_url: str = Field(
        default="http://localhost:8000/api/v1", validation_alias=_alias("VITE_API_BASE_URL")
    )

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


class LoggingSettings(BaseSettings):
    model_config = _SECTION_CONFIG

    log_level: str = Field(default="info", validation_alias=_alias("LOG_LEVEL"))
    log_console: bool = Field(default=True, validation_alias=_alias("LOG_CONSOLE"))
    log_file: bool = Field(default=False, validation_alias=_alias("LOG_FILE"))
    log_max_bytes: int = Field(default=10 * 1024 * 1024, validation_alias=_alias("LOG_MAX_BYTES"))
    log_backup_count: int = Field(default=5, validation_alias=_alias("LOG_BACKUP_COUNT"))


class LLMSettings(BaseSettings):
    model_config = _SECTION_CONFIG

    provider: str = Field(default="google", validation_alias=_alias("LLM_PROVIDER"))
    model: str | None = Field(default=None, validation_alias=_alias("LLM_MODEL"))
    api_base: str | None = Field(default=None, validation_alias=_alias("LLM_API_BASE"))

    # Optional middleware knobs (previously read raw in infrastructure/llm/middleware.py)
    tool_retry_max: int = Field(default=2, validation_alias=_alias("LLM_TOOL_RETRY_MAX"))
    fallback_models: str | None = Field(default=None, validation_alias=_alias("LLM_FALLBACK_MODELS"))
    summarization_enabled: bool = Field(
        default=False, validation_alias=_alias("LLM_SUMMARIZATION_ENABLED")
    )
    summarization_model: str | None = Field(
        default=None, validation_alias=_alias("LLM_SUMMARIZATION_MODEL")
    )
    summarization_trigger_tokens: int = Field(
        default=8000, validation_alias=_alias("LLM_SUMMARIZATION_TRIGGER_TOKENS")
    )
    summarization_keep_messages: int = Field(
        default=20, validation_alias=_alias("LLM_SUMMARIZATION_KEEP_MESSAGES")
    )

    # Loop detection — short-circuits an agent that repeats the same tool call
    # (same name + args). On by default; it only soft-nudges (never re-executes
    # the repeated call), so it's a pure safety net.
    loop_detection_enabled: bool = Field(
        default=True, validation_alias=_alias("LLM_LOOP_DETECTION_ENABLED")
    )
    loop_detection_max_repeats: int = Field(
        default=3, validation_alias=_alias("LLM_LOOP_DETECTION_MAX_REPEATS")
    )
    # Run-level cap on total tool executions (0 disables). Backstops the
    # model-call cap with a tool-call cap.
    tool_call_limit: int = Field(default=0, validation_alias=_alias("LLM_TOOL_CALL_LIMIT"))
    # Model-call retry on transient errors (0 disables; off by default since
    # key rotation already handles most provider failures).
    model_retry_max: int = Field(default=0, validation_alias=_alias("LLM_MODEL_RETRY_MAX"))
    # Context editing — prune old tool outputs when the input grows large.
    context_editing_enabled: bool = Field(
        default=False, validation_alias=_alias("LLM_CONTEXT_EDITING_ENABLED")
    )
    context_editing_trigger_tokens: int = Field(
        default=100000, validation_alias=_alias("LLM_CONTEXT_EDITING_TRIGGER_TOKENS")
    )
    context_editing_keep: int = Field(
        default=3, validation_alias=_alias("LLM_CONTEXT_EDITING_KEEP")
    )

    # ── Custom middleware suite (all OFF by default) ──────────────────────────
    # Rolling summary — project-native summarizer that folds the oldest history
    # into a working-memory summary note and trims it from the model input.
    rolling_summary_enabled: bool = Field(
        default=False, validation_alias=_alias("LLM_ROLLING_SUMMARY_ENABLED")
    )
    rolling_summary_trigger_tokens: int = Field(
        default=6000, validation_alias=_alias("LLM_ROLLING_SUMMARY_TRIGGER_TOKENS")
    )
    rolling_summary_keep_messages: int = Field(
        default=10, validation_alias=_alias("LLM_ROLLING_SUMMARY_KEEP_MESSAGES")
    )
    # Long-term memory middleware — recall at start, persist salient at end.
    ltm_middleware_enabled: bool = Field(
        default=False, validation_alias=_alias("LLM_LTM_MIDDLEWARE_ENABLED")
    )
    # Tool result cache — serve identical idempotent tool calls from cache.
    tool_cache_enabled: bool = Field(
        default=False, validation_alias=_alias("LLM_TOOL_CACHE_ENABLED")
    )
    tool_cache_deny_tools: str | None = Field(
        default=None, validation_alias=_alias("LLM_TOOL_CACHE_DENY_TOOLS")
    )
    # Cost/token budget guard — soft-stop a run past a token ceiling (0 = off).
    run_token_budget: int = Field(default=0, validation_alias=_alias("LLM_RUN_TOKEN_BUDGET"))
    # PII redaction + guardrail.
    pii_redaction_enabled: bool = Field(
        default=False, validation_alias=_alias("LLM_PII_REDACTION_ENABLED")
    )
    guardrail_deny_tools: str | None = Field(
        default=None, validation_alias=_alias("LLM_GUARDRAIL_DENY_TOOLS")
    )
    guardrail_deny_patterns: str | None = Field(
        default=None, validation_alias=_alias("LLM_GUARDRAIL_DENY_PATTERNS")
    )

    def fallback_model_list(self) -> list[str]:
        raw = self.fallback_models or ""
        return [p.strip() for p in raw.replace("\n", ",").split(",") if p.strip()]

    def _csv_list(self, raw: str | None) -> list[str]:
        return [p.strip() for p in (raw or "").replace("\n", ",").split(",") if p.strip()]

    def tool_cache_deny_list(self) -> list[str]:
        return self._csv_list(self.tool_cache_deny_tools)

    def guardrail_deny_tool_list(self) -> list[str]:
        return self._csv_list(self.guardrail_deny_tools)

    def guardrail_deny_pattern_list(self) -> list[str]:
        return self._csv_list(self.guardrail_deny_patterns)


class LLMKeysSettings(BaseSettings):
    """LLM provider API keys (secrets). Each may hold a single key OR several
    comma/whitespace-separated keys; the LLM layer rotates across them."""

    model_config = _SECTION_CONFIG

    google_api_key: str | None = Field(
        default=None,
        validation_alias=_alias("GOOGLE_API_KEY", "GOOGLE_API_KEYS", "GEMINI_API_KEY"),
    )
    anthropic_api_key: str | None = Field(
        default=None, validation_alias=_alias("ANTHROPIC_API_KEY", "ANTHROPIC_API_KEYS")
    )
    openai_api_key: str | None = Field(
        default=None, validation_alias=_alias("OPENAI_API_KEY", "OPENAI_API_KEYS")
    )
    open_weight_api_key: str | None = Field(
        default=None,
        validation_alias=_alias(
            "OPEN_WEIGHT_API_KEY", "OPEN_WEIGHT_API_KEYS", "OPENROUTER_API_KEY", "OPENROUTER_API_KEYS"
        ),
    )
    kimi_api_key: str | None = Field(
        default=None,
        validation_alias=_alias("KIMI_API_KEY", "KIMI_API_KEYS", "MOONSHOT_API_KEY", "MOONSHOT_API_KEYS"),
    )

    def google_api_keys(self) -> list[str]:
        return _split_keys(self.google_api_key)

    def anthropic_api_keys(self) -> list[str]:
        return _split_keys(self.anthropic_api_key)

    def openai_api_keys(self) -> list[str]:
        return _split_keys(self.openai_api_key)

    def open_weight_api_keys(self) -> list[str]:
        return _split_keys(self.open_weight_api_key)

    def kimi_api_keys(self) -> list[str]:
        return _split_keys(self.kimi_api_key)


class FailoverSettings(BaseSettings):
    model_config = _SECTION_CONFIG

    strategy: str = Field(default="rotate", validation_alias=_alias("LLM_FAILOVER_STRATEGY"))
    rotate_max_requests_per_min: int = Field(
        default=0, validation_alias=_alias("LLM_ROTATE_MAX_REQUESTS_PER_MIN")
    )
    rotate_max_tokens_per_min: int = Field(
        default=0, validation_alias=_alias("LLM_ROTATE_MAX_TOKENS_PER_MIN")
    )
    key_cooldown_seconds: float = Field(
        default=60.0, validation_alias=_alias("LLM_KEY_COOLDOWN_SECONDS")
    )


class RouterSettings(BaseSettings):
    model_config = _SECTION_CONFIG

    port: int = Field(default=20128, validation_alias=_alias("ROUTER_PORT"))
    public_url: str = Field(default="http://localhost:20128", validation_alias=_alias("ROUTER_PUBLIC_URL"))
    jwt_secret: str | None = Field(default=None, validation_alias=_alias("ROUTER_JWT_SECRET"))
    initial_password: str | None = Field(default=None, validation_alias=_alias("ROUTER_INITIAL_PASSWORD"))


class AgentSettings(BaseSettings):
    model_config = _SECTION_CONFIG

    max_tool_rounds: int = Field(default=6, validation_alias=_alias("AGENT_MAX_TOOL_ROUNDS"))
    # Per-tool execution timeout in seconds. 0 disables the timeout.
    tool_timeout_seconds: int = Field(default=0, validation_alias=_alias("TOOL_TIMEOUT_SECONDS"))
    subagent_max_concurrent: int = Field(default=3, validation_alias=_alias("SUBAGENT_MAX_CONCURRENT"))
    subagent_max_turns: int = Field(default=6, validation_alias=_alias("SUBAGENT_MAX_TURNS"))
    # Context budgeting (langgraph_*).
    context_token_limit: int = Field(default=12000, validation_alias=_alias("AGENT_CONTEXT_TOKEN_LIMIT"))
    output_token_reserve: int = Field(default=2000, validation_alias=_alias("AGENT_OUTPUT_TOKEN_RESERVE"))
    # Per-call LLM timeout / retries (_graph_runtime).
    llm_timeout_seconds: int = Field(default=120, validation_alias=_alias("AGENT_LLM_TIMEOUT_SECONDS"))
    llm_max_retries: int = Field(default=2, validation_alias=_alias("AGENT_LLM_MAX_RETRIES"))
    ask_user_timeout_seconds: int = Field(
        default=600, validation_alias=_alias("AGENT_ASK_USER_TIMEOUT_SECONDS")
    )
    # Mesh fan-out concurrency (falls back to subagent_max_concurrent when unset).
    mesh_fanout_max_concurrent: int | None = Field(
        default=None, validation_alias=_alias("MESH_FANOUT_MAX_CONCURRENT")
    )


class StorageSettings(BaseSettings):
    model_config = _SECTION_CONFIG

    backend: str = Field(default="json", validation_alias=_alias("STORAGE_BACKEND"))
    dir: str | None = Field(default=None, validation_alias=_alias("STORAGE_DIR"))
    seed_dir: str | None = Field(default=None, validation_alias=_alias("SEED_DIR"))
    # Where file *bytes* (uploads, agent outputs, library docs) durably live.
    # "local" → host workspace dir only; "s3" → MinIO/S3 is the system of record
    # and the working dir is restored from it on cold start (any sandbox mode).
    # "" (default/auto) → s3 when MINIO_ENABLED else local (back-compat).
    file_backend: str = Field(default="", validation_alias=_alias("FILE_STORAGE_BACKEND"))


class MongoSettings(BaseSettings):
    model_config = _SECTION_CONFIG

    uri: str = Field(
        default="mongodb://admin:admin@localhost:27017/ai_collective?authSource=admin",
        validation_alias=_alias("MONGO_URI"),
    )
    db: str = Field(default="ai_collective", validation_alias=_alias("MONGO_DB"))


class GraphSettings(BaseSettings):
    model_config = _SECTION_CONFIG

    build_mode: str = Field(default="static", validation_alias=_alias("GRAPH_BUILD_MODE"))
    llm_provider: str | None = Field(default=None, validation_alias=_alias("GRAPH_LLM_PROVIDER"))
    llm_model: str | None = Field(default=None, validation_alias=_alias("GRAPH_LLM_MODEL"))
    # Knowledge-graph persistence backend. "auto" follows STORAGE_BACKEND
    # (mongo|json); "neo4j" uses a Neo4j graph database (falls back to the
    # STORAGE_BACKEND repo if the driver/service is unavailable).
    backend: str = Field(default="auto", validation_alias=_alias("GRAPH_DB_BACKEND"))
    neo4j_uri: str | None = Field(default=None, validation_alias=_alias("NEO4J_URI"))
    neo4j_user: str = Field(default="neo4j", validation_alias=_alias("NEO4J_USER"))
    neo4j_password: str | None = Field(default=None, validation_alias=_alias("NEO4J_PASSWORD"))
    neo4j_database: str = Field(default="neo4j", validation_alias=_alias("NEO4J_DATABASE"))


class TaskQueueSettings(BaseSettings):
    model_config = _SECTION_CONFIG

    backend: str = Field(default="memory", validation_alias=_alias("TASK_QUEUE_BACKEND"))
    max_concurrent: int = Field(default=3, validation_alias=_alias("TASK_QUEUE_MAX_CONCURRENT"))
    rabbitmq_url: str | None = Field(default=None, validation_alias=_alias("RABBITMQ_URL"))


class LockSettings(BaseSettings):
    model_config = _SECTION_CONFIG

    backend: str = Field(default="threading", validation_alias=_alias("LOCK_BACKEND"))
    redis_url: str | None = Field(default=None, validation_alias=_alias("REDIS_URL"))


class SandboxSettings(BaseSettings):
    model_config = _SECTION_CONFIG

    mode: str = Field(default="local", validation_alias=_alias("SANDBOX_MODE"))
    image: str = Field(
        default="enterprise-public-cn-beijing.cr.volces.com/vefaas-public/all-in-one-sandbox:latest",
        validation_alias=_alias("SANDBOX_IMAGE"),
    )
    base_port: int = Field(default=8080, validation_alias=_alias("SANDBOX_BASE_PORT"))
    container_prefix: str = Field(
        default="ai-collective-sandbox", validation_alias=_alias("SANDBOX_CONTAINER_PREFIX")
    )
    replicas: int = Field(default=3, validation_alias=_alias("SANDBOX_REPLICAS"))
    idle_timeout: int = Field(default=600, validation_alias=_alias("SANDBOX_IDLE_TIMEOUT"))
    host: str = Field(default="localhost", validation_alias=_alias("SANDBOX_HOST"))
    provisioner_url: str | None = Field(default=None, validation_alias=_alias("SANDBOX_PROVISIONER_URL"))
    timeout: int = Field(default=120, validation_alias=_alias("SANDBOX_TIMEOUT"))
    workspace: str | None = Field(default=None, validation_alias=_alias("SANDBOX_WORKSPACE"))


class MinioSettings(BaseSettings):
    """S3-compatible object storage for backing up conversation sandbox files."""

    model_config = _SECTION_CONFIG

    enabled: bool = Field(default=False, validation_alias=_alias("MINIO_ENABLED"))
    endpoint: str = Field(default="localhost:9000", validation_alias=_alias("MINIO_ENDPOINT"))
    access_key: str = Field(default="minioadmin", validation_alias=_alias("MINIO_ACCESS_KEY"))
    secret_key: str = Field(default="minioadmin", validation_alias=_alias("MINIO_SECRET_KEY"))
    bucket: str = Field(default="sandbox-backups", validation_alias=_alias("MINIO_BUCKET"))
    secure: bool = Field(default=False, validation_alias=_alias("MINIO_SECURE"))


class AuthSettings(BaseSettings):
    model_config = _SECTION_CONFIG

    jwt_secret_key: str = Field(default=_DEFAULT_JWT_SECRET, validation_alias=_alias("JWT_SECRET_KEY"))
    jwt_algorithm: str = Field(default="HS256", validation_alias=_alias("JWT_ALGORITHM"))
    jwt_access_token_expire_minutes: int = Field(
        default=60 * 24 * 7, validation_alias=_alias("JWT_ACCESS_TOKEN_EXPIRE_MINUTES")
    )
    google_login_client_id: str | None = Field(
        default=None, validation_alias=_alias("GOOGLE_LOGIN_CLIENT_ID")
    )
    google_login_client_secret: str | None = Field(
        default=None, validation_alias=_alias("GOOGLE_LOGIN_CLIENT_SECRET")
    )
    google_login_redirect_uri: str = Field(
        default="http://127.0.0.1:8000/api/v1/auth/google/callback",
        validation_alias=_alias("GOOGLE_LOGIN_REDIRECT_URI"),
    )
    google_oauth_redirect_uri: str = Field(
        default="http://127.0.0.1:8000/api/v1/auth/oauth/callback",
        validation_alias=_alias("GOOGLE_OAUTH_REDIRECT_URI"),
    )
    # OAuth client-secret / credentials file locations (workspace tools).
    google_oauth_client_secret_path: str | None = Field(
        default=None, validation_alias=_alias("GOOGLE_OAUTH_CLIENT_SECRET_PATH")
    )
    credentials_path: str | None = Field(default=None, validation_alias=_alias("CREDENTIALS_PATH"))
    service_account_path: str | None = Field(
        default=None, validation_alias=_alias("SERVICE_ACCOUNT_PATH")
    )


class WorkingMemorySettings(BaseSettings):
    model_config = _SECTION_CONFIG

    enabled: bool = Field(default=True, validation_alias=_alias("WORKING_MEMORY_ENABLED"))
    max_notes: int = Field(default=40, validation_alias=_alias("WORKING_MEMORY_MAX_NOTES"))
    compact_tokens: int = Field(default=1500, validation_alias=_alias("WORKING_MEMORY_COMPACT_TOKENS"))
    note_chars: int = Field(default=600, validation_alias=_alias("WORKING_MEMORY_NOTE_CHARS"))
    summary_chars: int = Field(default=3000, validation_alias=_alias("WORKING_MEMORY_SUMMARY_CHARS"))
    digest_chars: int = Field(default=4000, validation_alias=_alias("WORKING_MEMORY_DIGEST_CHARS"))


class EmbeddingSettings(BaseSettings):
    """Pluggable embedding backend for real (vector) RAG.

    Off by default — when disabled the knowledge graph / long-term memory /
    document RAG all fall back to lexical retrieval. ``provider`` selects a
    real model (google/openai/open_weight) or the dependency-free ``hashing``
    fallback. Keys are reused from ``LLMKeysSettings``.
    """

    model_config = _SECTION_CONFIG

    enabled: bool = Field(default=False, validation_alias=_alias("EMBEDDING_ENABLED"))
    provider: str = Field(default="hashing", validation_alias=_alias("EMBEDDING_PROVIDER"))
    model: str | None = Field(default=None, validation_alias=_alias("EMBEDDING_MODEL"))
    dim: int = Field(default=256, validation_alias=_alias("EMBEDDING_DIM"))
    batch_size: int = Field(default=64, validation_alias=_alias("EMBEDDING_BATCH_SIZE"))


class VectorStoreSettings(BaseSettings):
    """ANN vector index for long-term memory recall.

    ``backend=none`` (default) keeps the brute-force cosine over scope-filtered
    records in the repository. ``faiss`` builds a local on-disk index; ``qdrant``
    uses an external Qdrant service. Both degrade to brute-force if the optional
    dependency is missing or the backend can't be reached.
    """

    model_config = _SECTION_CONFIG

    backend: str = Field(default="none", validation_alias=_alias("VECTOR_STORE_BACKEND"))
    # faiss — NOTE: field name must NOT be ``path`` (case-insensitive matching
    # would read the ubiquitous ``$PATH`` env var into it).
    faiss_path: str | None = Field(default=None, validation_alias=_alias("VECTOR_STORE_PATH"))
    # qdrant
    qdrant_url: str | None = Field(default=None, validation_alias=_alias("QDRANT_URL"))
    qdrant_api_key: str | None = Field(default=None, validation_alias=_alias("QDRANT_API_KEY"))
    qdrant_collection: str = Field(
        default="ltm_memory", validation_alias=_alias("QDRANT_COLLECTION")
    )
    # how many extra candidates to over-fetch before scope filtering (backends
    # without server-side scope filtering rely on this).
    overfetch: int = Field(default=5, validation_alias=_alias("VECTOR_STORE_OVERFETCH"))


class RetrievalSettings(BaseSettings):
    """RAG retrieval mode for injecting 'additional information' into context.

    ``mode``:
      * ``bm25`` (default) — local Okapi BM25 over conversation chunks. No
        external service or embedding model; the fallback when the advanced
        backends are disabled.
      * ``qdrant`` — semantic vector search over chunk embeddings (needs Qdrant
        + embeddings).
      * ``neo4j`` — graph-relationship expansion over the knowledge graph.
      * ``hybrid`` — Qdrant vector seeds fused with Neo4j graph expansion
        (GraphRAG); the two work together, not separately.
    """

    model_config = _SECTION_CONFIG

    mode: str = Field(default="bm25", validation_alias=_alias("RETRIEVAL_MODE"))
    top_k: int = Field(default=5, validation_alias=_alias("RETRIEVAL_TOP_K"))
    hops: int = Field(default=1, validation_alias=_alias("RETRIEVAL_HOPS"))
    max_chars: int = Field(default=1500, validation_alias=_alias("RETRIEVAL_MAX_CHARS"))


class LongTermMemorySettings(BaseSettings):
    """Cross-conversation long-term memory (workspace + owner + agent scoped)."""

    model_config = _SECTION_CONFIG

    enabled: bool = Field(default=False, validation_alias=_alias("LONG_TERM_MEMORY_ENABLED"))
    recall_top_k: int = Field(default=5, validation_alias=_alias("LTM_RECALL_TOP_K"))
    min_importance: float = Field(default=0.0, validation_alias=_alias("LTM_MIN_IMPORTANCE"))
    consolidate_on_run_end: bool = Field(
        default=True, validation_alias=_alias("LTM_CONSOLIDATE_ON_RUN_END")
    )
    dedupe_threshold: float = Field(default=0.92, validation_alias=_alias("LTM_DEDUPE_THRESHOLD"))
    digest_chars: int = Field(default=2000, validation_alias=_alias("LTM_DIGEST_CHARS"))


class McpSettings(BaseSettings):
    model_config = _SECTION_CONFIG

    discovery_timeout_seconds: int = Field(
        default=30, validation_alias=_alias("MCP_DISCOVERY_TIMEOUT_SECONDS")
    )
    call_timeout_seconds: int = Field(default=60, validation_alias=_alias("MCP_CALL_TIMEOUT_SECONDS"))
    auto_seed: bool = Field(default=True, validation_alias=_alias("MCP_AUTO_SEED"))
    config_file: str = Field(default="mcp.yml", validation_alias=_alias("MCP_CONFIG_FILE"))


class AdminSettings(BaseSettings):
    model_config = _SECTION_CONFIG

    email: str = Field(default="admin@aicollective.com", validation_alias=_alias("ADMIN_EMAIL"))
    name: str = Field(default="Administrator", validation_alias=_alias("ADMIN_NAME"))
    auto_seed: bool = Field(default=True, validation_alias=_alias("ADMIN_AUTO_SEED"))
    password: str | None = Field(default=None, validation_alias=_alias("ADMIN_PASSWORD"))


class SeedSettings(BaseSettings):
    model_config = _SECTION_CONFIG

    default_data: bool = Field(default=True, validation_alias=_alias("SEED_DEFAULT_DATA"))


class BrowserSettings(BaseSettings):
    """LLM config used by the agent browser-automation tools."""

    model_config = _SECTION_CONFIG

    model_name: str = Field(default="gemini-2.0-flash", validation_alias=_alias("MODEL_NAME"))
    model_provider: str = Field(default="google_genai", validation_alias=_alias("MODEL_PROVIDER"))
    temperature: float = Field(default=0.0, validation_alias=_alias("TEMPERATURE"))
    max_tokens: int = Field(default=1024, validation_alias=_alias("MAX_TOKENS"))
    api_base: str | None = Field(default=None, validation_alias=_alias("API_BASE"))
    extra_headers: dict | None = Field(default=None, validation_alias=_alias("EXTRA_HEADERS"))


class SecuritySettings(BaseSettings):
    """Global operational/security flags for agent tools (NOT per-skill creds).

    These are process-wide knobs declared in config.yml (`security:`), separate
    from the per-tool credential fallbacks in ``ToolsSettings``.
    """

    model_config = _SECTION_CONFIG

    # Allow tools to reach private/loopback IPs (turns the SSRF guard off).
    allow_private_http: bool = Field(default=False, validation_alias=_alias("ALLOW_PRIVATE_HTTP"))
    # Verbose HTTP debug logging.
    last30days_debug: bool = Field(default=False, validation_alias=_alias("LAST30DAYS_DEBUG"))


class ToolsSettings(BaseSettings):
    """Per-tool credentials / endpoints (secrets), env-backed FALLBACKS.

    A skill's own ``config`` (stored in MongoDB, edited via the UI) is the
    primary source and is passed to each toolkit constructor. When a skill leaves
    a field empty, the toolkit falls back to the matching value here, which is
    read from the environment (.env / OS env) — these are NOT declared in
    config.yml. Global, non-credential flags live in ``SecuritySettings``.
    """

    model_config = _SECTION_CONFIG

    # ── Search / scraping ──────────────────────────────────────────────────────
    brave_search_api_key: str = Field(default="", validation_alias=_alias("BRAVE_SEARCH_API_KEY"))
    parallel_api_key: str = Field(default="", validation_alias=_alias("PARALLEL_API_KEY"))
    openrouter_api_key: str = Field(default="", validation_alias=_alias("OPENROUTER_API_KEY"))
    scrapecreators_api_key: str = Field(default="", validation_alias=_alias("SCRAPECREATORS_API_KEY"))
    truthsocial_token: str = Field(default="", validation_alias=_alias("TRUTHSOCIAL_TOKEN"))
    xiaohongshu_api_base_url: str = Field(default="", validation_alias=_alias("XIAOHONGSHU_API_BASE_URL"))
    # bird_x (X scraping via local .mjs)
    auth_token: str = Field(default="", validation_alias=_alias("AUTH_TOKEN"))
    ct0: str = Field(default="", validation_alias=_alias("CT0"))
    bird_search_mjs: str = Field(default="", validation_alias=_alias("BIRD_SEARCH_MJS"))

    # ── X / xAI ────────────────────────────────────────────────────────────────
    xai_api_key: str = Field(default="", validation_alias=_alias("XAI_API_KEY"))
    xai_model: str = Field(default="grok-4-fast", validation_alias=_alias("XAI_MODEL"))

    # ── Bluesky ──────────────────────────────────────────────────────────────
    bsky_handle: str = Field(default="", validation_alias=_alias("BSKY_HANDLE"))
    bsky_app_password: str = Field(default="", validation_alias=_alias("BSKY_APP_PASSWORD"))

    # ── Messaging ──────────────────────────────────────────────────────────────
    slack_bot_token: str = Field(default="", validation_alias=_alias("SLACK_BOT_TOKEN"))
    slack_default_channel: str = Field(default="", validation_alias=_alias("SLACK_DEFAULT_CHANNEL"))
    discord_bot_token: str = Field(default="", validation_alias=_alias("DISCORD_BOT_TOKEN"))
    discord_webhook_url: str = Field(default="", validation_alias=_alias("DISCORD_WEBHOOK_URL"))
    discord_channel_id: str = Field(default="", validation_alias=_alias("DISCORD_CHANNEL_ID"))
    telegram_bot_token: str = Field(default="", validation_alias=_alias("TELEGRAM_BOT_TOKEN"))
    telegram_chat_id: str = Field(default="", validation_alias=_alias("TELEGRAM_CHAT_ID"))
    teams_webhook_url: str = Field(default="", validation_alias=_alias("TEAMS_WEBHOOK_URL"))
    signal_phone_number: str = Field(default="", validation_alias=_alias("SIGNAL_PHONE_NUMBER"))
    signal_callmebot_api_key: str = Field(default="", validation_alias=_alias("SIGNAL_CALLMEBOT_API_KEY"))
    skype_bot_app_id: str = Field(default="", validation_alias=_alias("SKYPE_BOT_APP_ID"))
    skype_bot_app_password: str = Field(default="", validation_alias=_alias("SKYPE_BOT_APP_PASSWORD"))
    skype_service_url: str = Field(default="", validation_alias=_alias("SKYPE_SERVICE_URL"))
    skype_conversation_id: str = Field(default="", validation_alias=_alias("SKYPE_CONVERSATION_ID"))
    snapchat_access_token: str = Field(default="", validation_alias=_alias("SNAPCHAT_ACCESS_TOKEN"))
    snapchat_ad_account_id: str = Field(default="", validation_alias=_alias("SNAPCHAT_AD_ACCOUNT_ID"))
    whatsapp_access_token: str = Field(default="", validation_alias=_alias("WHATSAPP_ACCESS_TOKEN"))
    whatsapp_phone_number_id: str = Field(default="", validation_alias=_alias("WHATSAPP_PHONE_NUMBER_ID"))
    wechat_app_id: str = Field(default="", validation_alias=_alias("WECHAT_APP_ID"))
    wechat_app_secret: str = Field(default="", validation_alias=_alias("WECHAT_APP_SECRET"))
    viber_auth_token: str = Field(default="", validation_alias=_alias("VIBER_AUTH_TOKEN"))
    viber_sender_name: str = Field(default="AI Assistant", validation_alias=_alias("VIBER_SENDER_NAME"))
    wire_bearer_token: str = Field(default="", validation_alias=_alias("WIRE_BEARER_TOKEN"))
    wire_conversation_id: str = Field(default="", validation_alias=_alias("WIRE_CONVERSATION_ID"))
    zalo_oa_access_token: str = Field(default="", validation_alias=_alias("ZALO_OA_ACCESS_TOKEN"))
    line_channel_access_token: str = Field(default="", validation_alias=_alias("LINE_CHANNEL_ACCESS_TOKEN"))
    messenger_page_access_token: str = Field(
        default="", validation_alias=_alias("MESSENGER_PAGE_ACCESS_TOKEN")
    )
    instagram_page_access_token: str = Field(
        default="", validation_alias=_alias("INSTAGRAM_PAGE_ACCESS_TOKEN")
    )
    instagram_user_id: str = Field(default="", validation_alias=_alias("INSTAGRAM_USER_ID"))

    # ── Media generation ─────────────────────────────────────────────────────
    gemini_api_key: str = Field(default="", validation_alias=_alias("GEMINI_API_KEY"))
    image_gen_api_key: str = Field(default="", validation_alias=_alias("IMAGE_GEN_API_KEY"))
    video_gen_api_key: str = Field(default="", validation_alias=_alias("VIDEO_GEN_API_KEY"))
    video_gen_create_endpoint: str = Field(default="", validation_alias=_alias("VIDEO_GEN_CREATE_ENDPOINT"))
    video_gen_status_endpoint: str = Field(default="", validation_alias=_alias("VIDEO_GEN_STATUS_ENDPOINT"))
    tts_api_key: str = Field(default="", validation_alias=_alias("TTS_API_KEY"))
    tts_output_dir: str = Field(default="", validation_alias=_alias("TTS_OUTPUT_DIR"))

    # ── Google workspace token paths ───────────────────────────────────────────
    google_calendar_token_path: str = Field(
        default="", validation_alias=_alias("GOOGLE_CALENDAR_TOKEN_PATH")
    )
    google_docs_token_path: str = Field(default="", validation_alias=_alias("GOOGLE_DOCS_TOKEN_PATH"))
    google_drive_token_path: str = Field(default="", validation_alias=_alias("GOOGLE_DRIVE_TOKEN_PATH"))
    google_sheets_token_path: str = Field(default="", validation_alias=_alias("GOOGLE_SHEETS_TOKEN_PATH"))
    google_slides_token_path: str = Field(default="", validation_alias=_alias("GOOGLE_SLIDES_TOKEN_PATH"))


# ══════════════════════════════════════════════════════════════════════════════
# Root settings — composes every section + backward-compatible flat delegates
# ══════════════════════════════════════════════════════════════════════════════
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app: AppSettings = Field(default_factory=AppSettings)
    logging: LoggingSettings = Field(default_factory=LoggingSettings)
    llm: LLMSettings = Field(default_factory=LLMSettings)
    llm_keys: LLMKeysSettings = Field(default_factory=LLMKeysSettings)
    llm_failover: FailoverSettings = Field(default_factory=FailoverSettings)
    router: RouterSettings = Field(default_factory=RouterSettings)
    agent: AgentSettings = Field(default_factory=AgentSettings)
    storage: StorageSettings = Field(default_factory=StorageSettings)
    mongo: MongoSettings = Field(default_factory=MongoSettings)
    graph: GraphSettings = Field(default_factory=GraphSettings)
    task_queue: TaskQueueSettings = Field(default_factory=TaskQueueSettings)
    lock: LockSettings = Field(default_factory=LockSettings)
    sandbox: SandboxSettings = Field(default_factory=SandboxSettings)
    minio: MinioSettings = Field(default_factory=MinioSettings)
    auth: AuthSettings = Field(default_factory=AuthSettings)
    working_memory: WorkingMemorySettings = Field(default_factory=WorkingMemorySettings)
    embedding: EmbeddingSettings = Field(default_factory=EmbeddingSettings)
    vector_store: VectorStoreSettings = Field(default_factory=VectorStoreSettings)
    retrieval: RetrievalSettings = Field(default_factory=RetrievalSettings)
    long_term_memory: LongTermMemorySettings = Field(default_factory=LongTermMemorySettings)
    mcp: McpSettings = Field(default_factory=McpSettings)
    admin: AdminSettings = Field(default_factory=AdminSettings)
    seed: SeedSettings = Field(default_factory=SeedSettings)
    browser: BrowserSettings = Field(default_factory=BrowserSettings)
    security: SecuritySettings = Field(default_factory=SecuritySettings)
    tools: ToolsSettings = Field(default_factory=ToolsSettings)

    # ── Root helpers ────────────────────────────────────────────────────────
    def is_production(self) -> bool:
        return self.app.environment.strip().lower() in ("production", "prod")

    def cors_origin_list(self) -> list[str]:
        return self.app.cors_origin_list()

    @model_validator(mode="after")
    def _validate_production_secrets(self) -> "Settings":
        if self.is_production():
            secret = self.auth.jwt_secret_key
            if secret == _DEFAULT_JWT_SECRET or len(secret) < 32:
                raise ValueError(
                    "ENVIRONMENT=production requires a strong JWT_SECRET_KEY "
                    "(>=32 chars, not the default). Generate one with: openssl rand -hex 32"
                )
        return self

    # ── Backward-compatible flat delegates ──────────────────────────────────
    # App
    @property
    def app_name(self) -> str: return self.app.app_name
    @property
    def environment(self) -> str: return self.app.environment
    @property
    def api_prefix(self) -> str: return self.app.api_prefix
    @property
    def frontend_url(self) -> str: return self.app.frontend_url
    # LLM
    @property
    def llm_provider(self) -> str: return self.llm.provider
    @property
    def llm_model(self) -> str | None: return self.llm.model
    @property
    def llm_api_base(self) -> str | None: return self.llm.api_base
    # LLM keys
    @property
    def google_api_key(self) -> str | None: return self.llm_keys.google_api_key
    @property
    def anthropic_api_key(self) -> str | None: return self.llm_keys.anthropic_api_key
    @property
    def openai_api_key(self) -> str | None: return self.llm_keys.openai_api_key
    @property
    def open_weight_api_key(self) -> str | None: return self.llm_keys.open_weight_api_key
    @property
    def kimi_api_key(self) -> str | None: return self.llm_keys.kimi_api_key

    def google_api_keys(self) -> list[str]: return self.llm_keys.google_api_keys()
    def anthropic_api_keys(self) -> list[str]: return self.llm_keys.anthropic_api_keys()
    def openai_api_keys(self) -> list[str]: return self.llm_keys.openai_api_keys()
    def open_weight_api_keys(self) -> list[str]: return self.llm_keys.open_weight_api_keys()
    def kimi_api_keys(self) -> list[str]: return self.llm_keys.kimi_api_keys()

    # Storage
    @property
    def storage_backend(self) -> str: return self.storage.backend
    @property
    def storage_dir(self) -> str | None: return self.storage.dir
    @property
    def seed_dir(self) -> str | None: return self.storage.seed_dir
    @property
    def file_storage_backend(self) -> str:
        """Effective byte-store backend: explicit FILE_STORAGE_BACKEND wins; else auto.

        auto = 's3' when MINIO_ENABLED, otherwise 'local' (back-compat).
        """
        choice = (self.storage.file_backend or "").strip().lower()
        if choice in ("s3", "local"):
            return choice
        return "s3" if self.minio.enabled else "local"
    # Mongo
    @property
    def mongo_uri(self) -> str: return self.mongo.uri
    @property
    def mongo_db(self) -> str: return self.mongo.db
    # Agent
    @property
    def agent_max_tool_rounds(self) -> int: return self.agent.max_tool_rounds
    @property
    def tool_timeout_seconds(self) -> int: return self.agent.tool_timeout_seconds
    @property
    def subagent_max_concurrent(self) -> int: return self.agent.subagent_max_concurrent
    # Task queue
    @property
    def task_queue_backend(self) -> str: return self.task_queue.backend
    @property
    def task_queue_max_concurrent(self) -> int: return self.task_queue.max_concurrent
    @property
    def rabbitmq_url(self) -> str | None: return self.task_queue.rabbitmq_url
    # Lock
    @property
    def lock_backend(self) -> str: return self.lock.backend
    @property
    def redis_url(self) -> str | None: return self.lock.redis_url
    # Sandbox
    @property
    def sandbox_mode(self) -> str: return self.sandbox.mode
    @property
    def sandbox_image(self) -> str: return self.sandbox.image
    @property
    def sandbox_base_port(self) -> int: return self.sandbox.base_port
    @property
    def sandbox_container_prefix(self) -> str: return self.sandbox.container_prefix
    @property
    def sandbox_replicas(self) -> int: return self.sandbox.replicas
    @property
    def sandbox_idle_timeout(self) -> int: return self.sandbox.idle_timeout
    @property
    def sandbox_provisioner_url(self) -> str | None: return self.sandbox.provisioner_url
    @property
    def sandbox_timeout(self) -> int: return self.sandbox.timeout
    @property
    def sandbox_workspace(self) -> str | None: return self.sandbox.workspace
    # Auth
    @property
    def jwt_secret_key(self) -> str: return self.auth.jwt_secret_key
    @property
    def jwt_algorithm(self) -> str: return self.auth.jwt_algorithm
    @property
    def jwt_access_token_expire_minutes(self) -> int: return self.auth.jwt_access_token_expire_minutes
    @property
    def google_login_client_id(self) -> str | None: return self.auth.google_login_client_id
    @property
    def google_login_client_secret(self) -> str | None: return self.auth.google_login_client_secret
    @property
    def google_login_redirect_uri(self) -> str: return self.auth.google_login_redirect_uri
    @property
    def google_oauth_redirect_uri(self) -> str: return self.auth.google_oauth_redirect_uri
    # Graph
    @property
    def graph_build_mode(self) -> str: return self.graph.build_mode
    @property
    def graph_llm_provider(self) -> str | None: return self.graph.llm_provider
    @property
    def graph_llm_model(self) -> str | None: return self.graph.llm_model
    # Browser automation
    @property
    def model_name(self) -> str: return self.browser.model_name
    @property
    def model_provider(self) -> str: return self.browser.model_provider
    @property
    def temperature(self) -> float: return self.browser.temperature
    @property
    def max_tokens(self) -> int: return self.browser.max_tokens
    @property
    def api_base(self) -> str | None: return self.browser.api_base
    @property
    def extra_headers(self) -> dict | None: return self.browser.extra_headers


# Build the layered environment (code < config.yml < .env < OS) just before the
# instance is constructed. ``apply_config_yaml`` imports the Settings *class*
# (now defined) to map nested config.yml keys to env aliases; pydantic reads the
# environment at instantiation, so this ordering fills os.environ in time.
dotenv.load_dotenv()
apply_config_yaml()

settings = Settings()
