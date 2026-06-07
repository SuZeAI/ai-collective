from __future__ import annotations

import asyncio
import json
import os
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from backend.application.ports.llm import LLMProvider
from backend.infrastructure.llm.usage_tracker import UsageTrackingCallback
from backend.log import get_logger


def _default_tool_timeout() -> int:
    try:
        return max(0, int(os.getenv("TOOL_TIMEOUT_SECONDS", "0")))
    except ValueError:
        return 0


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
        user: str,
        tools: list[Any] | None = None,
        parallel_tools: bool = False,
        max_tool_rounds: int | None = None,
    ) -> str:
        rounds = max(1, max_tool_rounds) if max_tool_rounds else self._max_tool_rounds
        resolved_tools = tools or []
        get_logger().info(
            f"Resolving tools for {self._provider_name}: {[tool.name for tool in resolved_tools]}"
        )
        chat_model = self._llm.bind_tools(resolved_tools) if resolved_tools else self._llm
        tool_by_name = {tool.name: tool for tool in resolved_tools}
        get_logger().info(f"Starting chat with system prompt: \n{system}\n")
        get_logger().info(f"User input: \n{user}")

        messages: list[Any] = [SystemMessage(content=system), HumanMessage(content=user)]
        result: AIMessage | Any

        for round_index in range(rounds):
            is_last_round = round_index == rounds - 1

            invoke_model = self._llm if is_last_round else chat_model
            if is_last_round:
                messages.append(
                    SystemMessage(
                        content=(
                            "Final round: synthesize and consolidate all collected information into a "
                            "single final answer as plain text only. Do not call any tools."
                        )
                    )
                )
                get_logger().info("Invoking LLM for final response without tool calls.")
            else:
                get_logger().info(f"Invoking LLM for round {round_index + 1} with tool calls allowed.")

            result = await invoke_model.ainvoke(messages)
            get_logger().info(f"LLM response: {result}")
            messages.append(result)

            tool_calls = getattr(result, "tool_calls", None) or []
            if not tool_calls:
                return self._extract_text_content(result)

            if is_last_round:
                get_logger().warning(
                    "Final round returned tool calls; ignoring and returning text content instead."
                )
                return self._extract_text_content(result)

            if parallel_tools:
                get_logger().info(f"Executing {len(tool_calls)} tool call(s) in parallel.")
                tool_messages = await asyncio.gather(
                    *(self._execute_tool_call(tc, tool_by_name) for tc in tool_calls)
                )
            else:
                tool_messages = [
                    await self._execute_tool_call(tc, tool_by_name) for tc in tool_calls
                ]

            if not tool_messages:
                return self._extract_text_content(result)

            messages.extend(tool_messages)

        return self._extract_text_content(result)

    async def _execute_tool_call(self, tool_call: dict, tool_by_name: dict) -> ToolMessage:
        tool_name = tool_call.get("name", "")
        tool = tool_by_name.get(tool_name)
        if not tool:
            return ToolMessage(
                tool_call_id=tool_call.get("id", ""),
                name=tool_name,
                content=f"Tool '{tool_name}' is not available for this agent.",
            )
        try:
            if self._tool_timeout and self._tool_timeout > 0:
                tool_result = await asyncio.wait_for(
                    tool.ainvoke(tool_call), timeout=self._tool_timeout
                )
            else:
                tool_result = await tool.ainvoke(tool_call)
            get_logger().info(f"Tool '{tool_name}' executed successfully with result: {tool_result}")
            return tool_result
        except asyncio.TimeoutError:
            get_logger().warning("Tool '%s' timed out after %ss", tool_name, self._tool_timeout)
            return ToolMessage(
                tool_call_id=tool_call.get("id", ""),
                name=tool_name,
                content=f"Tool '{tool_name}' timed out after {self._tool_timeout}s.",
            )
        except Exception as e:
            get_logger().exception("Tool '%s' execution failed", tool_name)
            return ToolMessage(
                tool_call_id=tool_call.get("id", ""),
                name=tool_name,
                content=f"Tool '{tool_name}' failed: {e}",
            )

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