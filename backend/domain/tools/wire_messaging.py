from __future__ import annotations

import asyncio
import json
import os
from typing import Any, Dict, Optional
from urllib import error, request

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit
from backend.domain.tools._messaging_http import request_json

WIRE_API_BASE = "https://prod-nginz-https.wire.com"


def _wire_request(
    method: str,
    path: str,
    token: str,
    data: Optional[Dict] = None,
    timeout: int = 30,
) -> Dict[str, Any]:
    url = f"{WIRE_API_BASE}{path}"
    result = request_json(
        method, url, service="Wire",
        json_body=data, headers={"Authorization": f"Bearer {token}"}, timeout=timeout,
    )
    # Preserve prior behaviour: an empty response body means success.
    return result or {"ok": True}


class WireMessagingToolkit(BaseToolkit):
    """Wire Bot API toolkit for end-to-end encrypted messaging."""

    name: str = "wire_messaging"

    def __init__(
        self,
        bearer_token: Optional[str] = None,
        bot_conversation_id: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.bearer_token = bearer_token or os.getenv("WIRE_BEARER_TOKEN", "")
        self.bot_conversation_id = bot_conversation_id or os.getenv(
            "WIRE_CONVERSATION_ID", ""
        )

    def _token(self) -> str:
        if not self.bearer_token:
            raise ValueError(
                "Wire bearer token required. Set WIRE_BEARER_TOKEN or configure bearer_token."
            )
        return self.bearer_token

    @tool(parse_docstring=True)
    async def wire_send_message(
        self,
        text: str,
        conversation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a text message to a Wire conversation.

        Args:
            text: Message text to send.
            conversation_id: Wire conversation ID. Uses configured default if not provided.
        """
        target = conversation_id or self.bot_conversation_id
        if not target:
            raise ValueError(
                "Wire conversation ID required. Set WIRE_CONVERSATION_ID."
            )
        data = {"type": "conversation.otr-message-add", "data": {"text": text}}
        return await asyncio.to_thread(
            _wire_request,
            "POST",
            f"/conversations/{target}/messages",
            self._token(),
            data,
        )

    @tool(parse_docstring=True)
    async def wire_get_conversations(self) -> Dict[str, Any]:
        """List all Wire conversations the bot is a member of."""
        return await asyncio.to_thread(
            _wire_request, "GET", "/conversations", self._token()
        )

    @tool(parse_docstring=True)
    async def wire_get_conversation_messages(
        self,
        conversation_id: Optional[str] = None,
        size: int = 20,
    ) -> Dict[str, Any]:
        """Get recent messages from a Wire conversation.

        Args:
            conversation_id: Wire conversation ID. Uses configured default if not provided.
            size: Number of messages to retrieve (1-100).
        """
        target = conversation_id or self.bot_conversation_id
        if not target:
            raise ValueError("Wire conversation ID required. Set WIRE_CONVERSATION_ID.")
        path = f"/conversations/{target}/events?size={min(max(1, size), 100)}"
        return await asyncio.to_thread(_wire_request, "GET", path, self._token())
