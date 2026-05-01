from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from backend.domain.thirty_part.base_hook import BaseHookProcessor, IncomingMessage, _http_post

LINE_API = "https://api.line.me/v2/bot"


class LINEHookProcessor(BaseHookProcessor):
    platform = "line_messaging"

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
            # Use replyToken as chat_id (one-time, for replying)
            reply_token = event.get("replyToken", "")
            # Fall back to userId for push messages if no replyToken
            chat_id = reply_token or user_id
            raw = {**body, "_reply_token": reply_token, "_user_id": user_id}
            return IncomingMessage(chat_id=chat_id, user_id=user_id, text=text, raw=raw)
        return None

    async def send_response(self, config: Dict[str, Any], chat_id: str, text: str) -> None:
        token = config.get("channel_access_token", "")
        if not token:
            raise ValueError("Missing channel_access_token in LINE hook config")
        headers = {"Authorization": f"Bearer {token}"}

        # chat_id is replyToken if it looks like one (UUID-ish), else use push
        if len(chat_id) > 30 and "-" not in chat_id[:8]:
            # Looks like a reply token — use reply API
            url = f"{LINE_API}/message/reply"
            data = {"replyToken": chat_id, "messages": [{"type": "text", "text": text[:5000]}]}
        else:
            # Use push API with userId
            url = f"{LINE_API}/message/push"
            data = {"to": chat_id, "messages": [{"type": "text", "text": text[:5000]}]}

        await asyncio.to_thread(_http_post, url, data, headers)
