from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from backend.domain.third_party.base_hook import BaseHookProcessor, IncomingMessage, _header, _http_post, split_text
from backend.log import get_logger

DISCORD_API = "https://discord.com/api/v10"
logger = get_logger(__name__)


class DiscordHookProcessor(BaseHookProcessor):
    platform = "discord"

    def verify_request(
        self, headers: Dict[str, str], raw_body: bytes, config: Dict[str, Any]
    ) -> bool:
        public_key = (config.get("public_key") or "").strip()
        if not public_key:
            return True  # no key configured — cannot verify (legacy behaviour)
        signature = _header(headers, "X-Signature-Ed25519")
        timestamp = _header(headers, "X-Signature-Timestamp")
        if not signature or not timestamp:
            return False
        try:
            from cryptography.exceptions import InvalidSignature
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

            verify_key = Ed25519PublicKey.from_public_bytes(bytes.fromhex(public_key))
            verify_key.verify(bytes.fromhex(signature), timestamp.encode("utf-8") + raw_body)
            return True
        except InvalidSignature:
            return False
        except Exception as exc:
            # Missing crypto backend or malformed key: fail closed since a key
            # was explicitly configured.
            logger.warning("Discord Ed25519 verification error: %s", exc)
            return False

    def post_challenge_response(
        self, body: Dict[str, Any], config: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        # Discord Interactions PING must be answered with {"type": 1}.
        if body.get("type") == 1:
            return {"type": 1}
        return None

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
            for chunk in split_text(text, 2000):
                await asyncio.to_thread(_http_post, url, {"content": chunk}, headers)
        elif webhook_url:
            for chunk in split_text(text, 2000):
                await asyncio.to_thread(_http_post, webhook_url, {"content": chunk}, {})
        else:
            raise ValueError("Discord hook requires bot_token or webhook_url")
