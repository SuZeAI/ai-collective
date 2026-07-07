from __future__ import annotations

import asyncio
import hmac
from typing import Any, Dict, Optional

from backend.domain.third_party.base_hook import BaseHookProcessor, IncomingMessage, _http_post
from backend.domain.third_party.whatsapp_hook import verify_meta_signature

GRAPH_API = "https://graph.facebook.com/v19.0"


class InstagramHookProcessor(BaseHookProcessor):
    platform = "instagram"

    def verify_request(
        self, headers: Dict[str, str], raw_body: bytes, config: Dict[str, Any]
    ) -> bool:
        return verify_meta_signature(headers, raw_body, config.get("app_secret", ""))

    def extract_message(self, body: Dict[str, Any]) -> Optional[IncomingMessage]:
        if body.get("object") != "instagram":
            return None
        for entry in body.get("entry", []):
            for messaging in entry.get("messaging", []):
                if "message" not in messaging:
                    continue
                msg = messaging["message"]
                if msg.get("is_echo"):
                    continue
                text = msg.get("text", "").strip()
                if not text:
                    continue
                sender_id = str(messaging.get("sender", {}).get("id", ""))
                return IncomingMessage(
                    chat_id=sender_id, user_id=sender_id, text=text, raw=body
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
        access_token = config.get("page_access_token", "")
        if not access_token:
            raise ValueError("Missing page_access_token in Instagram hook config")
        url = f"{GRAPH_API}/me/messages"
        headers = {"Authorization": f"Bearer {access_token}"}
        data = {
            "recipient": {"id": chat_id},
            "message": {"text": text[:1000]},
        }
        await asyncio.to_thread(_http_post, url, data, headers)
