from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from backend.domain.thirty_part.base_hook import BaseHookProcessor, IncomingMessage, _http_post

TG_API = "https://api.telegram.org/bot{token}/{method}"


class TelegramHookProcessor(BaseHookProcessor):
    platform = "telegram"

    def extract_message(self, body: Dict[str, Any]) -> Optional[IncomingMessage]:
        msg = body.get("message") or body.get("edited_message")
        if not msg:
            return None
        text = msg.get("text", "").strip()
        if not text:
            return None
        chat_id = str(msg.get("chat", {}).get("id", ""))
        user_id = str(msg.get("from", {}).get("id", ""))
        return IncomingMessage(chat_id=chat_id, user_id=user_id, text=text, raw=body)

    async def send_response(self, config: Dict[str, Any], chat_id: str, text: str) -> None:
        token = config.get("bot_token", "")
        if not token:
            raise ValueError("Missing bot_token in Telegram hook config")
        url = TG_API.format(token=token, method="sendMessage")
        # Split long messages (Telegram limit: 4096 chars)
        for chunk in _split_text(text, 4000):
            await asyncio.to_thread(
                _http_post, url, {"chat_id": chat_id, "text": chunk, "parse_mode": "Markdown"}, {}
            )

    async def register_webhook(self, config: Dict[str, Any], webhook_url: str) -> Dict[str, Any]:
        """Register this bot's webhook URL with Telegram."""
        token = config.get("bot_token", "")
        if not token:
            raise ValueError("Missing bot_token")
        url = TG_API.format(token=token, method="setWebhook")
        return await asyncio.to_thread(_http_post, url, {"url": webhook_url}, {})

    async def delete_webhook(self, config: Dict[str, Any]) -> Dict[str, Any]:
        token = config.get("bot_token", "")
        url = TG_API.format(token=token, method="deleteWebhook")
        return await asyncio.to_thread(_http_post, url, {}, {})


def _split_text(text: str, limit: int) -> list[str]:
    if len(text) <= limit:
        return [text]
    chunks = []
    while text:
        chunks.append(text[:limit])
        text = text[limit:]
    return chunks
