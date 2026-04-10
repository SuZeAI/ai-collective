from __future__ import annotations

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "ai-collective-backend"
    api_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080"

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
    
    # LLM configuration for browser automation
    model_name: str = "gemini-2.0-flash"
    model_provider: str = "google_genai"
    temperature: float = 0.0
    max_tokens: int = 1024
    api_base: str | None = None
    extra_headers: dict | None = None
    google_oauth_redirect_uri: str = "http://127.0.0.1:8000/api/v1/auth/oauth/callback"

    # Storage backend: "json" (default) or "mongo"
    storage_backend: str = "json"
    mongo_uri: str = "mongodb://admin:admin@localhost:27017/ai_collective?authSource=admin"
    mongo_db: str = "ai_collective"

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
