from __future__ import annotations

import json
from typing import Any

from backend.application.ports.llm import LLMProvider
from backend.infrastructure.llm.agent_builder import build_chat_agent
from backend.infrastructure.llm.middleware import _default_tool_timeout
from backend.infrastructure.llm.usage_tracker import UsageTrackingCallback
from backend.log import get_logger


class LangChainLLMProvider(LLMProvider):
    def __init__(
        self,
        llm: Any,
        *,
        provider_name: str,
        max_tool_rounds: int = 6,
        tool_timeout_seconds: int | None = None,
    ):
        self._llm = llm
        self._provider_name = provider_name
        self._max_tool_rounds = max(1, max_tool_rounds)
        # Attach a usage-tracking callback at the model level so every
        # invocation — via chat(), bind_tools() or get_chat_model() — records
        # its token usage for the admin monitoring page.
        try:
            model_name = next(
                (
                    str(getattr(llm, attr))
                    for attr in ("model_name", "model", "model_id")
                    if getattr(llm, attr, None)
                ),
                "",
            )
            callbacks = list(getattr(llm, "callbacks", None) or [])
            callbacks.append(UsageTrackingCallback(provider=provider_name.lower(), model=model_name))
            llm.callbacks = callbacks
        except Exception:
            get_logger().warning("Could not attach usage-tracking callback", exc_info=True)
        # 0 / None disables the per-tool timeout.
        self._tool_timeout = (
            tool_timeout_seconds if tool_timeout_seconds is not None else _default_tool_timeout()
        )

    async def chat(
        self,
        *,
        system: str,
        user: str = "",
        messages: list[dict[str, Any]] | None = None,
        tools: list[Any] | None = None,
        parallel_tools: bool = False,
        max_tool_rounds: int | None = None,
    ) -> str:
        rounds = max(1, max_tool_rounds) if max_tool_rounds else self._max_tool_rounds
        resolved_tools = tools or []
        get_logger().info(
            f"Resolving tools for {self._provider_name}: {[tool.name for tool in resolved_tools]}"
        )
        get_logger().info(f"Starting chat with system prompt: \n{system}\n")
        input_messages = messages if messages is not None else [{"role": "user", "content": user}]
        get_logger().info(
            f"Input messages:\n{json.dumps(input_messages, indent=3, ensure_ascii=False)}"
        )

        # Delegate the ReAct loop to LangChain's create_staff. The round bound,
        # per-tool timeout and tool-retry/model-fallback behaviour live in the
        # middleware stack (see middleware.build_default_middleware). The
        # ``parallel_tools`` flag is accepted for interface compatibility;
        # create_staff already executes a turn's tool calls concurrently.
        staff = build_chat_agent(
            self._llm,
            tools=resolved_tools,
            system_prompt=system,
            max_tool_rounds=rounds,
            tool_timeout=self._tool_timeout,
        )

        state = {"messages": input_messages}
        result = await staff.ainvoke(state)
        result_messages = result.get("messages") if isinstance(result, dict) else None
        if not result_messages:
            get_logger().warning("Staff returned no messages; returning empty string.")
            return ""
        get_logger().info(f"Staff final message: {result_messages[-1]}")
        return self._extract_text_content(result_messages[-1])

    def _extract_text_content(self, result: Any) -> str:
        content = getattr(result, "content", result)
        get_logger().debug(f"Raw LLM response content: {content}")
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