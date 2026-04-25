from __future__ import annotations

import asyncio
import hashlib
import json
import time
from typing import Any, Dict, Optional
from urllib import request as urllib_request

from backend.domain.thirty_part.base_hook import BaseHookProcessor, IncomingMessage, _http_post

WECHAT_API = "https://api.weixin.qq.com/cgi-bin"
_token_cache: Dict[str, Any] = {}


def _get_access_token(app_id: str, app_secret: str) -> str:
    cached = _token_cache.get(app_id)
    if cached and cached["exp"] > time.time() + 60:
        return cached["token"]
    url = f"{WECHAT_API}/token?grant_type=client_credential&appid={app_id}&secret={app_secret}"
    req = urllib_request.Request(url=url, method="GET")
    with urllib_request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    token = data.get("access_token", "")
    _token_cache[app_id] = {"token": token, "exp": time.time() + int(data.get("expires_in", 7200))}
    return token


class WeChatHookProcessor(BaseHookProcessor):
    platform = "wechat_messaging"

    def extract_message(self, body: Dict[str, Any]) -> Optional[IncomingMessage]:
        # WeChat sends XML; parsed body should have MsgType and Content
        if body.get("MsgType") != "text":
            return None
        text = body.get("Content", "").strip()
        if not text:
            return None
        user_id = str(body.get("FromUserName", ""))
        return IncomingMessage(chat_id=user_id, user_id=user_id, text=text, raw=body)

    def get_verification_response(
        self, query_params: Dict[str, str], config: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        # WeChat GET verification: echostr parameter
        echo = query_params.get("echostr")
        token = config.get("verify_token", "")
        timestamp = query_params.get("timestamp", "")
        nonce = query_params.get("nonce", "")
        signature = query_params.get("signature", "")
        if token and timestamp and nonce and signature:
            check = hashlib.sha1("".join(sorted([token, timestamp, nonce])).encode()).hexdigest()
            if check == signature and echo:
                return {"content": echo}
        return None

    async def send_response(self, config: Dict[str, Any], chat_id: str, text: str) -> None:
        app_id = config.get("app_id", "")
        app_secret = config.get("app_secret", "")
        if not app_id or not app_secret:
            raise ValueError("WeChat hook requires app_id and app_secret")
        access_token = await asyncio.to_thread(_get_access_token, app_id, app_secret)
        url = f"{WECHAT_API}/message/custom/send?access_token={access_token}"
        data = {"touser": chat_id, "msgtype": "text", "text": {"content": text}}
        await asyncio.to_thread(_http_post, url, data, {})
