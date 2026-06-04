from __future__ import annotations

import asyncio
import hmac
from typing import Any, Dict, Optional

from backend.domain.thirty_part.base_hook import (
    BaseHookProcessor,
    IncomingMessage,
    _header,
    _http_post,
    hmac_sha256_b64,
)

LINE_API = "https://api.line.me/v2/bot"


class LINEHookProcessor(BaseHookProcessor):
    platform = "line_messaging"

    def verify_request(
        self, headers: Dict[str, str], raw_body: bytes, config: Dict[str, Any]
    ) -> bool:
        channel_secret = (config.get("channel_secret") or "").strip()
        if not channel_secret:
            return True  # no secret configured — cannot verify
        signature = _header(headers, "X-Line-Signature")
        if not signature:
            return False
        expected = hmac_sha256_b64(channel_secret, raw_body)
        return hmac.compare_digest(expected, signature)

    def extract_message(self, body: Dict[str, Any]) -> Optional[IncomingMessage]:
        for event in body.get("events", []):
            if event.get("type") != "message":
                continue
            msg = event.get("message", {})
            if msg.get("type") != "text":
                continue
            text = msg.get("text", "").strip()
            if not text:
                continue
            source = event.get("source", {})
            user_id = str(source.get("userId", ""))
            reply_token = event.get("replyToken", "")
            # Prefer push-by-userId: replyToken is one-time and expires (~1 min),
            # and the agent reply is produced asynchronously, by which point the
            # reply token is usually already invalid. Only fall back to the reply
            # API (with an explicit prefix) when no userId is available.
            chat_id = user_id or (f"reply:{reply_token}" if reply_token else "")
            if not chat_id:
                continue
            raw = {**body, "_reply_token": reply_token, "_user_id": user_id}
            return IncomingMessage(chat_id=chat_id, user_id=user_id, text=text, raw=raw)
        return None

    async def send_response(self, config: Dict[str, Any], chat_id: str, text: str) -> None:
        token = config.get("channel_access_token", "")
        if not token:
            raise ValueError("Missing channel_access_token in LINE hook config")
        headers = {"Authorization": f"Bearer {token}"}

        # chat_id carries an explicit "reply:" prefix only when no userId was
        # available; otherwise it is a userId and we push.
        if chat_id.startswith("reply:"):
            url = f"{LINE_API}/message/reply"
            data = {"replyToken": chat_id[len("reply:"):], "messages": [{"type": "text", "text": text[:5000]}]}
        else:
            url = f"{LINE_API}/message/push"
            data = {"to": chat_id, "messages": [{"type": "text", "text": text[:5000]}]}

        await asyncio.to_thread(_http_post, url, data, headers)
