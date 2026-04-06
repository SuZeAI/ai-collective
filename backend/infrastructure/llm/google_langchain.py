from __future__ import annotations

from backend.infrastructure.llm.base_langchain import LangChainLLMProvider


class GoogleLangChainProvider(LangChainLLMProvider):
    def __init__(self, *, model: str, api_key: str, max_tool_rounds: int = 6):
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
        except Exception as e:  # pragma: no cover
            raise RuntimeError(
                "Missing dependency: langchain-google-genai. Install backend deps first."
            ) from e

        super().__init__(
            ChatGoogleGenerativeAI(model=model, google_api_key=api_key),
            provider_name="Google",
            max_tool_rounds=max_tool_rounds,
        )