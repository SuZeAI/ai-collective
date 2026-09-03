from __future__ import annotations

import asyncio
import hmac
from typing import Any, Dict, Optional

from server.domain.third_party.base_hook import BaseHookProcessor, IncomingMessage, _header, _http_post

WIRE_API = "https://prod-nginz-https.wire.com"


class WireHookProcessor(BaseHookProcessor):
    platform = "wire_messaging"

    def verify_request(
        self, headers: Dict[str, str], raw_body: bytes, config: Dict[str, Any]
    ) -> bool:
        # Wire's bot integration has no standardized inbound signature scheme
        # in this codebase; fall back to a pre-shared secret header (set the
        # same value in both the connection config and whatever sits in front
        # of this endpoint, e.g. a reverse-proxy rule for the Wire callback).
        secret = (config.get("webhook_secret") or "").strip()
        if not secret:
            return True
        received = _header(headers, "X-Webhook-Secret")
        return hmac.compare_digest(secret, received)

    def extract_message(self, body: Dict[str, Any]) -> Optional[IncomingMessage]:
        event_type = body.get("type", "")
        if "message" not in event_type:
            return None
        data = body.get("data", {})
        text = data.get("text", "").strip()
        if not text:
            return None
        conversation = str(body.get("conversation", ""))
        user_id = str(body.get("from", ""))
        return IncomingMessage(chat_id=conversation, user_id=user_id, text=text, raw=body)

    async def send_response(self, config: Dict[str, Any], chat_id: str, text: str) -> None:
        bearer_token = config.get("bearer_token", "")
        if not bearer_token:
            raise ValueError("Missing bearer_token in Wire hook config")
        url = f"{WIRE_API}/conversations/{chat_id}/messages"
        headers = {"Authorization": f"Bearer {bearer_token}"}
        data = {"type": "conversation.otr-message-add", "data": {"text": text}}
        await asyncio.to_thread(_http_post, url, data, headers)
