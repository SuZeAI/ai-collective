from __future__ import annotations

import asyncio
import json
import os
from typing import Any, Dict, List, Optional
from urllib import error, request

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit

MESSENGER_API_BASE = "https://graph.facebook.com/v19.0"


def _fb_request(
    method: str,
    path: str,
    access_token: str,
    data: Optional[Dict] = None,
    timeout: int = 30,
) -> Dict[str, Any]:
    sep = "&" if "?" in path else "?"
    url = f"{MESSENGER_API_BASE}{path}{sep}access_token={access_token}"
    payload = None
    headers = {"Content-Type": "application/json"}
    if data is not None:
        payload = json.dumps(data).encode("utf-8")
    req = request.Request(url=url, method=method, data=payload, headers=headers)
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Messenger API error {exc.code}: {body[:300]}") from exc
    except (error.URLError, TimeoutError) as exc:
        raise RuntimeError(f"Messenger request failed: {exc}") from exc


class FacebookMessengerToolkit(BaseToolkit):
    """Facebook Messenger Platform API toolkit for page-based messaging."""

    name: str = "facebook_messenger"

    def __init__(
        self,
        page_access_token: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.page_access_token = page_access_token or os.getenv(
            "MESSENGER_PAGE_ACCESS_TOKEN", ""
        )

    def _token(self) -> str:
        if not self.page_access_token:
            raise ValueError(
                "Messenger page access token required. Set MESSENGER_PAGE_ACCESS_TOKEN."
            )
        return self.page_access_token

    @tool(parse_docstring=True)
    async def messenger_send_text(
        self,
        recipient_id: str,
        message: str,
    ) -> Dict[str, Any]:
        """Send a text message via Facebook Messenger to a page user.

        Args:
            recipient_id: Facebook Page-Scoped User ID (PSID) of the recipient.
            message: Text message content (max 2000 characters).
        """
        data = {
            "recipient": {"id": recipient_id},
            "message": {"text": message},
            "messaging_type": "RESPONSE",
        }
        return await asyncio.to_thread(_fb_request, "POST", "/me/messages", self._token(), data)

    @tool(parse_docstring=True)
    async def messenger_send_quick_replies(
        self,
        recipient_id: str,
        message: str,
        quick_replies: List[str],
    ) -> Dict[str, Any]:
        """Send a Messenger message with quick reply buttons for the user to tap.

        Args:
            recipient_id: Facebook Page-Scoped User ID (PSID).
            message: Prompt message text shown above the quick replies.
            quick_replies: List of quick reply option labels (max 13).
        """
        replies = [
            {
                "content_type": "text",
                "title": r[:20],
                "payload": r.upper().replace(" ", "_")[:1000],
            }
            for r in quick_replies[:13]
        ]
        data = {
            "recipient": {"id": recipient_id},
            "message": {"text": message, "quick_replies": replies},
        }
        return await asyncio.to_thread(_fb_request, "POST", "/me/messages", self._token(), data)

    @tool(parse_docstring=True)
    async def messenger_send_image(
        self,
        recipient_id: str,
        image_url: str,
    ) -> Dict[str, Any]:
        """Send an image attachment via Facebook Messenger.

        Args:
            recipient_id: Facebook Page-Scoped User ID (PSID).
            image_url: Public URL of the image to send.
        """
        data = {
            "recipient": {"id": recipient_id},
            "message": {
                "attachment": {
                    "type": "image",
                    "payload": {"url": image_url, "is_reusable": True},
                }
            },
        }
        return await asyncio.to_thread(_fb_request, "POST", "/me/messages", self._token(), data)

    @tool(parse_docstring=True)
    async def messenger_get_user_profile(
        self,
        user_psid: str,
    ) -> Dict[str, Any]:
        """Retrieve public profile information for a Messenger user.

        Args:
            user_psid: Page-Scoped ID of the Facebook user.
        """
        path = f"/{user_psid}?fields=name,first_name,last_name,profile_pic"
        return await asyncio.to_thread(_fb_request, "GET", path, self._token())
