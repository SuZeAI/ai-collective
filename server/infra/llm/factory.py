from __future__ import annotations

from typing import TYPE_CHECKING

from server.app.ports.llm import LLMProvider
from server.infra.llm.providers.anthropic_langchain import AnthropicLangChainProvider
from server.infra.llm.config.models_config import find_model_for_provider, get_model_config

if TYPE_CHECKING:
    from server.api.settings import ModelConfig
from server.infra.llm.providers.google_langchain import GoogleLangChainProvider
from server.infra.llm.providers.open_weight_langchain import OpenWeightLangChainProvider
from server.infra.llm.providers.openai_langchain import OpenAILangChainProvider
from server.infra.llm.providers.kimi_langchain import KimiLangChainProvider
from server.infra.llm.providers.deepseek_langchain import DeepSeekLangChainProvider
from server.infra.llm.providers.glm_langchain import GLMLangChainProvider
from server.infra.llm.providers.rotation import RotationConfig


DEFAULT_PROVIDER_MODELS = {
    "anthropic": "claude-sonnet-4",
    "openai": "gpt-4o",
    "google": "gemini-3-flash-preview",
    "open_weight": "qwen3.5-397B-A17B",
    "kimi": "kimi-k2-0711-preview",
    "deepseek": "deepseek-chat",
    "glm": "glm-4.6",
}

SUPPORTED_PROVIDERS = {"anthropic", "openai", "google", "open_weight", "kimi", "deepseek", "glm"}

# Maps a normalized provider name to the create_llm_provider() kwarg its key goes in.
_PROVIDER_API_KEY_KWARGS = {
    "anthropic": "anthropic_api_key",
    "openai": "openai_api_key",
    "open_weight": "open_weight_api_key",
    "kimi": "kimi_api_key",
    "deepseek": "deepseek_api_key",
    "glm": "glm_api_key",
    "google": "google_api_key",
}


def _normalize_provider(provider: str | None) -> str:
    normalized = (provider or "google").strip().lower().replace("-", "_")
    if normalized in {"gemini", "google_genai"}:
        return "google"
    if normalized in {"openrouter", "open_router", "open_weight", "openweight"}:
        return "open_weight"
    if normalized in {"moonshot", "moonshotai", "kimi"}:
        return "kimi"
    if normalized in {"deepseek", "deep_seek"}:
        return "deepseek"
    if normalized in {"glm", "zhipu", "zhipuai", "z_ai", "bigmodel"}:
        return "glm"
    return normalized


def create_llm_provider(
    *,
    provider: str | None = None,
    model: str | None = None,
    google_api_key: str | list[str] | None = None,
    anthropic_api_key: str | list[str] | None = None,
    openai_api_key: str | list[str] | None = None,
    open_weight_api_key: str | list[str] | None = None,
    kimi_api_key: str | list[str] | None = None,
    deepseek_api_key: str | list[str] | None = None,
    glm_api_key: str | list[str] | None = None,
    max_tool_rounds: int = 6,
    tool_timeout_seconds: int | None = None,
    base_url: str | None = None,
    failover: RotationConfig | None = None,
) -> LLMProvider | None:
    resolved_provider = _normalize_provider(provider)
    if resolved_provider not in SUPPORTED_PROVIDERS:
        supported = ", ".join(sorted(SUPPORTED_PROVIDERS))
        raise ValueError(f"Unsupported LLM provider '{provider}'. Supported providers: {supported}")

    resolved_model = model or DEFAULT_PROVIDER_MODELS[resolved_provider]

    if resolved_provider == "anthropic":
        if not anthropic_api_key:
            return None
        return AnthropicLangChainProvider(
            model=resolved_model,
            api_key=anthropic_api_key,
            max_tool_rounds=max_tool_rounds,
            tool_timeout_seconds=tool_timeout_seconds,
            failover=failover,
        )
    if resolved_provider == "openai":
        if not openai_api_key:
            return None
        return OpenAILangChainProvider(
            model=resolved_model,
            api_key=openai_api_key,
            base_url=base_url,
            max_tool_rounds=max_tool_rounds,
            tool_timeout_seconds=tool_timeout_seconds,
            failover=failover,
        )
    if resolved_provider == "open_weight":
        if not open_weight_api_key:
            return None
        return OpenWeightLangChainProvider(
            model=resolved_model,
            api_key=open_weight_api_key,
            base_url=base_url,
            max_tool_rounds=max_tool_rounds,
            tool_timeout_seconds=tool_timeout_seconds,
            failover=failover,
        )
    if resolved_provider == "kimi":
        if not kimi_api_key:
            return None
        return KimiLangChainProvider(
            model=resolved_model,
            api_key=kimi_api_key,
            base_url=base_url,
            max_tool_rounds=max_tool_rounds,
            tool_timeout_seconds=tool_timeout_seconds,
            failover=failover,
        )
    if resolved_provider == "deepseek":
        if not deepseek_api_key:
            return None
        return DeepSeekLangChainProvider(
            model=resolved_model,
            api_key=deepseek_api_key,
            base_url=base_url,
            max_tool_rounds=max_tool_rounds,
            tool_timeout_seconds=tool_timeout_seconds,
            failover=failover,
        )
    if resolved_provider == "glm":
        if not glm_api_key:
            return None
        return GLMLangChainProvider(
            model=resolved_model,
            api_key=glm_api_key,
            base_url=base_url,
            max_tool_rounds=max_tool_rounds,
            tool_timeout_seconds=tool_timeout_seconds,
            failover=failover,
        )
    if not google_api_key:
        return None
    return GoogleLangChainProvider(
        model=resolved_model,
        api_key=google_api_key,
        max_tool_rounds=max_tool_rounds,
        tool_timeout_seconds=tool_timeout_seconds,
        failover=failover,
    )


def build_default_llm_provider(
    *,
    provider: str | None = None,
    model: str | None = None,
    max_tool_rounds: int | None = None,
    tool_timeout_seconds: int | None = None,
    base_url: str | None = None,
    model_config: ModelConfig | None = None,
) -> LLMProvider | None:
    """create_llm_provider(), resolving every provider API key in one place.

    Every call site used to hand-list all 7 provider keys itself — 4 near-
    identical copies across deps.py/document_tools.py — so adding a new
    provider (already happened twice, for deepseek/glm) meant editing all 4
    in lockstep or silently missing one.

    ``model_config`` — the resolved active entry from config.yml's ``models:``
    registry (see ``server.infra.llm.config``) — supplies
    provider/model/base_url/failover from that entry, and its own ``api_key:``
    (sourced from config.yml/.env through the registry) is used whenever it's
    set. When not given explicitly, it defaults to ``get_model_config()`` (the
    config-level active model); callers that need the DB-persisted Settings-UI
    override resolve it themselves first (see ``server.api.deps``). Without a
    usable ``model_config``, the key falls back to the first ``models:`` entry
    matching the resolved provider (``find_model_for_provider``) — there is no
    other source of provider API keys. Explicit provider/model/base_url args
    still win (e.g. the knowledge-graph builder's separate
    GRAPH_LLM_PROVIDER/MODEL override). Raises if no provider can be resolved
    from either source — there is no more legacy `llm.provider` fallback.
    """
    from server.api.settings import settings

    resolved_max_tool_rounds = (
        max_tool_rounds if max_tool_rounds is not None else settings.staff_max_tool_rounds
    )
    resolved_tool_timeout = (
        tool_timeout_seconds if tool_timeout_seconds is not None else settings.tool_timeout_seconds
    )

    model_config = model_config or get_model_config()
    if model_config is None and provider is None:
        raise RuntimeError(
            "No active LLM model: enable at least one entry under `models:` in "
            "config.yml (or pass an explicit provider/model)."
        )

    if (
        model_config is not None
        and provider is None
        and model is None
        and base_url is None
        and getattr(model_config, "api_key", None)
    ):
        resolved_provider = _normalize_provider(model_config.provider_name or model_config.name)
        key_kwarg = _PROVIDER_API_KEY_KWARGS.get(resolved_provider)
        return create_llm_provider(
            provider=resolved_provider,
            model=model_config.model,
            base_url=model_config.base_url,
            max_tool_rounds=resolved_max_tool_rounds,
            tool_timeout_seconds=resolved_tool_timeout,
            failover=RotationConfig.from_model_entry(model_config.failover),
            **({key_kwarg: model_config.api_key} if key_kwarg else {}),
        )

    resolved_provider = provider
    resolved_model = model
    resolved_base_url = base_url
    resolved_failover: RotationConfig | None = None
    if model_config is not None:
        resolved_provider = resolved_provider or _normalize_provider(
            model_config.provider_name or model_config.name
        )
        resolved_model = resolved_model or model_config.model
        resolved_base_url = resolved_base_url or model_config.base_url
        resolved_failover = RotationConfig.from_model_entry(model_config.failover)

    final_provider = _normalize_provider(resolved_provider)
    fallback_entry = find_model_for_provider(final_provider)
    fallback_key_kwarg = _PROVIDER_API_KEY_KWARGS.get(final_provider)

    return create_llm_provider(
        provider=final_provider,
        model=resolved_model,
        base_url=resolved_base_url,
        max_tool_rounds=resolved_max_tool_rounds,
        tool_timeout_seconds=resolved_tool_timeout,
        failover=resolved_failover,
        **({fallback_key_kwarg: fallback_entry.api_key} if fallback_key_kwarg and fallback_entry else {}),
    )
