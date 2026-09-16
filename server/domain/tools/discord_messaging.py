from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from langchain.tools import tool

from server.domain.tools.base import BaseToolkit
from server.domain.tools._messaging_http import request_json

DISCORD_API_BASE = "https://discord.com/api/v10"


def _discord_request(
    method: str,
    path: str,
    bot_token: Optional[str] = None,
    data: Optional[Dict] = None,
    timeout: int = 30,
) -> Dict[str, Any]:
    url = f"{DISCORD_API_BASE}{path}"
    headers: Dict[str, str] = {}
    if bot_token:
        headers["Authorization"] = f"Bot {bot_token}"
    return request_json(method, url, service="Discord", json_body=data, headers=headers, timeout=timeout)


def _webhook_send(webhook_url: str, data: Dict, timeout: int = 30) -> Dict[str, Any]:
    return request_json("POST", webhook_url, service="Discord webhook", json_body=data, timeout=timeout)


class DiscordMessagingToolkit(BaseToolkit):
    """Discord Bot and Webhook toolkit for sending and reading messages."""

    name: str = "discord_messaging"

    def __init__(
        self,
        bot_token: Optional[str] = None,
        webhook_url: Optional[str] = None,
        default_channel_id: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.bot_token = bot_token
        self.webhook_url = webhook_url
        self.default_channel_id = default_channel_id

    @tool(parse_docstring=True)
    async def discord_send_message(
        self,
        content: str,
        channel_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a text message to a Discord channel using the bot token.

        Args:
            content: Message content to send.
            channel_id: Target Discord channel ID. Uses default_channel_id if not provided.
        """
        target = channel_id or self.default_channel_id
        if not target:
            raise ValueError("channel_id is required.")
        if not self.bot_token:
            raise ValueError("Discord bot token required. Configure bot_token.")
        data = {"content": content}
        return await asyncio.to_thread(
            _discord_request, "POST", f"/channels/{target}/messages", self.bot_token, data
        )

    @tool(parse_docstring=True)
    async def discord_send_webhook(
        self,
        content: str,
        username: Optional[str] = None,
        webhook_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a message to Discord via a webhook URL (no bot token needed).

        Args:
            content: Message text to send.
            username: Override display name for this webhook message.
            webhook_url: Webhook URL override. Uses the configured default if not provided.
        """
        target_url = webhook_url or self.webhook_url
        if not target_url:
            raise ValueError("Discord webhook URL required. Configure webhook_url.")
        data: Dict[str, Any] = {"content": content}
        if username:
            data["username"] = username
        return await asyncio.to_thread(_webhook_send, target_url, data)

    @tool(parse_docstring=True)
    async def discord_get_messages(
        self,
        channel_id: Optional[str] = None,
        limit: int = 10,
    ) -> Dict[str, Any]:
        """Retrieve recent messages from a Discord channel.

        Args:
            channel_id: Target channel ID. Uses default_channel_id if not provided.
            limit: Number of messages to retrieve (1-100).
        """
        target = channel_id or self.default_channel_id
        if not target:
            raise ValueError("channel_id is required.")
        if not self.bot_token:
            raise ValueError("Discord bot token required. Configure bot_token.")
        path = f"/channels/{target}/messages?limit={min(max(1, limit), 100)}"
        return await asyncio.to_thread(_discord_request, "GET", path, self.bot_token)

    @tool(parse_docstring=True)
    async def discord_send_embed(
        self,
        title: str,
        description: str,
        color: int = 5793266,
        channel_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a rich embed message to a Discord channel.

        Args:
            title: Embed title text.
            description: Embed body/description text.
            color: Embed accent color as integer (default Discord blurple: 5793266 = 0x5865F2).
            channel_id: Target channel ID. Uses default_channel_id if not provided.
        """
        target = channel_id or self.default_channel_id
        if not target:
            raise ValueError("channel_id is required.")
        if not self.bot_token:
            raise ValueError("Discord bot token required. Configure bot_token.")
        data = {"embeds": [{"title": title, "description": description, "color": color}]}
        return await asyncio.to_thread(
            _discord_request, "POST", f"/channels/{target}/messages", self.bot_token, data
        )

    @tool(parse_docstring=True)
    async def discord_get_guild_channels(
        self,
        guild_id: str,
    ) -> Dict[str, Any]:
        """List all channels in a Discord server (guild).

        Args:
            guild_id: Discord server (guild) ID.
        """
        if not self.bot_token:
            raise ValueError("Discord bot token required. Configure bot_token.")
        return await asyncio.to_thread(
            _discord_request, "GET", f"/guilds/{guild_id}/channels", self.bot_token
        )
