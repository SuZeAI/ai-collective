from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, Optional
from urllib import error, request as urllib_request

from server.domain.third_party.base_hook import BaseHookProcessor, IncomingMessage

ZALO_API = "https://openapi.zalo.me/v2.0/oa"


def _zalo_post(access_token: str, path: str, data: Dict) -> Dict:
    url = f"{ZALO_API}{path}"
    payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
    headers = {"access_token": access_token, "Content-Type": "application/json"}
    req = urllib_request.Request(url=url, method="POST", data=payload, headers=headers)
    try:
        with urllib_request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as exc:
        raise RuntimeError(f"Zalo API {exc.code}: {exc.read().decode('utf-8', errors='replace')[:200]}") from exc
    except Exception as exc:
        raise RuntimeError(str(exc)) from exc


class ZaloHookProcessor(BaseHookProcessor):
    platform = "zalo_messaging"

    def extract_message(self, body: Dict[str, Any]) -> Optional[IncomingMessage]:
        event_name = body.get("event_name", "")
        if event_name not in ("user_send_text", "user_text"):
            return None
        sender = body.get("sender", {})
        user_id = str(sender.get("id", ""))
        message = body.get("message", {})
        text = message.get("text", "").strip()
        if not text:
            return None
        return IncomingMessage(chat_id=user_id, user_id=user_id, text=text, raw=body)

    async def send_response(self, config: Dict[str, Any], chat_id: str, text: str) -> None:
        access_token = config.get("access_token", "")
        if not access_token:
            raise ValueError("Missing access_token in Zalo hook config")
        data = {
            "recipient": {"user_id": chat_id},
            "message": {"text": text},
        }
        await asyncio.to_thread(_zalo_post, access_token, "/message", data)
