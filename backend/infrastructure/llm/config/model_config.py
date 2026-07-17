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

    Mirrors the DeerFlow concept (see ``context/config.example.yaml``): ``use``
    names the LangChain chat-model class to instantiate (``"module:ClassName"``)
    and ``model`` is the provider's model id. Every other key (``api_key``,
    ``base_url``, ``temperature``, ``max_tokens``, ``default_headers`` …) flows
    through to the class constructor unchanged thanks to ``extra="allow"``.

    A few extra keys are consumed specially by a builder: ``api_key`` (the secret,
    may hold several comma-separated keys for rotation), ``api_key_field`` (the
    constructor kwarg the key is passed as — defaults to ``api_key``; Google needs
    ``google_api_key``) and ``provider_name`` (label for usage tracking / logs,
    and the source used to resolve which of the 7 built-in providers this entry
    maps to — see ``factory._normalize_provider``).
    """

    model_config = ConfigDict(extra="allow")

    name: str = Field(..., description="Unique name for the model (selectable as the active one)")
    display_name: str | None = Field(default=None, description="Human-friendly name for UIs")
    description: str | None = Field(default=None, description="Description for the model")
    use: str = Field(..., description="Class path of the chat model, e.g. langchain_openai:ChatOpenAI")
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
