from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, Optional
from urllib import error, request

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit
from backend.domain.tools._messaging_http import request_json

TELEGRAM_API_BASE = "https://api.telegram.org/bot{token}/{method}"


def _tg_request(
    token: str,
    method: str,
    data: Optional[Dict] = None,
    timeout: int = 30,
) -> Dict[str, Any]:
    url = TELEGRAM_API_BASE.format(token=token, method=method)
    http_method = "POST" if data is not None else "GET"
    return request_json(http_method, url, service="Telegram", json_body=data, timeout=timeout)


class TelegramMessagingToolkit(BaseToolkit):
    """Telegram Bot API toolkit for sending and reading messages."""

    name: str = "telegram_messaging"

    def __init__(
        self,
        bot_token: Optional[str] = None,
        default_chat_id: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.bot_token = bot_token
        self.default_chat_id = default_chat_id

    def _token(self) -> str:
        if not self.bot_token:
            raise ValueError("Telegram bot token required. Configure bot_token.")
        return self.bot_token

    @tool(parse_docstring=True)
    async def telegram_send_message(
        self,
        text: str,
        chat_id: Optional[str] = None,
        parse_mode: str = "Markdown",
    ) -> Dict[str, Any]:
        """Send a text message to a Telegram chat.

        Args:
            text: Message text to send.
            chat_id: Target chat ID or @username. Uses default_chat_id if not provided.
            parse_mode: Text formatting mode — Markdown or HTML.
        """
        target = chat_id or self.default_chat_id
        if not target:
            raise ValueError("chat_id is required.")
        data = {"chat_id": target, "text": text, "parse_mode": parse_mode}
        return await asyncio.to_thread(_tg_request, self._token(), "sendMessage", data)

    @tool(parse_docstring=True)
    async def telegram_get_updates(
        self,
        limit: int = 10,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Retrieve recent updates (incoming messages) from the Telegram bot.

        Args:
            limit: Maximum number of updates to retrieve (1-100).
            offset: Update ID offset for pagination to mark previous updates as read.
        """
        data = {"limit": min(max(1, limit), 100), "offset": offset}
        return await asyncio.to_thread(_tg_request, self._token(), "getUpdates", data)

    @tool(parse_docstring=True)
    async def telegram_send_photo(
        self,
        photo_url: str,
        caption: Optional[str] = None,
        chat_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a photo to a Telegram chat by URL.

        Args:
            photo_url: Public HTTPS URL of the photo to send.
            caption: Optional caption text (supports Markdown).
            chat_id: Target chat ID. Uses default_chat_id if not provided.
        """
        target = chat_id or self.default_chat_id
        if not target:
            raise ValueError("chat_id is required.")
        data: Dict[str, Any] = {"chat_id": target, "photo": photo_url}
        if caption:
            data["caption"] = caption
        return await asyncio.to_thread(_tg_request, self._token(), "sendPhoto", data)

    @tool(parse_docstring=True)
    async def telegram_get_chat_info(
        self,
        chat_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get information about a Telegram chat or channel.

        Args:
            chat_id: Chat ID or @username. Uses default_chat_id if not provided.
        """
        target = chat_id or self.default_chat_id
        if not target:
            raise ValueError("chat_id is required.")
        data = {"chat_id": target}
        return await asyncio.to_thread(_tg_request, self._token(), "getChat", data)
