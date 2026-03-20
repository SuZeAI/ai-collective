from __future__ import annotations

import json
import os
from typing import Any
from backend.log import get_logger
from backend.application.ports.llm import LLMProvider


class GeminiLangChainProvider(LLMProvider):
    """Gemini provider via LangChain.

    Notes:
    - Uses `langchain-google-genai` integration.
    - Reads API key from `GEMINI_API_KEY` (or `GOOGLE_API_KEY`).
    """

    def __init__(self, *, model: str):
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
        except Exception as e:  # pragma: no cover
            raise RuntimeError(
                "Missing dependency: langchain-google-genai. Install backend deps first."
            ) from e

        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if api_key and not os.getenv("GOOGLE_API_KEY"):
            os.environ["GOOGLE_API_KEY"] = api_key

        self._llm = ChatGoogleGenerativeAI(model=model)

    async def chat(self, *, system: str, user: str) -> str:
        from langchain_core.messages import HumanMessage, SystemMessage

        result = await self._llm.ainvoke([SystemMessage(content=system), HumanMessage(content=user)])
        content = getattr(result, "content", result)
        get_logger().debug(f"Raw LLM response content: {content}")
        # Gemini can return structured content blocks; keep only user-facing text.
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            text_parts: list[str] = []
            for block in content:
                if isinstance(block, str):
                    text_parts.append(block)
                    continue
                if isinstance(block, dict):
                    text = block.get("text")
                    if isinstance(text, str) and text.strip():
                        text_parts.append(text)
            if text_parts:
                return "\n".join(text_parts).strip()

        return str(content)

    async def generate_json(self, *, system: str, user: str) -> dict:
        text = await self.chat(system=system, user=user)
        # Try to parse JSON directly; if model wrapped it in text, extract best-effort.
        try:
            return json.loads(text)
        except Exception:
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                return json.loads(text[start : end + 1])
            raise

    def get_chat_model(self) -> Any:
        return self._llm
