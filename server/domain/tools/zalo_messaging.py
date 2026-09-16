from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional
from urllib import parse

from langchain.tools import tool

from server.domain.tools.base import BaseToolkit
from server.domain.tools._messaging_http import request_json

ZALO_API_BASE = "https://openapi.zalo.me/v2.0/oa"


def _zalo_request(
    method: str,
    path: str,
    access_token: str,
    data: Optional[Dict] = None,
    params: Optional[Dict] = None,
    timeout: int = 30,
) -> Dict[str, Any]:
    url = f"{ZALO_API_BASE}{path}"
    if params:
        url = f"{url}?{parse.urlencode(params)}"
    return request_json(
        method, url, service="Zalo",
        json_body=data,
        headers={"access_token": access_token},
        timeout=timeout,
    )


class ZaloMessagingToolkit(BaseToolkit):
    """Zalo Official Account (OA) API toolkit for messaging Vietnamese users."""

    name: str = "zalo_messaging"

    def __init__(
        self,
        access_token: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.access_token = access_token

    def _token(self) -> str:
        if not self.access_token:
            raise ValueError("Zalo OA access token required. Configure access_token.")
        return self.access_token

    @tool(parse_docstring=True)
    async def zalo_send_text(
        self,
        user_id: str,
        message: str,
    ) -> Dict[str, Any]:
        """Send a text message to a Zalo user who follows the Official Account.

        Args:
            user_id: Zalo user ID of the follower.
            message: Text message content (supports Vietnamese UTF-8).
        """
        data = {
            "recipient": {"user_id": user_id},
            "message": {"text": message},
        }
        return await asyncio.to_thread(
            _zalo_request, "POST", "/message", self._token(), data
        )

    @tool(parse_docstring=True)
    async def zalo_send_image(
        self,
        user_id: str,
        image_url: str,
        caption: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send an image message to a Zalo user.

        Args:
            user_id: Zalo user ID of the recipient follower.
            image_url: Public URL of the image to send.
            caption: Optional text caption displayed below the image.
        """
        attachment: Dict[str, Any] = {
            "type": "template",
            "payload": {
                "template_type": "media",
                "elements": [{"media_type": "image", "url": image_url}],
            },
        }
        msg: Dict[str, Any] = {"attachment": attachment}
        if caption:
            msg["text"] = caption
        data = {
            "recipient": {"user_id": user_id},
            "message": msg,
        }
        return await asyncio.to_thread(
            _zalo_request, "POST", "/message", self._token(), data
        )

    @tool(parse_docstring=True)
    async def zalo_send_list_message(
        self,
        user_id: str,
        elements: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        """Send a list-style message with multiple items to a Zalo user.

        Args:
            user_id: Zalo user ID of the follower.
            elements: List of items, each with keys: title, subtitle (optional), image_url (optional), default_action_url (optional).
        """
        formatted = []
        for el in elements[:4]:
            item: Dict[str, Any] = {"title": el.get("title", "")}
            if el.get("subtitle"):
                item["subtitle"] = el["subtitle"]
            if el.get("image_url"):
                item["image_url"] = el["image_url"]
            if el.get("default_action_url"):
                item["default_action"] = {"type": "oa.open.url", "url": el["default_action_url"]}
            formatted.append(item)

        data = {
            "recipient": {"user_id": user_id},
            "message": {
                "attachment": {
                    "type": "template",
                    "payload": {"template_type": "list", "elements": formatted},
                }
            },
        }
        return await asyncio.to_thread(
            _zalo_request, "POST", "/message", self._token(), data
        )

    @tool(parse_docstring=True)
    async def zalo_get_followers(
        self,
        offset: int = 0,
        count: int = 50,
    ) -> Dict[str, Any]:
        """Get list of user IDs who follow the Zalo Official Account.

        Args:
            offset: Pagination offset (0-based).
            count: Number of followers to return per page (1-50).
        """
        params = {"offset": offset, "count": min(max(1, count), 50)}
        return await asyncio.to_thread(
            _zalo_request, "GET", "/getfollowers", self._token(), params=params
        )

    @tool(parse_docstring=True)
    async def zalo_get_user_profile(
        self,
        user_id: str,
    ) -> Dict[str, Any]:
        """Get profile information of a Zalo user who follows the OA.

        Args:
            user_id: Zalo user ID.
        """
        params = {"user_id": user_id}
        return await asyncio.to_thread(
            _zalo_request, "GET", "/profile", self._token(), params=params
        )
