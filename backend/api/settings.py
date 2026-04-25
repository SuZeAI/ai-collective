from __future__ import annotations

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── Application ───────────────────────────────────────────────────────────
    app_name: str = "ai-collective-backend"
    api_prefix: str = "/api/v1"
    # Include port 2026 (nginx) so the UI served through the proxy can call the API
    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:8080,http://127.0.0.1:8080,"
        "http://localhost:2026,http://127.0.0.1:2026"
    )
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

    # ── Task queue ────────────────────────────────────────────────────────────
    # backend: "memory" (default, single-instance) | "rabbitmq" (multi-instance)
    task_queue_backend: str = "memory"
    task_queue_max_concurrent: int = 3
    rabbitmq_url: str | None = None

    # ── Repository lock ───────────────────────────────────────────────────────
    # backend: "threading" (default, single-instance) | "redis" (multi-instance)
    lock_backend: str = "threading"
    redis_url: str | None = None

    # ── Storage ───────────────────────────────────────────────────────────────
    # Absolute path for JSON storage files.  Defaults to <project_root>/storage.
    storage_dir: str | None = None

    # ── Sandbox ───────────────────────────────────────────────────────────────
    # mode: "local"  — commands run inside the backend process (default, dev-only)
    #       "remote" — commands run inside an isolated AIO sandbox container
    sandbox_mode: str = "local"

    # remote mode — direct URL to a running AIO sandbox container
    # e.g. http://sandbox:8080  (when using the `sandbox` Docker service)
    sandbox_url: str | None = None

    # remote mode — URL of the provisioner that creates per-request sandbox Pods (K8s)
    # e.g. http://provisioner:8002  (when using the `provisioner` Docker service)
    sandbox_provisioner_url: str | None = None

    # Shell command timeout in seconds (local and remote modes)
    sandbox_timeout: int = 60

    # local mode — workspace directory on the host / inside the container.
    # Auto-created on first use.  Defaults to ~/sandbox_workspace.
    sandbox_workspace: str | None = None

    # ── Browser automation ────────────────────────────────────────────────────
    model_name: str = "gemini-2.0-flash"
    model_provider: str = "google_genai"
    temperature: float = 0.0
    max_tokens: int = 1024
    api_base: str | None = None
    extra_headers: dict | None = None
    google_oauth_redirect_uri: str = "http://127.0.0.1:8000/api/v1/auth/oauth/callback"

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
