from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from backend.domain.thirty_part.base_hook import BaseHookProcessor, IncomingMessage, _http_post

SLACK_API = "https://slack.com/api"


class SlackHookProcessor(BaseHookProcessor):
    platform = "slack"

    def extract_message(self, body: Dict[str, Any]) -> Optional[IncomingMessage]:
        # URL verification challenge
        if body.get("type") == "url_verification":
            return None  # handled separately in router

        event = body.get("event", {})
        if event.get("type") != "message":
            return None
        if event.get("bot_id") or event.get("subtype"):
            return None  # ignore bot messages and subtypes (edits, etc.)

        text = event.get("text", "").strip()
        if not text:
            return None

        channel = str(event.get("channel", ""))
        user_id = str(event.get("user", ""))
        return IncomingMessage(chat_id=channel, user_id=user_id, text=text, raw=body)

    def get_verification_response(
        self, query_params: Dict[str, str], config: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        return None  # Slack uses POST body challenge, handled in router

    async def send_response(self, config: Dict[str, Any], chat_id: str, text: str) -> None:
        bot_token = config.get("bot_token", "")
        if not bot_token:
            raise ValueError("Missing bot_token in Slack hook config")
        url = f"{SLACK_API}/chat.postMessage"
        headers = {"Authorization": f"Bearer {bot_token}"}
        for chunk in _split(text, 3000):
            await asyncio.to_thread(_http_post, url, {"channel": chat_id, "text": chunk}, headers)


def _split(text: str, limit: int) -> list[str]:
    if len(text) <= limit:
        return [text]
    return [text[i:i+limit] for i in range(0, len(text), limit)]
