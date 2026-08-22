from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit
from backend.domain.tools._messaging_http import request_json

LINE_API_BASE = "https://api.line.me/v2/bot"


def _line_request(
    method: str,
    path: str,
    channel_token: str,
    data: Optional[Dict] = None,
    timeout: int = 30,
) -> Dict[str, Any]:
    url = f"{LINE_API_BASE}{path}"
    result = request_json(
        method, url, service="LINE",
        json_body=data, headers={"Authorization": f"Bearer {channel_token}"}, timeout=timeout,
    )
    return result or {"ok": True}


class LINEMessagingToolkit(BaseToolkit):
    """LINE Messaging API toolkit for Official Account chatbots."""

    name: str = "line_messaging"

    def __init__(
        self,
        channel_access_token: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.channel_access_token = channel_access_token

    def _token(self) -> str:
        if not self.channel_access_token:
            raise ValueError("LINE channel access token required. Configure channel_access_token.")
        return self.channel_access_token

    @tool(parse_docstring=True)
    async def line_push_message(
        self,
        to: str,
        messages: List[str],
    ) -> Dict[str, Any]:
        """Push text messages to a LINE user, group, or room.

        Args:
            to: Target user ID, group ID, or room ID (starts with U, C, or R).
            messages: List of text message strings to send (max 5 per call).
        """
        msg_objects = [{"type": "text", "text": m} for m in messages[:5]]
        data = {"to": to, "messages": msg_objects}
        return await asyncio.to_thread(
            _line_request, "POST", "/message/push", self._token(), data
        )

    @tool(parse_docstring=True)
    async def line_broadcast_message(
        self,
        messages: List[str],
    ) -> Dict[str, Any]:
        """Broadcast text messages to all friends of the LINE Official Account.

        Args:
            messages: List of text message strings to broadcast (max 5 per call).
        """
        msg_objects = [{"type": "text", "text": m} for m in messages[:5]]
        data = {"messages": msg_objects}
        return await asyncio.to_thread(
            _line_request, "POST", "/message/broadcast", self._token(), data
        )

    @tool(parse_docstring=True)
    async def line_reply_message(
        self,
        reply_token: str,
        messages: List[str],
    ) -> Dict[str, Any]:
        """Reply to an incoming LINE event using a reply token (from webhook).

        Args:
            reply_token: One-time reply token received from a LINE webhook event.
            messages: List of text message strings to reply with (max 5).
        """
        msg_objects = [{"type": "text", "text": m} for m in messages[:5]]
        data = {"replyToken": reply_token, "messages": msg_objects}
        return await asyncio.to_thread(
            _line_request, "POST", "/message/reply", self._token(), data
        )

    @tool(parse_docstring=True)
    async def line_get_profile(
        self,
        user_id: str,
    ) -> Dict[str, Any]:
        """Retrieve public profile information for a LINE user.

        Args:
            user_id: LINE user ID (starts with U).
        """
        return await asyncio.to_thread(
            _line_request, "GET", f"/profile/{user_id}", self._token()
        )

    @tool(parse_docstring=True)
    async def line_get_followers(
        self,
        limit: int = 300,
    ) -> Dict[str, Any]:
        """Get user IDs of followers of the LINE Official Account.

        Args:
            limit: Maximum number of user IDs to return (1-1000).
        """
        return await asyncio.to_thread(
            _line_request,
            "GET",
            f"/followers/ids?limit={min(max(1, limit), 1000)}",
            self._token(),
        )
