from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from server.domain.third_party.base_hook import (
    BaseHookProcessor,
    IncomingMessage,
    _http_post,
    extract_messenger_style_message,
    verify_meta_challenge,
)
from server.domain.third_party.whatsapp_hook import verify_meta_signature

GRAPH_API = "https://graph.facebook.com/v19.0"


class InstagramHookProcessor(BaseHookProcessor):
    platform = "instagram"

    def verify_request(
        self, headers: Dict[str, str], raw_body: bytes, config: Dict[str, Any]
    ) -> bool:
        return verify_meta_signature(headers, raw_body, config.get("app_secret", ""))

    def extract_message(self, body: Dict[str, Any]) -> Optional[IncomingMessage]:
        return extract_messenger_style_message(body, "instagram")

    def get_verification_response(
        self, query_params: Dict[str, str], config: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        return verify_meta_challenge(query_params, config)

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
