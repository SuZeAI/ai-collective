from __future__ import annotations

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── Application ───────────────────────────────────────────────────────────
    app_name: str = "ai-collective-backend"
    api_prefix: str = "/api/v1"
    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:8080,http://127.0.0.1:8080,"
        "http://localhost:2026,http://127.0.0.1:2026"
    )
    frontend_url: str = "http://localhost:8080"
    log_level: str = "info"

    # ── LLM providers ─────────────────────────────────────────────────────────
    llm_provider: str = "google"
    llm_model: str | None = None
    llm_api_base: str | None = None
    google_api_key: str | None = None
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    open_weight_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("OPEN_WEIGHT_API_KEY", "OPENROUTER_API_KEY"),
    )

    # ── Storage ───────────────────────────────────────────────────────────────
    # backend: "json" (default, file-based) | "mongo" (MongoDB)
    storage_backend: str = "json"
    # Absolute path for JSON storage files. Defaults to <project_root>/storage.
    storage_dir: str | None = None

    # ── MongoDB ───────────────────────────────────────────────────────────────
    mongo_uri: str = "mongodb://admin:admin@localhost:27017/ai_collective?authSource=admin"
    mongo_db: str = "ai_collective"

    # ── Task queue ────────────────────────────────────────────────────────────
    # backend: "memory" (default, single-instance) | "rabbitmq" (multi-instance)
    task_queue_backend: str = "memory"
    task_queue_max_concurrent: int = 3
    rabbitmq_url: str | None = None

    # ── Repository lock ───────────────────────────────────────────────────────
    # backend: "threading" (default, single-instance) | "redis" (multi-instance)
    lock_backend: str = "threading"
    redis_url: str | None = None

    # ── Sandbox ───────────────────────────────────────────────────────────────
    # mode: "local"  — commands run inside the backend process (default, dev-only)
    #       "remote" — commands run inside an isolated AIO sandbox container
    sandbox_mode: str = "local"
    sandbox_url: str | None = None
    sandbox_provisioner_url: str | None = None
    sandbox_timeout: int = 60
    sandbox_workspace: str | None = None

    # ── JWT / User auth ───────────────────────────────────────────────────────
    jwt_secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # ── Google OAuth (social sign-in) ─────────────────────────────────────────
    google_login_client_id: str | None = None
    google_login_client_secret: str | None = None
    google_login_redirect_uri: str = "http://127.0.0.1:8000/api/v1/auth/google/callback"

    # ── Google OAuth (tool/workspace integration) ─────────────────────────────
    google_oauth_redirect_uri: str = "http://127.0.0.1:8000/api/v1/auth/oauth/callback"

    # ── Browser automation (agent browser tools) ──────────────────────────────
    model_name: str = "gemini-2.0-flash"
    model_provider: str = "google_genai"
    temperature: float = 0.0
    max_tokens: int = 1024
    api_base: str | None = None
    extra_headers: dict | None = None

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
