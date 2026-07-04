from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


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
    ``google_api_key``) and ``provider_name`` (label for usage tracking / logs).
    """

    model_config = ConfigDict(extra="allow")

    name: str = Field(..., description="Unique name for the model (referenced by llm.active_model)")
    display_name: str | None = Field(default=None, description="Human-friendly name for UIs")
    description: str | None = Field(default=None, description="Description for the model")
    use: str = Field(..., description="Class path of the chat model, e.g. langchain_openai:ChatOpenAI")
    model: str = Field(..., description="Provider model id, e.g. gpt-4o")

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
