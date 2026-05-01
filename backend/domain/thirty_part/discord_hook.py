from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from backend.domain.thirty_part.base_hook import BaseHookProcessor, IncomingMessage, _http_post

DISCORD_API = "https://discord.com/api/v10"


class DiscordHookProcessor(BaseHookProcessor):
    platform = "discord"

    def extract_message(self, body: Dict[str, Any]) -> Optional[IncomingMessage]:
        # Discord Interactions: type 1 = PING, type 2 = APPLICATION_COMMAND, type 3 = MESSAGE_COMPONENT
        # For gateway events via webhook: body has 't' (event type) and 'd' (data)
        event_type = body.get("t")
        if event_type == "MESSAGE_CREATE":
            d = body.get("d", {})
            if d.get("author", {}).get("bot"):
                return None  # ignore bot messages
            text = d.get("content", "").strip()
            if not text:
                return None
            channel_id = str(d.get("channel_id", ""))
            user_id = str(d.get("author", {}).get("id", ""))
            return IncomingMessage(chat_id=channel_id, user_id=user_id, text=text, raw=body)

        # Discord slash command interactions
        if body.get("type") == 2:
            data = body.get("data", {})
            text = " ".join(
                opt.get("value", "") for opt in data.get("options", []) if opt.get("type") == 3
            ) or data.get("name", "")
            channel_id = str(body.get("channel_id", ""))
            user_id = str(body.get("member", {}).get("user", {}).get("id", ""))
            return IncomingMessage(chat_id=channel_id, user_id=user_id, text=text, raw=body)

        return None

    async def send_response(self, config: Dict[str, Any], chat_id: str, text: str) -> None:
        bot_token = config.get("bot_token", "")
        webhook_url = config.get("webhook_url", "")

        if bot_token:
            url = f"{DISCORD_API}/channels/{chat_id}/messages"
            headers = {"Authorization": f"Bot {bot_token}"}
            for chunk in _split(text, 2000):
                await asyncio.to_thread(_http_post, url, {"content": chunk}, headers)
        elif webhook_url:
            for chunk in _split(text, 2000):
                await asyncio.to_thread(_http_post, webhook_url, {"content": chunk}, {})
        else:
            raise ValueError("Discord hook requires bot_token or webhook_url")


def _split(text: str, limit: int) -> list[str]:
    if len(text) <= limit:
        return [text]
    return [text[i:i+limit] for i in range(0, len(text), limit)]
