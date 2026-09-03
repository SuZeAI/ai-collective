from __future__ import annotations

import asyncio
import hmac
from typing import Any, Dict, Optional

from server.domain.third_party.base_hook import (
    BaseHookProcessor,
    IncomingMessage,
    _header,
    _http_post,
    hmac_sha256_hex,
)

WA_API = "https://graph.facebook.com/v19.0"


def verify_meta_signature(headers: Dict[str, str], raw_body: bytes, app_secret: str) -> bool:
    """Verify Meta (WhatsApp/Messenger/Instagram) X-Hub-Signature-256.

    If ``app_secret`` is not configured, verification is skipped (returns True)
    to preserve setups that have not provided one.
    """
    app_secret = (app_secret or "").strip()
    if not app_secret:
        return True
    signature = _header(headers, "X-Hub-Signature-256")
    if not signature:
        return False
    expected = "sha256=" + hmac_sha256_hex(app_secret, raw_body)
    return hmac.compare_digest(expected, signature)


class WhatsAppHookProcessor(BaseHookProcessor):
    platform = "whatsapp_business"

    def verify_request(
        self, headers: Dict[str, str], raw_body: bytes, config: Dict[str, Any]
    ) -> bool:
        return verify_meta_signature(headers, raw_body, config.get("app_secret", ""))

    def extract_message(self, body: Dict[str, Any]) -> Optional[IncomingMessage]:
        if body.get("object") != "whatsapp_business_account":
            return None
        for entry in body.get("entry", []):
            for change in entry.get("changes", []):
                val = change.get("value", {})
                for msg in val.get("messages", []):
                    if msg.get("type") != "text":
                        continue
                    text = msg.get("text", {}).get("body", "").strip()
                    if not text:
                        continue
                    from_number = str(msg.get("from", ""))
                    return IncomingMessage(
                        chat_id=from_number,
                        user_id=from_number,
                        text=text,
                        raw=body,
                    )
        return None

    def get_verification_response(
        self, query_params: Dict[str, str], config: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        mode = query_params.get("hub.mode")
        token = query_params.get("hub.verify_token")
        challenge = query_params.get("hub.challenge")
        verify_token = config.get("verify_token", "")
        if mode == "subscribe" and challenge and verify_token and hmac.compare_digest(str(token or ""), str(verify_token)):
            return {"content": challenge}
        return None

    async def send_response(self, config: Dict[str, Any], chat_id: str, text: str) -> None:
        access_token = config.get("access_token", "")
        phone_number_id = config.get("phone_number_id", "")
        if not access_token or not phone_number_id:
            raise ValueError("WhatsApp hook requires access_token and phone_number_id")
        # Send token in the Authorization header, not the query string (avoids
        # leaking the credential into proxy/access logs and error bodies).
        url = f"{WA_API}/{phone_number_id}/messages"
        headers = {"Authorization": f"Bearer {access_token}"}
        data = {
            "messaging_product": "whatsapp",
            "to": chat_id,
            "type": "text",
            "text": {"body": text[:4096]},
        }
        await asyncio.to_thread(_http_post, url, data, headers)
