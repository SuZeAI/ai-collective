from __future__ import annotations

import asyncio
import hmac
import time
from typing import Any, Dict, Optional

from backend.domain.third_party.base_hook import (
    BaseHookProcessor,
    IncomingMessage,
    _header,
    _http_post,
    hmac_sha256_hex,
    split_text,
)

SLACK_API = "https://slack.com/api"


class SlackHookProcessor(BaseHookProcessor):
    platform = "slack"

    def verify_request(
        self, headers: Dict[str, str], raw_body: bytes, config: Dict[str, Any]
    ) -> bool:
        signing_secret = (config.get("signing_secret") or "").strip()
        if not signing_secret:
            # No secret configured — cannot verify; accept (legacy behaviour).
            return True
        timestamp = _header(headers, "X-Slack-Request-Timestamp")
        signature = _header(headers, "X-Slack-Signature")
        if not timestamp or not signature:
            return False
        # Reject replays older than 5 minutes.
        try:
            if abs(time.time() - int(timestamp)) > 60 * 5:
                return False
        except ValueError:
            return False
        basestring = f"v0:{timestamp}:".encode("utf-8") + raw_body
        expected = "v0=" + hmac_sha256_hex(signing_secret, basestring)
        return hmac.compare_digest(expected, signature)

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
        for chunk in split_text(text, 3000):
            await asyncio.to_thread(_http_post, url, {"channel": chat_id, "text": chunk}, headers)
