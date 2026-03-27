from __future__ import annotations

from typing import Any, Optional, Protocol

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit


class BrowserPort(Protocol):
    async def view_page(self) -> Any: ...

    async def navigate(self, url: str) -> Any: ...

    async def restart(self, url: str) -> Any: ...

    async def click(
        self,
        index: Optional[int] = None,
        coordinate_x: Optional[float] = None,
        coordinate_y: Optional[float] = None,
    ) -> Any: ...

    async def input(
        self,
        text: str,
        press_enter: bool,
        index: Optional[int] = None,
        coordinate_x: Optional[float] = None,
        coordinate_y: Optional[float] = None,
    ) -> Any: ...

    async def move_mouse(self, coordinate_x: float, coordinate_y: float) -> Any: ...

    async def press_key(self, key: str) -> Any: ...

    async def select_option(self, index: int, option: int) -> Any: ...

    async def scroll_up(self, to_top: Optional[bool] = None) -> Any: ...

    async def scroll_down(self, to_bottom: Optional[bool] = None) -> Any: ...

    async def console_exec(self, javascript: str) -> Any: ...

    async def console_view(self, max_lines: Optional[int] = None) -> Any: ...


class BrowserToolkit(BaseToolkit):
    """Browser tool class, providing browser interaction functions."""

    name: str = "browser"

    def __init__(self, browser: BrowserPort, **kwargs):
        super().__init__(**kwargs)
        self.browser = browser

    @tool(parse_docstring=True)
    async def browser_view(self) -> Any:
        """View content of the current browser page."""
        return await self.browser.view_page()

    @tool(parse_docstring=True)
    async def browser_navigate(self, url: str) -> Any:
        """Navigate browser to specified URL.

        Args:
            url: Complete URL to visit, including protocol.
        """
        return await self.browser.navigate(url)

    @tool(parse_docstring=True)
    async def browser_restart(self, url: str) -> Any:
        """Restart browser and navigate to specified URL.

        Args:
            url: Complete URL to visit after restart.
        """
        return await self.browser.restart(url)

    @tool(parse_docstring=True)
    async def browser_click(
        self,
        index: Optional[int] = None,
        coordinate_x: Optional[float] = None,
        coordinate_y: Optional[float] = None,
    ) -> Any:
        """Click on an element in the current browser page.

        Args:
            index: Optional index of the target element.
            coordinate_x: Optional X coordinate for click position.
            coordinate_y: Optional Y coordinate for click position.
        """
        return await self.browser.click(index, coordinate_x, coordinate_y)

    @tool(parse_docstring=True)
    async def browser_input(
        self,
        text: str,
        press_enter: bool,
        index: Optional[int] = None,
        coordinate_x: Optional[float] = None,
        coordinate_y: Optional[float] = None,
    ) -> Any:
        """Overwrite text in editable elements on the current browser page.

        Args:
            text: Text content to input.
            press_enter: Whether to press Enter after input.
            index: Optional index of the target input element.
            coordinate_x: Optional X coordinate of the target element.
            coordinate_y: Optional Y coordinate of the target element.
        """
        return await self.browser.input(text, press_enter, index, coordinate_x, coordinate_y)

    @tool(parse_docstring=True)
    async def browser_move_mouse(self, coordinate_x: float, coordinate_y: float) -> Any:
        """Move cursor to specified position on the current browser page.

        Args:
            coordinate_x: X coordinate of target cursor position.
            coordinate_y: Y coordinate of target cursor position.
        """
        return await self.browser.move_mouse(coordinate_x, coordinate_y)

    @tool(parse_docstring=True)
    async def browser_press_key(self, key: str) -> Any:
        """Simulate key press in the current browser page.

        Args:
            key: Key name (example: Enter, Tab, Control+Enter).
        """
        return await self.browser.press_key(key)

    @tool(parse_docstring=True)
    async def browser_select_option(self, index: int, option: int) -> Any:
        """Select option from dropdown list in the current browser page.

        Args:
            index: Index of the dropdown element.
            option: Option number to select, starting from 0.
        """
        return await self.browser.select_option(index, option)

    @tool(parse_docstring=True)
    async def browser_scroll_up(self, to_top: Optional[bool] = None) -> Any:
        """Scroll up in the current browser page.

        Args:
            to_top: If true, scroll directly to the page top.
        """
        return await self.browser.scroll_up(to_top)

    @tool(parse_docstring=True)
    async def browser_scroll_down(self, to_bottom: Optional[bool] = None) -> Any:
        """Scroll down in the current browser page.

        Args:
            to_bottom: If true, scroll directly to the page bottom.
        """
        return await self.browser.scroll_down(to_bottom)

    @tool(parse_docstring=True)
    async def browser_console_exec(self, javascript: str) -> Any:
        """Execute JavaScript code in browser console.

        Args:
            javascript: JavaScript code to execute.
        """
        return await self.browser.console_exec(javascript)

    @tool(parse_docstring=True)
    async def browser_console_view(self, max_lines: Optional[int] = None) -> Any:
        """View browser console output.

        Args:
            max_lines: Optional maximum number of log lines.
        """
        return await self.browser.console_view(max_lines)