from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class FailoverEntry(BaseModel):
    """A model entry's own key-rotation policy (mirrors ``FailoverSettings``)."""

    model_config = ConfigDict(extra="allow")

    strategy: str = Field(default="rotate", description="rotate | 9router (aliases: router, off)")
    rotate_max_requests_per_min: int = Field(default=0, description="Per-key RPM budget, 0 = unlimited")
    rotate_max_tokens_per_min: int = Field(default=0, description="Per-key TPM budget, 0 = unlimited")
    key_cooldown_seconds: float = Field(default=60.0, description="Errored-key cooldown before retry")


class ModelConfig(BaseModel):
    """One chat-model entry from the ``models:`` list in config.yml.

    ``provider_name`` (falling back to ``name``) selects which of the 7
    built-in ``backend.infrastructure.llm.providers.*`` wrapper classes to
    instantiate (see ``factory._normalize_provider`` /
    ``factory.SUPPORTED_PROVIDERS``) and ``model`` is the provider's model id.

    ``api_key`` (declared via ``extra="allow"``, not a typed field — may hold
    several comma-separated keys for rotation) is always sourced from this
    entry / ``.env`` through config.yml — this registry is the only source of
    provider API keys (see ``models_config.find_model_for_provider``).
    """

    model_config = ConfigDict(extra="allow")

    name: str = Field(..., description="Unique name for the model (selectable as the active one)")
    display_name: str | None = Field(default=None, description="Human-friendly name for UIs")
    description: str | None = Field(default=None, description="Description for the model")
    model: str = Field(..., description="Provider model id, e.g. gpt-4o")
    provider_name: str | None = Field(default=None, description="Label for usage tracking / provider resolution")
    base_url: str | None = Field(default=None, description="Provider API base URL override")

    # Whether this entry is selectable as the active model (Settings UI /
    # LLM_ACTIVE_MODEL env). The first enabled entry is the boot default.
    enabled: bool = Field(default=False, description="Selectable as the active model")
    failover: FailoverEntry = Field(default_factory=FailoverEntry, description="This model's key-rotation policy")

    supports_thinking: bool = Field(default=False, description="Whether the model supports extended thinking")
    supports_reasoning_effort: bool = Field(default=False, description="Whether the model supports reasoning effort")
    supports_vision: bool = Field(default=False, description="Whether the model supports image inputs")

    # Whether this entry's api_key may be used as the fallback key for the
    # matching tool/embedding capability (gemini.py, image_generation.py,
    # text_to_speech.py, embeddings.py) when the caller supplies none of its own.
    supports_embedding: bool = Field(default=False, description="Key usable as an embeddings fallback")
    supports_image_gen: bool = Field(default=False, description="Key usable as an image-generation tool fallback")
    supports_tts: bool = Field(default=False, description="Key usable as a text-to-speech tool fallback")
    supports_video_gen: bool = Field(default=False, description="Key usable as a video-generation tool fallback")

    when_thinking_enabled: dict | None = Field(
        default=None, description="Extra kwargs merged into the model when thinking is enabled"
    )
    when_thinking_disabled: dict | None = Field(
        default=None, description="Extra kwargs merged into the model when thinking is disabled"
    )
    thinking: dict | None = Field(
        default=None,
        description="Shortcut for when_thinking_enabled; merged with it when both are set",
    )
