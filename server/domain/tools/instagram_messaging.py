from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from langchain.tools import tool

from server.domain.tools.base import BaseToolkit
from server.domain.tools._messaging_http import request_json

IG_API_BASE = "https://graph.facebook.com/v19.0"


def _ig_request(
    method: str,
    path: str,
    access_token: str,
    data: Optional[Dict] = None,
    timeout: int = 30,
) -> Dict[str, Any]:
    sep = "&" if "?" in path else "?"
    url = f"{IG_API_BASE}{path}{sep}access_token={access_token}"
    return request_json(method, url, service="Instagram", json_body=data, timeout=timeout)


class InstagramMessagingToolkit(BaseToolkit):
    """Instagram Messaging API toolkit via Meta Graph API for business accounts."""

    name: str = "instagram_messaging"

    def __init__(
        self,
        page_access_token: Optional[str] = None,
        ig_user_id: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.page_access_token = page_access_token
        self.ig_user_id = ig_user_id

    def _token(self) -> str:
        if not self.page_access_token:
            raise ValueError("Instagram page access token required. Configure page_access_token.")
        return self.page_access_token

    @tool(parse_docstring=True)
    async def instagram_send_dm(
        self,
        recipient_id: str,
        message: str,
    ) -> Dict[str, Any]:
        """Send a direct message to an Instagram user via the Messaging API.

        Args:
            recipient_id: Instagram-Scoped User ID (IGSID) of the recipient.
            message: Text message content to send.
        """
        data = {
            "recipient": {"id": recipient_id},
            "message": {"text": message},
        }
        return await asyncio.to_thread(_ig_request, "POST", "/me/messages", self._token(), data)

    @tool(parse_docstring=True)
    async def instagram_get_conversations(
        self,
        limit: int = 10,
    ) -> Dict[str, Any]:
        """Get list of Instagram DM conversation threads for the business account.

        Args:
            limit: Number of conversations to retrieve (1-50).
        """
        if not self.ig_user_id:
            raise ValueError("Instagram user ID required. Configure ig_user_id.")
        path = f"/{self.ig_user_id}/conversations?platform=instagram&limit={min(max(1, limit), 50)}"
        return await asyncio.to_thread(_ig_request, "GET", path, self._token())

    @tool(parse_docstring=True)
    async def instagram_get_media(
        self,
        limit: int = 12,
    ) -> Dict[str, Any]:
        """Retrieve media posts from the connected Instagram business account.

        Args:
            limit: Number of media items to return (1-100).
        """
        if not self.ig_user_id:
            raise ValueError("Instagram user ID required. Configure ig_user_id.")
        fields = "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count"
        path = f"/{self.ig_user_id}/media?fields={fields}&limit={min(max(1, limit), 100)}"
        return await asyncio.to_thread(_ig_request, "GET", path, self._token())

    @tool(parse_docstring=True)
    async def instagram_reply_to_comment(
        self,
        media_id: str,
        comment_id: str,
        reply_text: str,
    ) -> Dict[str, Any]:
        """Reply to a comment on an Instagram post.

        Args:
            media_id: ID of the Instagram media post.
            comment_id: ID of the comment to reply to.
            reply_text: Text reply content.
        """
        data = {"message": reply_text}
        path = f"/{comment_id}/replies"
        return await asyncio.to_thread(_ig_request, "POST", path, self._token(), data)
