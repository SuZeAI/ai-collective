from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from server.domain.third_party.base_hook import BaseHookProcessor, IncomingMessage, _header, _http_post
from server.domain.third_party.bot_framework_auth import verify_bot_framework_token


class TeamsHookProcessor(BaseHookProcessor):
    platform = "teams"

    def verify_request(
        self, headers: Dict[str, str], raw_body: bytes, config: Dict[str, Any]
    ) -> bool:
        app_id = (config.get("app_id") or "").strip()
        authorization = _header(headers, "Authorization")
        if not authorization:
            # No Bot Framework Authorization header present: this is a plain
            # Incoming Webhook config (outbound-only, no app_id registered),
            # so there is nothing to verify — accept as before.
            return not app_id
        return verify_bot_framework_token(authorization, expected_audience=app_id or None)

    def extract_message(self, body: Dict[str, Any]) -> Optional[IncomingMessage]:
        # Bot Framework Activity object
        activity_type = body.get("type")
        if activity_type != "message":
            return None
        text = body.get("text", "").strip()
        if not text:
            return None
        # conversation ID is used as chat_id for replying
        chat_id = body.get("conversation", {}).get("id", "")
        user_id = body.get("from", {}).get("id", "")
        service_url = body.get("serviceUrl", "")
        raw = {**body, "_service_url": service_url}
        return IncomingMessage(chat_id=chat_id, user_id=user_id, text=text, raw=raw)

    async def send_response(self, config: Dict[str, Any], chat_id: str, text: str) -> None:
        webhook_url = config.get("webhook_url", "")
        if webhook_url:
            # Simple Incoming Webhook (no reply to specific conversation)
            await asyncio.to_thread(_http_post, webhook_url, {"text": text}, {})
        else:
            # Bot Framework reply (requires service_url from original message)
            raise ValueError(
                "Teams hook requires webhook_url for outbound messages. "
                "Configure an Incoming Webhook URL in Teams."
            )
