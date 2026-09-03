from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, Optional
from urllib import parse, request as urllib_request

from server.domain.third_party.base_hook import BaseHookProcessor, IncomingMessage, _header, _http_post
from server.domain.third_party.bot_framework_auth import verify_bot_framework_token

MS_TOKEN_URL = "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token"


def _get_bot_token(app_id: str, app_password: str) -> str:
    data = parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": app_id,
        "client_secret": app_password,
        "scope": "https://api.botframework.com/.default",
    }).encode("utf-8")
    req = urllib_request.Request(
        url=MS_TOKEN_URL, method="POST", data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib_request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8")).get("access_token", "")


class SkypeHookProcessor(BaseHookProcessor):
    platform = "skype_messaging"

    def verify_request(
        self, headers: Dict[str, str], raw_body: bytes, config: Dict[str, Any]
    ) -> bool:
        app_id = (config.get("app_id") or "").strip()
        authorization = _header(headers, "Authorization")
        return verify_bot_framework_token(authorization, expected_audience=app_id or None)

    def extract_message(self, body: Dict[str, Any]) -> Optional[IncomingMessage]:
        if body.get("type") != "message":
            return None
        text = body.get("text", "").strip()
        if not text:
            return None
        conversation_id = body.get("conversation", {}).get("id", "")
        user_id = body.get("from", {}).get("id", "")
        service_url = body.get("serviceUrl", "https://smba.trafficmanager.net/apis")
        raw = {**body, "_service_url": service_url}
        return IncomingMessage(chat_id=conversation_id, user_id=user_id, text=text, raw=raw)

    async def send_response(self, config: Dict[str, Any], chat_id: str, text: str) -> None:
        app_id = config.get("app_id", "")
        app_password = config.get("app_password", "")
        service_url = config.get("service_url", "https://smba.trafficmanager.net/apis")
        if not app_id or not app_password:
            raise ValueError("Skype hook requires app_id and app_password")
        token = await asyncio.to_thread(_get_bot_token, app_id, app_password)
        url = f"{service_url.rstrip('/')}/v3/conversations/{chat_id}/activities"
        headers = {"Authorization": f"Bearer {token}"}
        await asyncio.to_thread(_http_post, url, {"type": "message", "text": text}, headers)
