from __future__ import annotations

import asyncio
import json
import time
from typing import Any, Dict, Optional
from urllib import error, request

from langchain.tools import tool

from server.domain.tools.base import BaseToolkit

WECHAT_API_BASE = "https://api.weixin.qq.com/cgi-bin"

_token_cache: Dict[str, Any] = {}


def _get_access_token(app_id: str, app_secret: str, timeout: int = 15) -> str:
    cache_key = f"{app_id}"
    cached = _token_cache.get(cache_key)
    if cached and cached["expires_at"] > time.time() + 60:
        return cached["token"]

    url = (
        f"{WECHAT_API_BASE}/token"
        f"?grant_type=client_credential&appid={app_id}&secret={app_secret}"
    )
    req = request.Request(url=url, method="GET")
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if "errcode" in data and data["errcode"] != 0:
                raise RuntimeError(f"WeChat token error {data['errcode']}: {data.get('errmsg')}")
            token = data.get("access_token", "")
            expires_in = int(data.get("expires_in", 7200))
            _token_cache[cache_key] = {
                "token": token,
                "expires_at": time.time() + expires_in,
            }
            return token
    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError(f"WeChat access token request failed: {exc}") from exc


def _wechat_request(
    method: str,
    path: str,
    access_token: str,
    data: Optional[Dict] = None,
    timeout: int = 30,
) -> Dict[str, Any]:
    sep = "&" if "?" in path else "?"
    url = f"{WECHAT_API_BASE}{path}{sep}access_token={access_token}"
    payload = None
    headers = {"Content-Type": "application/json"}
    if data is not None:
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
    req = request.Request(url=url, method=method, data=payload, headers=headers)
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"WeChat API error {exc.code}: {body[:300]}") from exc
    except (error.URLError, TimeoutError) as exc:
        raise RuntimeError(f"WeChat request failed: {exc}") from exc


class WeChatMessagingToolkit(BaseToolkit):
    """WeChat Official Accounts Platform API toolkit for messaging followers."""

    name: str = "wechat_messaging"

    def __init__(
        self,
        app_id: Optional[str] = None,
        app_secret: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.app_id = app_id
        self.app_secret = app_secret

    def _get_token(self) -> str:
        if not self.app_id or not self.app_secret:
            raise ValueError("WeChat App ID and Secret required. Configure app_id and app_secret.")
        return _get_access_token(self.app_id, self.app_secret)

    @tool(parse_docstring=True)
    async def wechat_send_text(
        self,
        to_user: str,
        message: str,
    ) -> Dict[str, Any]:
        """Send a customer service text message to a WeChat follower.

        Args:
            to_user: WeChat OpenID of the recipient (obtained from follower list or webhooks).
            message: Text message content (supports Chinese UTF-8).
        """
        token = await asyncio.to_thread(self._get_token)
        payload = {
            "touser": to_user,
            "msgtype": "text",
            "text": {"content": message},
        }
        return await asyncio.to_thread(
            _wechat_request, "POST", "/message/custom/send", token, payload
        )

    @tool(parse_docstring=True)
    async def wechat_send_template(
        self,
        to_user: str,
        template_id: str,
        data: Dict[str, Any],
        url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send an approved WeChat template message to a follower.

        Args:
            to_user: WeChat OpenID of the recipient follower.
            template_id: ID of the approved message template in WeChat Official Account platform.
            data: Template field values, e.g. {"keyword1": {"value": "hello", "color": "#173177"}}.
            url: Optional URL to open when user taps the message.
        """
        token = await asyncio.to_thread(self._get_token)
        payload: Dict[str, Any] = {
            "touser": to_user,
            "template_id": template_id,
            "data": data,
        }
        if url:
            payload["url"] = url
        return await asyncio.to_thread(
            _wechat_request, "POST", "/message/template/send", token, payload
        )

    @tool(parse_docstring=True)
    async def wechat_get_followers(
        self,
        next_openid: str = "",
    ) -> Dict[str, Any]:
        """Get list of follower OpenIDs for the WeChat Official Account.

        Args:
            next_openid: Pagination cursor from previous response (empty string for first page).
        """
        token = await asyncio.to_thread(self._get_token)
        path = f"/user/get?next_openid={next_openid}"
        return await asyncio.to_thread(_wechat_request, "GET", path, token)

    @tool(parse_docstring=True)
    async def wechat_get_user_info(
        self,
        openid: str,
    ) -> Dict[str, Any]:
        """Get profile information for a WeChat follower.

        Args:
            openid: WeChat OpenID of the follower.
        """
        token = await asyncio.to_thread(self._get_token)
        path = f"/user/info?openid={openid}&lang=zh_CN"
        return await asyncio.to_thread(_wechat_request, "GET", path, token)

    @tool(parse_docstring=True)
    async def wechat_send_image(
        self,
        to_user: str,
        media_id: str,
    ) -> Dict[str, Any]:
        """Send an image to a WeChat follower using an uploaded media ID.

        Args:
            to_user: WeChat OpenID of the recipient.
            media_id: Temporary media ID obtained from WeChat media upload API.
        """
        token = await asyncio.to_thread(self._get_token)
        payload = {
            "touser": to_user,
            "msgtype": "image",
            "image": {"media_id": media_id},
        }
        return await asyncio.to_thread(
            _wechat_request, "POST", "/message/custom/send", token, payload
        )
