from __future__ import annotations

from backend.application.ports.llm import LLMProvider
from backend.infrastructure.llm.providers.anthropic_langchain import AnthropicLangChainProvider
from backend.infrastructure.llm.config.model_config import ModelConfig
from backend.infrastructure.llm.providers.google_langchain import GoogleLangChainProvider
from backend.infrastructure.llm.providers.open_weight_langchain import OpenWeightLangChainProvider
from backend.infrastructure.llm.providers.openai_langchain import OpenAILangChainProvider
from backend.infrastructure.llm.providers.kimi_langchain import KimiLangChainProvider
from backend.infrastructure.llm.providers.deepseek_langchain import DeepSeekLangChainProvider
from backend.infrastructure.llm.providers.glm_langchain import GLMLangChainProvider
from backend.infrastructure.llm.providers.rotation import RotationConfig


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
    """create_llm_provider(), resolving every provider API key from settings
    in one place.

    Every call site used to hand-list all 7 provider keys itself — 4 near-
    identical copies across deps.py/document_tools.py — so adding a new
    provider (already happened twice, for deepseek/glm) meant editing all 4
    in lockstep or silently missing one.

    ``model_config`` — when given (the resolved active entry from config.yml's
    ``models:`` registry, see ``backend.infrastructure.llm.config``) — supplies
    provider/model/base_url/failover from that entry instead of the app-wide
    ``settings.llm_*`` defaults, so the Settings-UI "active model" switch and
    each model's own key-rotation policy actually take effect. Explicit
    provider/model/base_url args still win over both (e.g. the knowledge-graph
    builder's separate GRAPH_LLM_PROVIDER/MODEL override).
    """
    from backend.api.settings import settings

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

    return create_llm_provider(
        provider=resolved_provider or settings.llm_provider,
        model=resolved_model or settings.llm_model,
        google_api_key=settings.google_api_keys(),
        anthropic_api_key=settings.anthropic_api_keys(),
        openai_api_key=settings.openai_api_keys(),
        open_weight_api_key=settings.open_weight_api_keys(),
        kimi_api_key=settings.kimi_api_keys(),
        deepseek_api_key=settings.deepseek_api_keys(),
        glm_api_key=settings.glm_api_keys(),
        base_url=resolved_base_url or settings.llm_api_base,
        max_tool_rounds=(
            max_tool_rounds if max_tool_rounds is not None else settings.staff_max_tool_rounds
        ),
        tool_timeout_seconds=(
            tool_timeout_seconds if tool_timeout_seconds is not None else settings.tool_timeout_seconds
        ),
        failover=resolved_failover,
    )