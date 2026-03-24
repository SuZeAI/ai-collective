from __future__ import annotations

import json
import os
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from backend.log import get_logger
from backend.application.ports.llm import LLMProvider


class GeminiLangChainProvider(LLMProvider):
    """Gemini provider via LangChain.

    Notes:
    - Uses `langchain-google-genai` integration.
    - Reads API key from `GEMINI_API_KEY` (or `GOOGLE_API_KEY`).
    """

    def __init__(self, *, model: str, max_tool_rounds: int = 3):
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
        self._max_tool_rounds = max(1, max_tool_rounds)

    async def chat(
        self,
        *,
        system: str,
        user: str,
        tools: list[Any] | None = None,
    ) -> str:
        resolved_tools = tools or []
        chat_model = self._llm.bind_tools(resolved_tools) if resolved_tools else self._llm
        tool_by_name = {tool.name: tool for tool in resolved_tools}

        messages: list[Any] = [SystemMessage(content=system), HumanMessage(content=user)]
        result: AIMessage | Any

        for _ in range(self._max_tool_rounds):
            result = await chat_model.ainvoke(messages)
            messages.append(result)

            tool_calls = getattr(result, "tool_calls", None) or []
            if not tool_calls:
                return self._extract_text_content(result)

            tool_messages: list[ToolMessage] = []
            for tool_call in tool_calls:
                tool_name = tool_call.get("name", "")
                tool = tool_by_name.get(tool_name)
                if not tool:
                    tool_messages.append(
                        ToolMessage(
                            tool_call_id=tool_call.get("id", ""),
                            name=tool_name,
                            content=f"Tool '{tool_name}' is not available for this agent.",
                        )
                    )
                    continue

                try:
                    tool_result = await tool.ainvoke(tool_call)
                except Exception as e:
                    get_logger().exception("Tool '%s' execution failed", tool_name)
                    tool_result = ToolMessage(
                        tool_call_id=tool_call.get("id", ""),
                        name=tool_name,
                        content=f"Tool '{tool_name}' failed: {e}",
                    )

                tool_messages.append(tool_result)

            if not tool_messages:
                return self._extract_text_content(result)

            messages.extend(tool_messages)

        return self._extract_text_content(result)

    def _extract_text_content(self, result: Any) -> str:
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
