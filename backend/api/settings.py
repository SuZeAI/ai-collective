"""Typed application configuration (single source of truth).

``config.yml`` is the single, complete source for every setting, including
secrets: each top-level section maps 1:1 onto one of the nested models below,
each lowercase leaf key is that model's field name, and every field carries an
explicit ``default`` + ``description`` (see any class below). No part of the
backend reads ``os.environ`` for configuration — the *only* place an env var
still matters is inside config.yml itself, as a ``${VAR}`` / ``$VAR``
reference (e.g. ``auth.jwt_secret_key: ${JWT_SECRET_KEY}``), expanded by
``config_loader.load_config()`` from the OS environment (populated from
``.env``). Config never flows the other way: nothing in the backend sets or
reads a bare env var to configure itself.

    code defaults  <  config.yml  (${VAR} resolved from .env/OS environment)

``load_config()`` parses config.yml (deep-merged with an optional
``CONFIG_OVERRIDE_FILE``, used by the test suite) and expands every ``${VAR}``
reference; the resulting nested dict is passed straight into
``Settings(**raw)`` — pydantic's built-in nested-model coercion builds each
section from its matching sub-dict.

Access is **nested**, grouped by config.yml section, e.g.::

    settings.llm.provider
    settings.staff.context_token_limit
    settings.security.allow_private_http

A set of flat ``@property`` delegates is kept on the root for backward
compatibility with existing call-sites (``settings.llm_provider`` …).

Per-tool credentials are NOT configured here at all — they live in each
skill's ``config`` dict (stored in MongoDB, edited via the UI) and reach
toolkits through their constructor kwargs.
"""

from __future__ import annotations

import dotenv
from pydantic import BaseModel, ConfigDict, Field, model_validator

from backend.api.config_loader import load_config

_DEFAULT_JWT_SECRET = "change-me-in-production-use-openssl-rand-hex-32"

# Every section: config.yml is the only input: unknown keys ignored.
_SECTION = ConfigDict(extra="ignore")


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


# ══════════════════════════════════════════════════════════════════════════════
# Section sub-models (one per config.yml section)
# ══════════════════════════════════════════════════════════════════════════════
class AppSettings(BaseModel):
    model_config = _SECTION

    app_name: str = Field(default="ai-collective-backend", description="FastAPI app title")
    environment: str = Field(
        default="development",
        description="'development' | 'production' — gates the production safety checks on the root",
    )
    api_prefix: str = Field(default="/api/v1", description="Prefix for all API routers")
    cors_origins: str = Field(
        default=(
            "http://localhost:5173,http://127.0.0.1:5173,"
            "http://localhost:8080,http://127.0.0.1:8080,"
            "http://localhost:2026,http://127.0.0.1:2026"
        ),
        description="Comma-separated list of allowed CORS origins",
    )
    frontend_url: str = Field(default="http://localhost:8080", description="Base URL of the frontend app")
    vite_api_base_url: str = Field(
        default="http://localhost:8000/api/v1", description="API base URL baked into the Vite frontend build"
    )

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


class LoggingSettings(BaseModel):
    model_config = _SECTION

    log_level: str = Field(default="info", description="critical | error | warning | info | debug")
    log_console: bool = Field(default=True, description="Log to stdout/stderr")
    log_file: bool = Field(default=False, description="Log to a rotating file under logs/")
    log_max_bytes: int = Field(default=10 * 1024 * 1024, description="Rotating log file size cap in bytes")
    log_backup_count: int = Field(default=5, description="Number of rotated log files to keep")


class FailoverSettings(BaseModel):
    model_config = _SECTION

    strategy: str = Field(default="rotate", description="rotate (local key rotation) | 9router")
    rotate_max_requests_per_min: int = Field(
        default=0, description="Per-key requests/min budget before proactively skipping it (0 = unlimited)"
    )
    rotate_max_tokens_per_min: int = Field(
        default=0, description="Per-key tokens/min budget before proactively skipping it (0 = unlimited)"
    )
    key_cooldown_seconds: float = Field(
        default=60.0, description="Cooldown applied to a key after a rate-limit/quota/5xx error"
    )


class LLMSettings(BaseModel):
    model_config = _SECTION

    provider: str = Field(default="google", description="Legacy fallback provider when no `models:` entry resolves")
    model: str | None = Field(default=None, description="Legacy fallback model name")
    api_base: str | None = Field(default=None, description="Legacy fallback custom OpenAI-compatible base URL")
    active_model: str | None = Field(
        default=None, description="Ops-level override of which `models:` entry is active"
    )
    failover: FailoverSettings = Field(
        default_factory=FailoverSettings, description="Global key-rotation defaults (a `models:` entry may override with its own)"
    )

    # Fallback defaults for the middleware stack when `middleware:` (config.yml,
    # read independently by infrastructure/llm/middleware/config.py) omits a
    # knob. Not config.yml-backed themselves — just code defaults.
    tool_retry_max: int = Field(default=2, description="Fallback transient tool-failure retry count")
    fallback_models: str | None = Field(default=None, description="Fallback comma-separated fallback model names")
    summarization_enabled: bool = Field(default=False, description="Fallback: LLM-based history summarization")
    summarization_model: str | None = Field(default=None, description="Fallback summarization model name")
    summarization_trigger_tokens: int = Field(default=8000, description="Fallback summarization trigger token count")
    summarization_keep_messages: int = Field(default=20, description="Fallback messages kept verbatim after summarizing")

    loop_detection_enabled: bool = Field(
        default=True, description="Fallback: short-circuit an staff that repeats the same tool call"
    )
    loop_detection_max_repeats: int = Field(default=3, description="Fallback repeat count before loop detection fires")
    tool_call_limit: int = Field(default=0, description="Fallback run-wide tool-execution cap (0 = off)")
    model_retry_max: int = Field(default=0, description="Fallback transient model-error retry count (0 = off)")
    context_editing_enabled: bool = Field(default=False, description="Fallback: prune old tool outputs on large input")
    context_editing_trigger_tokens: int = Field(default=100000, description="Fallback context-editing trigger token count")
    context_editing_keep: int = Field(default=3, description="Fallback number of recent tool outputs kept")

    rolling_summary_enabled: bool = Field(default=False, description="Fallback: LLM-free history compactor")
    rolling_summary_trigger_tokens: int = Field(default=6000, description="Fallback rolling-summary trigger token count")
    rolling_summary_keep_messages: int = Field(default=10, description="Fallback messages kept verbatim after compaction")
    ltm_middleware_enabled: bool = Field(default=False, description="Fallback: recall/persist via long-term memory")
    tool_cache_enabled: bool = Field(default=False, description="Fallback: cache identical idempotent tool calls")
    tool_cache_deny_tools: str | None = Field(default=None, description="Fallback comma-separated tools never cached")
    run_token_budget: int = Field(default=0, description="Fallback soft-stop token budget per run (0 = off)")
    pii_redaction_enabled: bool = Field(default=False, description="Fallback: scrub emails/cards/secrets from tool results")
    guardrail_deny_tools: str | None = Field(default=None, description="Fallback comma-separated blocked tools")
    guardrail_deny_patterns: str | None = Field(default=None, description="Fallback comma-separated blocked arg regexes")
    prompt_cache_enabled: bool = Field(default=False, description="Fallback: Anthropic prompt-caching (no-op elsewhere)")
    prompt_cache_ttl: str = Field(default="5m", description="Fallback Anthropic prompt-cache TTL")
    prompt_cache_min_messages: int = Field(default=0, description="Fallback minimum messages before caching kicks in")

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


class LLMKeysSettings(BaseModel):
    """LLM provider API keys — a secrets pool for tool fallback (gemini.py,
    image_generation.py, text_to_speech.py use these when no explicit key is
    passed). Sourced from config.yml's ``llm_keys:`` section, whose values are
    themselves ``${VAR}`` references resolved from .env. May hold a single key
    or several comma/whitespace-separated keys for rotation."""

    model_config = _SECTION

    google_api_key: str | None = Field(default=None, description="Google Gemini API key(s)")
    anthropic_api_key: str | None = Field(default=None, description="Anthropic API key(s)")
    openai_api_key: str | None = Field(default=None, description="OpenAI API key(s)")
    open_weight_api_key: str | None = Field(default=None, description="OpenRouter API key(s)")
    kimi_api_key: str | None = Field(default=None, description="Moonshot Kimi API key(s)")
    deepseek_api_key: str | None = Field(default=None, description="DeepSeek API key(s)")
    glm_api_key: str | None = Field(default=None, description="Zhipu GLM API key(s)")

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

    port: int = Field(default=20128, description="9router gateway port (docker profile: router)")
    public_url: str = Field(default="http://localhost:20128", description="9router gateway public URL")
    jwt_secret: str | None = Field(default=None, description="9router gateway JWT signing secret")
    initial_password: str | None = Field(default=None, description="9router gateway initial admin password")


class StaffSettings(BaseModel):
    model_config = _SECTION

    max_tool_rounds: int = Field(default=6, description="Max LLM<->tool rounds per staff turn")
    tool_timeout_seconds: int = Field(default=0, description="Per-tool execution timeout in seconds (0 = disabled)")
    subagent_max_concurrent: int = Field(default=3, description="Max concurrent subagents")
    subagent_max_turns: int = Field(default=6, description="Max turns per subagent")
    context_token_limit: int = Field(default=12000, description="Context budget per agent turn")
    output_token_reserve: int = Field(default=2000, description="Tokens reserved for the model's reply")
    llm_timeout_seconds: int = Field(default=120, description="Per LLM call timeout in seconds")
    llm_max_retries: int = Field(default=2, description="Per LLM call retry count")
    ask_user_timeout_seconds: int = Field(default=600, description="ask_user prompt wait limit in seconds")
    pause_timeout_seconds: int = Field(
        default=1800,
        description="Max time a run may sit paused (POST /llm/agent-graph/pause) before it is auto-resumed",
    )
    mesh_fanout_max_concurrent: int | None = Field(
        default=None, description="Mesh fan-out concurrency; falls back to subagent_max_concurrent when unset"
    )


class StorageSettings(BaseModel):
    model_config = _SECTION

    backend: str = Field(default="json", description="json (file) | mongo")
    dir: str | None = Field(default=None, description="Live DB dir (relative to project root)")
    seed_dir: str | None = Field(default=None, description="Read-only default catalog seeded FROM")
    file_backend: str = Field(
        default="",
        description="Where file bytes durably live: 'local' | 's3' | '' (auto: s3 when minio.enabled)",
    )


class MongoSettings(BaseModel):
    model_config = _SECTION

    uri: str = Field(
        default="mongodb://admin:admin@localhost:27017/ai_collective?authSource=admin",
        description="MongoDB connection URI (credentials embedded)",
    )
    db: str = Field(default="ai_collective", description="MongoDB database name")


class GraphSettings(BaseModel):
    model_config = _SECTION

    build_mode: str = Field(default="static", description="static (spaCy, no token cost) | llm")
    llm_provider: str | None = Field(default=None, description="LLM provider used when build_mode=llm")
    llm_model: str | None = Field(default=None, description="LLM model used when build_mode=llm")
    backend: str = Field(
        default="auto",
        description="Knowledge-graph persistence backend: 'auto' follows storage.backend | 'neo4j'",
    )
    neo4j_uri: str | None = Field(default=None, description="Neo4j connection URI, e.g. bolt://localhost:7687")
    neo4j_user: str = Field(default="neo4j", description="Neo4j username")
    neo4j_password: str | None = Field(default=None, description="Neo4j password")
    neo4j_database: str = Field(default="neo4j", description="Neo4j database name")


class TaskQueueSettings(BaseModel):
    model_config = _SECTION

    backend: str = Field(default="memory", description="memory (single instance) | rabbitmq")
    max_concurrent: int = Field(
        default=10, description="Max staff-graph runs executing at once, system-wide (excess runs queue)"
    )
    rabbitmq_url: str | None = Field(default=None, description="RabbitMQ connection URL")


class LockSettings(BaseModel):
    model_config = _SECTION

    backend: str = Field(default="threading", description="threading (single instance) | redis")
    redis_url: str | None = Field(default=None, description="Redis connection URL")


class SandboxSettings(BaseModel):
    model_config = _SECTION

    mode: str = Field(default="local", description="local | k8s")
    image: str = Field(
        default="enterprise-public-cn-beijing.cr.volces.com/vefaas-public/all-in-one-sandbox:latest",
        description="k8s sandbox container image",
    )
    replicas: int = Field(default=3, description="k8s sandbox pool replica count")
    idle_timeout: int = Field(default=600, description="k8s sandbox idle eviction timeout in seconds")
    provisioner_url: str | None = Field(default=None, description="k8s sandbox provisioner service URL")
    timeout: int = Field(default=120, description="Sandbox code-execution timeout in seconds")
    workspace: str | None = Field(default=None, description="Local sandbox workspace directory override")


class MinioSettings(BaseModel):
    """S3-compatible object storage for backing up conversation sandbox files
    and, when storage.file_backend=s3, document uploads."""

    model_config = _SECTION

    enabled: bool = Field(default=False, description="Enable MinIO/S3 object storage")
    endpoint: str = Field(default="localhost:9000", description="MinIO/S3 endpoint host:port")
    access_key: str = Field(default="minioadmin", description="MinIO/S3 access key")
    secret_key: str = Field(default="minioadmin", description="MinIO/S3 secret key")
    bucket: str = Field(default="sandbox-backups", description="MinIO/S3 bucket name")
    secure: bool = Field(default=False, description="Use HTTPS for the MinIO/S3 endpoint")


class AuthSettings(BaseModel):
    model_config = _SECTION

    jwt_secret_key: str = Field(default=_DEFAULT_JWT_SECRET, description="HMAC signing key for auth JWTs")
    jwt_algorithm: str = Field(default="HS256", description="JWT signing algorithm")
    jwt_access_token_expire_minutes: int = Field(
        default=60 * 24 * 7, description="Access-token lifetime in minutes"
    )
    google_login_client_id: str | None = Field(default=None, description="Google sign-in OAuth client ID")
    google_login_client_secret: str | None = Field(default=None, description="Google sign-in OAuth client secret")
    google_login_redirect_uri: str = Field(
        default="http://127.0.0.1:8000/api/v1/auth/google/callback",
        description="Google sign-in OAuth callback URL",
    )
    google_oauth_redirect_uri: str = Field(
        default="http://127.0.0.1:8000/api/v1/auth/oauth/callback",
        description="Google workspace-tools OAuth callback URL",
    )
    google_oauth_client_secret_path: str | None = Field(
        default=None, description="Path to the Google OAuth client-secret JSON file (workspace tools)"
    )
    credentials_path: str | None = Field(default=None, description="Path to a Google credentials file")
    service_account_path: str | None = Field(default=None, description="Path to a Google service-account JSON file")


class WorkingMemorySettings(BaseModel):
    model_config = _SECTION

    enabled: bool = Field(default=True, description="Enable per-conversation short-term working memory")
    max_notes: int = Field(default=40, description="Max notes kept before compaction")
    compact_tokens: int = Field(default=1500, description="Token threshold that triggers compaction")
    note_chars: int = Field(default=600, description="Max characters per note")
    summary_chars: int = Field(default=3000, description="Max characters in the working-memory summary")
    digest_chars: int = Field(default=4000, description="Max characters in the working-memory digest")


class EmbeddingSettings(BaseModel):
    """Pluggable embedding backend for real (vector) RAG.

    Off by default — when disabled the knowledge graph / long-term memory /
    document RAG all fall back to lexical retrieval. ``provider`` selects a
    real model (google/openai/open_weight) or the dependency-free ``hashing``
    fallback. Keys are reused from ``LLMKeysSettings``.
    """

    model_config = _SECTION

    enabled: bool = Field(default=False, description="Enable real vector embeddings (off = lexical fallback)")
    provider: str = Field(default="hashing", description="hashing (dependency-free) | google | openai | open_weight")
    model: str | None = Field(default=None, description="Provider-specific embedding model name")
    dim: int = Field(default=256, description="Embedding vector dimensionality")
    batch_size: int = Field(default=64, description="Embedding batch size")


class VectorStoreSettings(BaseModel):
    """ANN vector index for long-term memory recall.

    ``backend=none`` (default) keeps the brute-force cosine over scope-filtered
    records in the repository. ``faiss`` builds a local on-disk index; ``qdrant``
    uses an external Qdrant service. Both degrade to brute-force if the optional
    dependency is missing or the backend can't be reached.
    """

    model_config = _SECTION

    backend: str = Field(default="none", description="none (brute-force) | faiss (local) | qdrant (service)")
    faiss_path: str | None = Field(
        default=None, description="faiss index directory (defaults under storage.dir)"
    )
    qdrant_url: str | None = Field(default=None, description="Qdrant service URL")
    qdrant_api_key: str | None = Field(default=None, description="Qdrant API key")
    qdrant_collection: str = Field(default="ltm_memory", description="Qdrant collection name")
    overfetch: int = Field(
        default=5, description="Extra candidates to over-fetch before scope filtering"
    )


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

    mode: str = Field(default="bm25", description="bm25 | qdrant | neo4j | hybrid")
    top_k: int = Field(default=5, description="Number of chunks/results to retrieve")
    hops: int = Field(default=1, description="Graph expansion depth for neo4j/hybrid")
    max_chars: int = Field(default=1500, description="Max characters of retrieved context injected")


class LongTermMemorySettings(BaseModel):
    """Cross-conversation long-term memory (workspace + owner + staff scoped)."""

    model_config = _SECTION

    enabled: bool = Field(default=False, description="Enable cross-conversation long-term memory")
    recall_top_k: int = Field(default=5, description="Number of memories recalled per run")
    min_importance: float = Field(default=0.0, description="Minimum importance score to recall a memory")
    consolidate_on_run_end: bool = Field(
        default=True, description="Promote salient working-memory notes into long-term memory at run end"
    )
    dedupe_threshold: float = Field(default=0.92, description="Similarity threshold above which memories are deduped")
    digest_chars: int = Field(default=2000, description="Max characters in the long-term-memory digest")


class McpSettings(BaseModel):
    model_config = _SECTION

    discovery_timeout_seconds: int = Field(default=30, description="list_tools handshake ceiling in seconds")
    call_timeout_seconds: int = Field(default=60, description="Default per-tool-call timeout in seconds")
    auto_seed: bool = Field(default=True, description="Seed enabled servers from mcp.yml on boot")
    config_file: str = Field(default="mcp.yml", description="Path to the MCP server config file, relative to project root")


class AdminSettings(BaseModel):
    model_config = _SECTION

    email: str = Field(default="admin@aicollective.com", description="Bootstrap admin account email")
    name: str = Field(default="Administrator", description="Bootstrap admin account display name")
    auto_seed: bool = Field(default=True, description="Auto-create the bootstrap admin account on boot")
    password: str | None = Field(default=None, description="Bootstrap admin account password")


class SeedSettings(BaseModel):
    model_config = _SECTION

    default_data: bool = Field(default=True, description="Seed the default catalog data on boot")


class BrowserSettings(BaseModel):
    """LLM config used by the staff browser-automation tools."""

    model_config = _SECTION

    model_name: str = Field(default="gemini-2.0-flash", description="Chat model used to drive browser automation")
    model_provider: str = Field(default="google_genai", description="LangChain provider key for the browser model")
    temperature: float = Field(default=0.0, description="Sampling temperature for the browser model")
    max_tokens: int = Field(default=1024, description="Max output tokens for the browser model")
    api_base: str | None = Field(default=None, description="Custom API base URL for the browser model")
    extra_headers: dict | None = Field(default=None, description="Extra HTTP headers sent with browser-model calls")


class SecuritySettings(BaseModel):
    """Global operational/security flags for staff tools (NOT per-skill creds)."""

    model_config = _SECTION

    allow_private_http: bool = Field(
        default=False, description="Allow tools to reach private/loopback IPs (turns the SSRF guard off)"
    )
    last30days_debug: bool = Field(default=False, description="Verbose HTTP debug logging")


class ToolsSettings(BaseModel):
    """Non-credential per-tool defaults (paths, display names) — deploy-time
    filesystem defaults or non-secret preferences that only a deployer would
    set. Actual tool/skill credentials (API keys, tokens, handles) are
    user-configured per skill only (UI, stored in MongoDB, passed to the
    toolkit constructor) — a normal user can obtain those themselves from the
    provider, so there is no config.yml entry for them. Global, non-credential
    flags live in ``SecuritySettings``.
    """

    model_config = _SECTION

    bird_search_mjs: str = Field(
        default="", description="bird_x (X scraping via local .mjs) vendored script path override"
    )
    xai_model: str = Field(default="grok-4-fast", description="Default xAI/Grok model name")
    viber_sender_name: str = Field(default="AI Assistant", description="Default Viber bot sender display name")
    tts_output_dir: str = Field(default="", description="Directory text-to-speech output files are written to")
    google_calendar_token_path: str = Field(default="", description="Google Calendar OAuth token file path")
    google_docs_token_path: str = Field(default="", description="Google Docs OAuth token file path")
    google_drive_token_path: str = Field(default="", description="Google Drive OAuth token file path")
    google_sheets_token_path: str = Field(default="", description="Google Sheets OAuth token file path")
    google_slides_token_path: str = Field(default="", description="Google Slides OAuth token file path")


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
# llm_keys.*, ...) resolve against the OS environment, so .env must be loaded
# before load_config() expands them.
dotenv.load_dotenv()

# The Settings singleton: config.yml is the only input, secrets resolved
# inline via ${VAR}. Nothing here reads os.environ directly.
settings = Settings(**load_config())
