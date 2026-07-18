"""Typed application configuration (single source of truth).

``config.yml`` is the single, complete source for every non-secret setting:
each top-level section maps 1:1 onto one of the nested models below, and each
lowercase leaf key is that model's field name — no indirection through
environment variables needed to get a value from the file into a field.

    code defaults  <  config.yml

``config_loader.load_config()`` parses ``config.yml`` (deep-merged with an
optional ``CONFIG_OVERRIDE_FILE``, used by the test suite) and expands
``${VAR}`` / ``$VAR`` references from the OS environment — this is the *only*
place env vars still matter, and only for secret values a section's yaml leaf
references inline (e.g. ``auth.jwt_secret_key: ${JWT_SECRET_KEY}``). The
resulting nested dict is passed straight into ``Settings(**raw)``; pydantic's
built-in nested-model coercion builds each section from its matching sub-dict.

Access is **nested**, grouped by config.yml section, e.g.::

    settings.llm.provider
    settings.staff.context_token_limit
    settings.security.allow_private_http

A set of flat ``@property`` delegates is kept on the root for backward
compatibility with existing call-sites (``settings.llm_provider`` …).

A few settings classes are genuine secrets-only and have no config.yml
section at all — they still read directly from the OS environment (populated
from ``.env``) via pydantic-settings, same as before: ``LLMKeysSettings``
(LLM provider API keys — a normal user gets these from the provider, no
config.yml default makes sense), ``MinioSettings`` (object-storage
credentials) and ``ToolsSettings`` (deploy-time tool defaults, see its
docstring). Per-tool credentials are NOT configured here at all — they live
in each skill's ``config`` dict (stored in MongoDB, edited via the UI) and
reach toolkits through their constructor kwargs.
"""

from __future__ import annotations

import dotenv
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from backend.api.config_loader import load_config

_DEFAULT_JWT_SECRET = "change-me-in-production-use-openssl-rand-hex-32"

# Plain config.yml-backed sections: no env vars, unknown keys ignored.
_SECTION = ConfigDict(extra="ignore")

# Secrets-only sections with no config.yml section: read from the OS
# environment (populated from .env), case-insensitively, several aliases.
_SECRET_SECTION_CONFIG = SettingsConfigDict(
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
class AppSettings(BaseModel):
    model_config = _SECTION

    app_name: str = "ai-collective-backend"
    # "development" | "production" — gates the production safety checks on the root.
    environment: str = "development"
    api_prefix: str = "/api/v1"
    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:8080,http://127.0.0.1:8080,"
        "http://localhost:2026,http://127.0.0.1:2026"
    )
    frontend_url: str = "http://localhost:8080"
    vite_api_base_url: str = "http://localhost:8000/api/v1"

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


class LoggingSettings(BaseModel):
    model_config = _SECTION

    log_level: str = "info"
    log_console: bool = True
    log_file: bool = False
    log_max_bytes: int = 10 * 1024 * 1024
    log_backup_count: int = 5


class FailoverSettings(BaseModel):
    model_config = _SECTION

    strategy: str = "rotate"
    rotate_max_requests_per_min: int = 0
    rotate_max_tokens_per_min: int = 0
    key_cooldown_seconds: float = 60.0


class LLMSettings(BaseModel):
    model_config = _SECTION

    provider: str = "google"
    model: str | None = None
    api_base: str | None = None
    # Ops-level override of the active `models:` registry entry (config.yml).
    # Unset -> the first entry with enabled: true.
    active_model: str | None = None
    failover: FailoverSettings = Field(default_factory=FailoverSettings)

    # Fallback defaults for the middleware stack when `middleware:` (config.yml,
    # read independently by infrastructure/llm/middleware/config.py) omits a
    # knob. Not config.yml-backed themselves — just code defaults.
    tool_retry_max: int = 2
    fallback_models: str | None = None
    summarization_enabled: bool = False
    summarization_model: str | None = None
    summarization_trigger_tokens: int = 8000
    summarization_keep_messages: int = 20

    # Loop detection — short-circuits an staff that repeats the same tool call
    # (same name + args). On by default; it only soft-nudges (never re-executes
    # the repeated call), so it's a pure safety net.
    loop_detection_enabled: bool = True
    loop_detection_max_repeats: int = 3
    # Run-level cap on total tool executions (0 disables). Backstops the
    # model-call cap with a tool-call cap.
    tool_call_limit: int = 0
    # Model-call retry on transient errors (0 disables; off by default since
    # key rotation already handles most provider failures).
    model_retry_max: int = 0
    # Context editing — prune old tool outputs when the input grows large.
    context_editing_enabled: bool = False
    context_editing_trigger_tokens: int = 100000
    context_editing_keep: int = 3

    # ── Custom middleware suite (all OFF by default) ──────────────────────────
    # Rolling summary — project-native summarizer that folds the oldest history
    # into a working-memory summary note and trims it from the model input.
    rolling_summary_enabled: bool = False
    rolling_summary_trigger_tokens: int = 6000
    rolling_summary_keep_messages: int = 10
    # Long-term memory middleware — recall at start, persist salient at end.
    ltm_middleware_enabled: bool = False
    # Tool result cache — serve identical idempotent tool calls from cache.
    tool_cache_enabled: bool = False
    tool_cache_deny_tools: str | None = None
    # Cost/token budget guard — soft-stop a run past a token ceiling (0 = off).
    run_token_budget: int = 0
    # PII redaction + guardrail.
    pii_redaction_enabled: bool = False
    guardrail_deny_tools: str | None = None
    guardrail_deny_patterns: str | None = None
    # Anthropic prompt caching — marks the system prompt/tools/last-message
    # prefix as cacheable so repeat calls (agent loops, subagent fan-out,
    # multi-turn meetings) reuse cached input tokens instead of paying full
    # price. No-op on non-Anthropic providers. Off by default.
    prompt_cache_enabled: bool = False
    prompt_cache_ttl: str = "5m"
    prompt_cache_min_messages: int = 0

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
    """LLM provider API keys (secrets, no config.yml section). Each may hold a
    single key OR several comma/whitespace-separated keys; the LLM layer
    rotates across them."""

    model_config = _SECRET_SECTION_CONFIG

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
    deepseek_api_key: str | None = Field(
        default=None,
        validation_alias=_alias("DEEPSEEK_API_KEY", "DEEPSEEK_API_KEYS"),
    )
    glm_api_key: str | None = Field(
        default=None,
        validation_alias=_alias(
            "GLM_API_KEY", "GLM_API_KEYS", "ZHIPU_API_KEY", "ZHIPU_API_KEYS", "ZHIPUAI_API_KEY"
        ),
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

    def deepseek_api_keys(self) -> list[str]:
        return _split_keys(self.deepseek_api_key)

    def glm_api_keys(self) -> list[str]:
        return _split_keys(self.glm_api_key)


class RouterSettings(BaseModel):
    model_config = _SECTION

    port: int = 20128
    public_url: str = "http://localhost:20128"
    jwt_secret: str | None = None
    initial_password: str | None = None


class StaffSettings(BaseModel):
    model_config = _SECTION

    max_tool_rounds: int = 6
    # Per-tool execution timeout in seconds. 0 disables the timeout.
    tool_timeout_seconds: int = 0
    subagent_max_concurrent: int = 3
    subagent_max_turns: int = 6
    # Context budgeting (langgraph_*).
    context_token_limit: int = 12000
    output_token_reserve: int = 2000
    # Per-call LLM timeout / retries (_graph_runtime).
    llm_timeout_seconds: int = 120
    llm_max_retries: int = 2
    ask_user_timeout_seconds: int = 600
    # Max time a run may sit paused (POST /llm/agent-graph/pause) before it is
    # auto-resumed. Without a bound, an abandoned pause holds its slot in the
    # task queue's concurrency cap (MemoryTaskQueue) forever.
    pause_timeout_seconds: int = 1800
    # Mesh fan-out concurrency (falls back to subagent_max_concurrent when unset).
    mesh_fanout_max_concurrent: int | None = None


class StorageSettings(BaseModel):
    model_config = _SECTION

    backend: str = "json"
    dir: str | None = None
    seed_dir: str | None = None
    # Where file *bytes* (uploads, staff outputs, library docs) durably live.
    # "local" → host workspace dir only; "s3" → MinIO/S3 is the system of record
    # and the working dir is restored from it on cold start (any sandbox mode).
    # "" (default/auto) → s3 when minio.enabled else local (back-compat).
    file_backend: str = ""


class MongoSettings(BaseModel):
    model_config = _SECTION

    uri: str = "mongodb://admin:admin@localhost:27017/ai_collective?authSource=admin"
    db: str = "ai_collective"


class GraphSettings(BaseModel):
    model_config = _SECTION

    build_mode: str = "static"
    llm_provider: str | None = None
    llm_model: str | None = None
    # Knowledge-graph persistence backend. "auto" follows storage.backend
    # (mongo|json); "neo4j" uses a Neo4j graph database (falls back to the
    # storage.backend repo if the driver/service is unavailable).
    backend: str = "auto"
    neo4j_uri: str | None = None
    neo4j_user: str = "neo4j"
    neo4j_password: str | None = None
    neo4j_database: str = "neo4j"


class TaskQueueSettings(BaseModel):
    model_config = _SECTION

    backend: str = "memory"
    # Max staff-graph runs executing at once, system-wide, across every
    # company/user (excess runs queue). The work here is I/O-bound (LLM API
    # calls), not CPU-bound, so threads are cheap — 3 was low enough to cap an
    # entire multi-tenant deployment at 3 concurrent runs total by default.
    max_concurrent: int = 10
    rabbitmq_url: str | None = None


class LockSettings(BaseModel):
    model_config = _SECTION

    backend: str = "threading"
    redis_url: str | None = None


class SandboxSettings(BaseModel):
    model_config = _SECTION

    mode: str = "local"
    image: str = "enterprise-public-cn-beijing.cr.volces.com/vefaas-public/all-in-one-sandbox:latest"
    replicas: int = 3
    idle_timeout: int = 600
    provisioner_url: str | None = None
    timeout: int = 120
    workspace: str | None = None


class MinioSettings(BaseSettings):
    """S3-compatible object storage for backing up conversation sandbox files.

    Secrets-only, no config.yml section (deliberately — see config.yml's minio
    comment block): read straight from the OS environment (.env)."""

    model_config = _SECRET_SECTION_CONFIG

    enabled: bool = Field(default=False, validation_alias=_alias("MINIO_ENABLED"))
    endpoint: str = Field(default="localhost:9000", validation_alias=_alias("MINIO_ENDPOINT"))
    access_key: str = Field(default="minioadmin", validation_alias=_alias("MINIO_ACCESS_KEY"))
    secret_key: str = Field(default="minioadmin", validation_alias=_alias("MINIO_SECRET_KEY"))
    bucket: str = Field(default="sandbox-backups", validation_alias=_alias("MINIO_BUCKET"))
    secure: bool = Field(default=False, validation_alias=_alias("MINIO_SECURE"))


class AuthSettings(BaseModel):
    model_config = _SECTION

    jwt_secret_key: str = _DEFAULT_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60 * 24 * 7
    google_login_client_id: str | None = None
    google_login_client_secret: str | None = None
    google_login_redirect_uri: str = "http://127.0.0.1:8000/api/v1/auth/google/callback"
    google_oauth_redirect_uri: str = "http://127.0.0.1:8000/api/v1/auth/oauth/callback"
    # OAuth client-secret / credentials file locations (workspace tools).
    google_oauth_client_secret_path: str | None = None
    credentials_path: str | None = None
    service_account_path: str | None = None


class WorkingMemorySettings(BaseModel):
    model_config = _SECTION

    enabled: bool = True
    max_notes: int = 40
    compact_tokens: int = 1500
    note_chars: int = 600
    summary_chars: int = 3000
    digest_chars: int = 4000


class EmbeddingSettings(BaseModel):
    """Pluggable embedding backend for real (vector) RAG.

    Off by default — when disabled the knowledge graph / long-term memory /
    document RAG all fall back to lexical retrieval. ``provider`` selects a
    real model (google/openai/open_weight) or the dependency-free ``hashing``
    fallback. Keys are reused from ``LLMKeysSettings``.
    """

    model_config = _SECTION

    enabled: bool = False
    provider: str = "hashing"
    model: str | None = None
    dim: int = 256
    batch_size: int = 64


class VectorStoreSettings(BaseModel):
    """ANN vector index for long-term memory recall.

    ``backend=none`` (default) keeps the brute-force cosine over scope-filtered
    records in the repository. ``faiss`` builds a local on-disk index; ``qdrant``
    uses an external Qdrant service. Both degrade to brute-force if the optional
    dependency is missing or the backend can't be reached.
    """

    model_config = _SECTION

    backend: str = "none"
    # faiss — NOTE: field name must NOT be ``path`` (case-insensitive matching
    # would read the ubiquitous ``$PATH`` env var into it).
    faiss_path: str | None = None
    # qdrant
    qdrant_url: str | None = None
    qdrant_api_key: str | None = None
    qdrant_collection: str = "ltm_memory"
    # how many extra candidates to over-fetch before scope filtering (backends
    # without server-side scope filtering rely on this).
    overfetch: int = 5


class RetrievalSettings(BaseModel):
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

    model_config = _SECTION

    mode: str = "bm25"
    top_k: int = 5
    hops: int = 1
    max_chars: int = 1500


class LongTermMemorySettings(BaseModel):
    """Cross-conversation long-term memory (workspace + owner + staff scoped)."""

    model_config = _SECTION

    enabled: bool = False
    recall_top_k: int = 5
    min_importance: float = 0.0
    consolidate_on_run_end: bool = True
    dedupe_threshold: float = 0.92
    digest_chars: int = 2000


class McpSettings(BaseModel):
    model_config = _SECTION

    discovery_timeout_seconds: int = 30
    call_timeout_seconds: int = 60
    auto_seed: bool = True
    config_file: str = "mcp.yml"


class AdminSettings(BaseModel):
    model_config = _SECTION

    email: str = "admin@aicollective.com"
    name: str = "Administrator"
    auto_seed: bool = True
    password: str | None = None


class SeedSettings(BaseModel):
    model_config = _SECTION

    default_data: bool = True


class BrowserSettings(BaseModel):
    """LLM config used by the staff browser-automation tools."""

    model_config = _SECTION

    model_name: str = "gemini-2.0-flash"
    model_provider: str = "google_genai"
    temperature: float = 0.0
    max_tokens: int = 1024
    api_base: str | None = None
    extra_headers: dict | None = None


class SecuritySettings(BaseModel):
    """Global operational/security flags for staff tools (NOT per-skill creds)."""

    model_config = _SECTION

    # Allow tools to reach private/loopback IPs (turns the SSRF guard off).
    allow_private_http: bool = False
    # Verbose HTTP debug logging.
    last30days_debug: bool = False


class ToolsSettings(BaseSettings):
    """Non-credential per-tool defaults (paths, display names), no config.yml
    section — deploy-time filesystem defaults or non-secret preferences that
    only a deployer would set, kept env-backed (.env) same as before.

    Actual tool/skill credentials (API keys, tokens, handles) are user-configured
    per skill only (UI, stored in MongoDB, passed to the toolkit constructor) —
    a normal user can obtain those themselves from the provider, so there is no
    .env fallback for them. Global, non-credential flags live in ``SecuritySettings``.
    """

    model_config = _SECRET_SECTION_CONFIG

    # bird_x (X scraping via local .mjs) — vendored script path, not a credential.
    bird_search_mjs: str = Field(default="", validation_alias=_alias("BIRD_SEARCH_MJS"))

    # ── X / xAI ────────────────────────────────────────────────────────────────
    xai_model: str = Field(default="grok-4-fast", validation_alias=_alias("XAI_MODEL"))

    # ── Messaging ──────────────────────────────────────────────────────────────
    viber_sender_name: str = Field(default="AI Assistant", validation_alias=_alias("VIBER_SENDER_NAME"))

    # ── Media generation ─────────────────────────────────────────────────────
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
class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")

    app: AppSettings = Field(default_factory=AppSettings)
    logging: LoggingSettings = Field(default_factory=LoggingSettings)
    llm: LLMSettings = Field(default_factory=LLMSettings)
    llm_keys: LLMKeysSettings = Field(default_factory=LLMKeysSettings)
    router: RouterSettings = Field(default_factory=RouterSettings)
    staff: StaffSettings = Field(default_factory=StaffSettings)
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
                    "app.environment=production requires a strong auth.jwt_secret_key "
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
    @property
    def llm_active_model(self) -> str | None: return self.llm.active_model
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
    @property
    def deepseek_api_key(self) -> str | None: return self.llm_keys.deepseek_api_key
    @property
    def glm_api_key(self) -> str | None: return self.llm_keys.glm_api_key

    def google_api_keys(self) -> list[str]: return self.llm_keys.google_api_keys()
    def anthropic_api_keys(self) -> list[str]: return self.llm_keys.anthropic_api_keys()
    def openai_api_keys(self) -> list[str]: return self.llm_keys.openai_api_keys()
    def open_weight_api_keys(self) -> list[str]: return self.llm_keys.open_weight_api_keys()
    def kimi_api_keys(self) -> list[str]: return self.llm_keys.kimi_api_keys()
    def deepseek_api_keys(self) -> list[str]: return self.llm_keys.deepseek_api_keys()
    def glm_api_keys(self) -> list[str]: return self.llm_keys.glm_api_keys()

    # Storage
    @property
    def storage_backend(self) -> str: return self.storage.backend
    @property
    def storage_dir(self) -> str | None: return self.storage.dir
    @property
    def seed_dir(self) -> str | None: return self.storage.seed_dir
    @property
    def file_storage_backend(self) -> str:
        """Effective byte-store backend: explicit storage.file_backend wins; else auto.

        auto = 's3' when minio.enabled, otherwise 'local' (back-compat).
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
    # Staff
    @property
    def staff_max_tool_rounds(self) -> int: return self.staff.max_tool_rounds
    @property
    def tool_timeout_seconds(self) -> int: return self.staff.tool_timeout_seconds
    @property
    def subagent_max_concurrent(self) -> int: return self.staff.subagent_max_concurrent
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


# dotenv first: config.yml's ${VAR} references (auth.jwt_secret_key, mongo.uri,
# ...) resolve against the OS environment, so .env must be loaded before
# load_config() expands them.
dotenv.load_dotenv()

# Build the Settings singleton from config.yml (the only source of app config,
# secrets resolved inline via ${VAR}) plus the handful of genuinely env-backed
# secrets-only sections (LLMKeysSettings, MinioSettings, ToolsSettings), which
# populate themselves independently since they have no config.yml section.
settings = Settings(**load_config())
