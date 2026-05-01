from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from backend.domain.thirty_part.base_hook import BaseHookProcessor, IncomingMessage, _http_post

WA_API = "https://graph.facebook.com/v19.0"


class WhatsAppHookProcessor(BaseHookProcessor):
    platform = "whatsapp_business"

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
        if mode == "subscribe" and token == verify_token and challenge:
            return {"content": challenge}
        return None

    async def send_response(self, config: Dict[str, Any], chat_id: str, text: str) -> None:
        access_token = config.get("access_token", "")
        phone_number_id = config.get("phone_number_id", "")
        if not access_token or not phone_number_id:
            raise ValueError("WhatsApp hook requires access_token and phone_number_id")
        url = f"{WA_API}/{phone_number_id}/messages?access_token={access_token}"
        data = {
            "messaging_product": "whatsapp",
            "to": chat_id,
            "type": "text",
            "text": {"body": text[:4096]},
        }
        await asyncio.to_thread(_http_post, url, data, {})
