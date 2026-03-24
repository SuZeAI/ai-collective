from typing import Optional, Dict, Type, Any
from enum import Enum

from backend.domain.tools.base import BaseToolkit
from backend.domain.tools.bash import BashToolkit
from backend.domain.tools.browser import BrowserToolkit
from backend.domain.tools.websearch import WebSearchToolkit


class ToolType(str, Enum):
    BASH = "bash"
    BROWSER = "browser"
    WEBSEARCH = "websearch"


TOOL_CLASS_REGISTRY: Dict[str, Type[BaseToolkit]] = {
    ToolType.BASH.value: BashToolkit,
    ToolType.BROWSER.value: BrowserToolkit,
    ToolType.WEBSEARCH.value: WebSearchToolkit,
}


class ToolRegistry:

    @staticmethod
    def get_tool_class(tool_name: str) -> Optional[Type[BaseToolkit]]:
        return TOOL_CLASS_REGISTRY.get(tool_name)

    @staticmethod
    def get_available_tools() -> list[str]:
        return list(TOOL_CLASS_REGISTRY.keys())

    @staticmethod
    def create_tool(
        tool_name: str,
        **kwargs: Any
    ) -> Optional[BaseToolkit]:
        tool_class = ToolRegistry.get_tool_class(tool_name)
        if tool_class is None:
            return None

        if tool_name == ToolType.BROWSER.value:
            browser = kwargs.get("driver")
            if browser is None:
                cdp_url = kwargs.get("cdp_url")
                if not cdp_url:
                    raise ValueError(
                        "Failed to instantiate browser. Required kwargs: "
                        "provide either 'browser' or 'cdp_url'."
                    )

                from backend.infrastructure.browser.browser_use_browser import BrowserUseBrowser

                kwargs = {**kwargs, "browser": BrowserUseBrowser(cdp_url=cdp_url)}

            # Keep only constructor-relevant args for BrowserToolkit.
            kwargs = {"browser": kwargs["browser"]}

        try:
            return tool_class(**kwargs)
        except TypeError as e:
            raise ValueError(
                f"Failed to instantiate {tool_name}. "
                f"Required kwargs: {e}"
            )

    @staticmethod
    def register_tool(tool_name: str, tool_class: Type[BaseToolkit]) -> None:
        if not issubclass(tool_class, BaseToolkit):
            raise TypeError(f"{tool_class} must inherit from BaseToolkit")
        TOOL_CLASS_REGISTRY[tool_name] = tool_class
