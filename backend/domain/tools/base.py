from __future__ import annotations

import inspect
import re
from typing import Any, List, Optional

from langchain.messages import ToolMessage
from langchain.tools import BaseTool
from langchain_core.tools.base import ArgsSchema
from langchain_core.tools.base import BaseToolkit as LangchainBaseToolkit
from langchain_core.tools.structured import StructuredTool
from pydantic import BaseModel, ConfigDict, create_model


def create_model_without_fields(
    model_class: type[BaseModel],
    exclude_fields: set[str],
) -> type[BaseModel]:
    fields: dict[str, tuple[Any, Any]] = {}
    for field_name, field_info in model_class.model_fields.items():
        if field_name not in exclude_fields:
            fields[field_name] = (field_info.annotation, field_info)
    return create_model(model_class.__name__, **fields)


class Tool(BaseTool):
    name: str = ""
    description: str = ""
    args_schema: ArgsSchema | None = None
    toolkit: "BaseToolkit" = None

    def __init__(self, tool: StructuredTool, **kwargs: Any):
        super().__init__(**kwargs)
        self.name = tool.name
        self.description = tool.description
        self.args_schema = create_model_without_fields(tool.args_schema, {"self"})
        self._tool = tool

    def _run(self, **kwargs: Any) -> Any:
        return self._tool.func(self.toolkit, **kwargs)

    async def _arun(self, **kwargs: Any) -> Any:
        return await self._tool.coroutine(self.toolkit, **kwargs)

    async def ainvoke(self, input: Any, config: Any = None, **kwargs: Any) -> ToolMessage:
        args = input.get("args", {}) if isinstance(input, dict) else {}
        tool_call_id = input.get("id", "") if isinstance(input, dict) else ""
        raw_result = await self._arun(**args)
        content = raw_result.model_dump_json() if hasattr(raw_result, "model_dump_json") else str(raw_result)
        return ToolMessage(tool_call_id=tool_call_id, name=self.name, content=content, artifact=raw_result)


class BaseToolkit(LangchainBaseToolkit):
    """Base class for toolkit groups in the domain layer."""

    name: str = ""
    tools: List[Tool] = []
    model_config = ConfigDict(ignored_types=(BaseTool,), extra="allow")

    def __init__(self, **kwargs: Any):
        super().__init__()
        self.tools = []
        tool_name_override = kwargs.get("tool_name_override")

        for _, tool in inspect.getmembers(self, lambda x: isinstance(x, BaseTool)):
            wrapped_tool = Tool(tool, toolkit=self)
            # Apply tool name sanitization and override if provided
            if tool_name_override:
                wrapped_tool.name = self._sanitize_tool_name(tool_name_override)
            self.tools.append(wrapped_tool)

    @staticmethod
    def _sanitize_tool_name(raw_name: str) -> str:
        """Sanitize tool names to be lowercase with underscores, no special chars."""
        normalized = raw_name.strip().lower().replace(" ", "_")
        normalized = re.sub(r"[^a-z0-9_\-]", "_", normalized)
        normalized = re.sub(r"_+", "_", normalized).strip("_")
        return (normalized or "tool")[0:64]

    def get_tools(self) -> List[Tool]:
        return self.tools

    def get_tool(self, tool_name: str) -> Optional[Tool]:
        for tool in self.tools:
            if tool.name == tool_name:
                return tool
        return None