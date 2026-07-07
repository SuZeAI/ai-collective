from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from backend.domain.third_party.base_hook import BaseHookProcessor, IncomingMessage, _http_post

VIBER_API = "https://chatapi.viber.com/pa"


class ViberHookProcessor(BaseHookProcessor):
    platform = "viber_messaging"

    def extract_message(self, body: Dict[str, Any]) -> Optional[IncomingMessage]:
        event = body.get("event")
        if event != "message":
            return None
        msg = body.get("message", {})
        if msg.get("type") != "text":
            return None
        text = msg.get("text", "").strip()
        if not text:
            return None
        sender = body.get("sender", {})
        user_id = str(sender.get("id", ""))
        return IncomingMessage(chat_id=user_id, user_id=user_id, text=text, raw=body)

    async def send_response(self, config: Dict[str, Any], chat_id: str, text: str) -> None:
        auth_token = config.get("auth_token", "")
        if not auth_token:
            raise ValueError("Missing auth_token in Viber hook config")
        sender_name = config.get("sender_name", "AI Assistant")
        url = f"{VIBER_API}/send_message"
        headers = {"X-Viber-Auth-Token": auth_token}
        data = {
            "receiver": chat_id,
            "type": "text",
            "sender": {"name": sender_name},
            "text": text[:7000],
        }
        await asyncio.to_thread(_http_post, url, data, headers)
