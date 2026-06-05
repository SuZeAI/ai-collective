from __future__ import annotations

import asyncio
import json
import os
from typing import Any, Dict, List, Optional
from urllib import error, request

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit
from backend.domain.tools._messaging_http import request_json

SLACK_API_BASE = "https://slack.com/api"


def _slack_request(
    method_name: str,
    bot_token: str,
    data: Dict,
    timeout: int = 30,
) -> Dict[str, Any]:
    url = f"{SLACK_API_BASE}/{method_name}"
    return request_json(
        "POST", url, service="Slack",
        json_body=data,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": f"Bearer {bot_token}",
        },
        timeout=timeout,
    )


class SlackMessagingToolkit(BaseToolkit):
    """Slack Web API toolkit for messaging and channel management."""

    name: str = "slack_messaging"

    def __init__(
        self,
        bot_token: Optional[str] = None,
        default_channel: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.bot_token = bot_token or os.getenv("SLACK_BOT_TOKEN", "")
        self.default_channel = default_channel or os.getenv("SLACK_DEFAULT_CHANNEL", "")

    def _token(self) -> str:
        if not self.bot_token:
            raise ValueError(
                "Slack bot token required. Set SLACK_BOT_TOKEN or configure bot_token."
            )
        return self.bot_token

    @tool(parse_docstring=True)
    async def slack_send_message(
        self,
        text: str,
        channel: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a text message to a Slack channel.

        Args:
            text: Message text to send.
            channel: Channel name (e.g., #general) or channel ID. Uses default_channel if not provided.
        """
        target = channel or self.default_channel
        if not target:
            raise ValueError("channel is required.")
        data = {"channel": target, "text": text}
        return await asyncio.to_thread(_slack_request, "chat.postMessage", self._token(), data)

    @tool(parse_docstring=True)
    async def slack_get_channel_history(
        self,
        channel: Optional[str] = None,
        limit: int = 10,
    ) -> Dict[str, Any]:
        """Retrieve recent message history from a Slack channel.

        Args:
            channel: Channel name or ID. Uses default_channel if not provided.
            limit: Number of messages to retrieve (1-200).
        """
        target = channel or self.default_channel
        if not target:
            raise ValueError("channel is required.")
        data = {"channel": target, "limit": min(max(1, limit), 200)}
        return await asyncio.to_thread(_slack_request, "conversations.history", self._token(), data)

    @tool(parse_docstring=True)
    async def slack_list_channels(self) -> Dict[str, Any]:
        """List all public channels in the Slack workspace."""
        data: Dict[str, Any] = {"types": "public_channel", "limit": 100}
        return await asyncio.to_thread(_slack_request, "conversations.list", self._token(), data)

    @tool(parse_docstring=True)
    async def slack_send_blocks(
        self,
        blocks: List[Dict],
        channel: Optional[str] = None,
        text: str = "",
    ) -> Dict[str, Any]:
        """Send a message with Block Kit blocks to a Slack channel for rich formatting.

        Args:
            blocks: List of Slack Block Kit block objects (see api.slack.com/block-kit).
            channel: Channel name or ID. Uses default_channel if not provided.
            text: Fallback plain-text for notifications and screen readers.
        """
        target = channel or self.default_channel
        if not target:
            raise ValueError("channel is required.")
        data: Dict[str, Any] = {"channel": target, "text": text, "blocks": blocks}
        return await asyncio.to_thread(_slack_request, "chat.postMessage", self._token(), data)

    @tool(parse_docstring=True)
    async def slack_reply_in_thread(
        self,
        text: str,
        thread_ts: str,
        channel: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Reply to a message in a Slack thread.

        Args:
            text: Reply message text.
            thread_ts: Timestamp of the parent message to reply to (from message ts field).
            channel: Channel containing the thread. Uses default_channel if not provided.
        """
        target = channel or self.default_channel
        if not target:
            raise ValueError("channel is required.")
        data = {"channel": target, "text": text, "thread_ts": thread_ts}
        return await asyncio.to_thread(_slack_request, "chat.postMessage", self._token(), data)
