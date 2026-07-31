from __future__ import annotations

from backend.infrastructure.llm.providers.base_langchain import LangChainLLMProvider
from backend.infrastructure.llm.providers.rotation import RotationConfig, build_rotating_model, normalize_api_keys


class GoogleLangChainProvider(LangChainLLMProvider):
    def __init__(
        self,
        *,
        model: str,
        api_key: str | list[str],
        max_tool_rounds: int = 6,
        tool_timeout_seconds: int | None = None,
        failover: RotationConfig | None = None,
    ):
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
        except Exception as e:  # pragma: no cover
            raise RuntimeError(
                "Missing dependency: langchain-google-genai. Install backend deps first."
            ) from e

        def build_one(key: str):
            return ChatGoogleGenerativeAI(model=model, google_api_key=key)

        llm = build_rotating_model(build_one, normalize_api_keys(api_key), label_prefix="google", config=failover)
        super().__init__(
            llm,
            provider_name="Google",
            max_tool_rounds=max_tool_rounds,
            tool_timeout_seconds=tool_timeout_seconds,
        )
