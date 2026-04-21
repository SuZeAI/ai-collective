from __future__ import annotations

import asyncio
import json
import os
from typing import Any, Dict, Optional
from urllib import error, request

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit

VIBER_API_BASE = "https://chatapi.viber.com/pa"


def _viber_request(
    method_path: str,
    auth_token: str,
    data: Dict,
    timeout: int = 30,
) -> Dict[str, Any]:
    url = f"{VIBER_API_BASE}/{method_path}"
    payload = json.dumps(data).encode("utf-8")
    headers = {
        "X-Viber-Auth-Token": auth_token,
        "Content-Type": "application/json",
    }
    req = request.Request(url=url, method="POST", data=payload, headers=headers)
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Viber API error {exc.code}: {body[:300]}") from exc
    except (error.URLError, TimeoutError) as exc:
        raise RuntimeError(f"Viber request failed: {exc}") from exc


class ViberMessagingToolkit(BaseToolkit):
    """Viber Bot API toolkit for sending messages to Viber users."""

    name: str = "viber_messaging"

    def __init__(
        self,
        auth_token: Optional[str] = None,
        sender_name: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.auth_token = auth_token or os.getenv("VIBER_AUTH_TOKEN", "")
        self.sender_name = sender_name or os.getenv("VIBER_SENDER_NAME", "AI Assistant")

    def _token(self) -> str:
        if not self.auth_token:
            raise ValueError("Viber auth token required. Set VIBER_AUTH_TOKEN.")
        return self.auth_token

    @tool(parse_docstring=True)
    async def viber_send_message(
        self,
        receiver: str,
        text: str,
    ) -> Dict[str, Any]:
        """Send a text message to a Viber user.

        Args:
            receiver: Viber user ID of the recipient (obtained from Viber webhook subscription).
            text: Message text to send (max 7000 characters).
        """
        data = {
            "receiver": receiver,
            "type": "text",
            "sender": {"name": self.sender_name},
            "text": text,
        }
        return await asyncio.to_thread(_viber_request, "send_message", self._token(), data)

    @tool(parse_docstring=True)
    async def viber_send_image(
        self,
        receiver: str,
        media_url: str,
        thumbnail_url: Optional[str] = None,
        caption: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send an image to a Viber user.

        Args:
            receiver: Viber user ID of the recipient.
            media_url: Public HTTPS URL of the image (JPEG recommended, max 1MB).
            thumbnail_url: Optional thumbnail URL for preview.
            caption: Optional image caption text.
        """
        data: Dict[str, Any] = {
            "receiver": receiver,
            "type": "picture",
            "sender": {"name": self.sender_name},
            "media": media_url,
            "text": caption or "",
        }
        if thumbnail_url:
            data["thumbnail"] = thumbnail_url
        return await asyncio.to_thread(_viber_request, "send_message", self._token(), data)

    @tool(parse_docstring=True)
    async def viber_get_account_info(self) -> Dict[str, Any]:
        """Retrieve information and stats for the Viber bot account."""
        return await asyncio.to_thread(_viber_request, "get_account_info", self._token(), {})

    @tool(parse_docstring=True)
    async def viber_get_user_details(
        self,
        user_id: str,
    ) -> Dict[str, Any]:
        """Get public details of a specific Viber user.

        Args:
            user_id: Viber user ID.
        """
        data = {"id": user_id}
        return await asyncio.to_thread(_viber_request, "get_user_details", self._token(), data)
