from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional
from urllib import parse

from langchain.tools import tool

from server.domain.tools.base import BaseToolkit
from server.domain.tools._messaging_http import request_json

MS_BOT_TOKEN_URL = "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token"
SKYPE_DEFAULT_SERVICE_URL = "https://smba.trafficmanager.net/apis"


def _get_bot_token(app_id: str, app_password: str, timeout: int = 20) -> str:
    body = parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": app_id,
        "client_secret": app_password,
        "scope": "https://api.botframework.com/.default",
    }).encode("utf-8")
    try:
        resp = request_json(
            "POST", MS_BOT_TOKEN_URL, service="Bot Framework token",
            raw_body=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=timeout,
        )
    except RuntimeError as exc:
        raise RuntimeError(f"Failed to get Bot Framework token: {exc}") from exc
    return resp.get("access_token", "")


def _skype_send(
    service_url: str,
    token: str,
    conversation_id: str,
    data: Dict,
    timeout: int = 30,
) -> Dict[str, Any]:
    url = f"{service_url.rstrip('/')}/v3/conversations/{conversation_id}/activities"
    return request_json(
        "POST", url, service="Skype Bot",
        json_body=data,
        headers={"Authorization": f"Bearer {token}"},
        timeout=timeout,
    )


class SkypeMessagingToolkit(BaseToolkit):
    """Skype messaging toolkit via Microsoft Bot Framework REST API."""

    name: str = "skype_messaging"

    def __init__(
        self,
        app_id: Optional[str] = None,
        app_password: Optional[str] = None,
        service_url: Optional[str] = None,
        conversation_id: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.app_id = app_id
        self.app_password = app_password
        self.service_url = service_url or SKYPE_DEFAULT_SERVICE_URL
        self.conversation_id = conversation_id

    def _validate(self) -> None:
        if not self.app_id or not self.app_password:
            raise ValueError(
                "Skype Bot App ID and password required. Configure app_id and app_password."
            )
        if not self.conversation_id:
            raise ValueError("Skype conversation ID required. Configure conversation_id.")

    @tool(parse_docstring=True)
    async def skype_send_message(
        self,
        text: str,
        conversation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a text message to a Skype conversation via Microsoft Bot Framework.

        Args:
            text: Message text to send.
            conversation_id: Target Skype conversation ID. Uses configured default if not provided.
        """
        self._validate()
        target = conversation_id or self.conversation_id
        token = await asyncio.to_thread(_get_bot_token, self.app_id, self.app_password)
        data = {"type": "message", "text": text}
        return await asyncio.to_thread(_skype_send, self.service_url, token, target, data)

    @tool(parse_docstring=True)
    async def skype_send_rich_message(
        self,
        text: str,
        title: Optional[str] = None,
        subtitle: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a rich formatted message card to a Skype conversation.

        Args:
            text: Message body text.
            title: Optional card title.
            subtitle: Optional card subtitle.
            conversation_id: Target Skype conversation ID. Uses configured default if not provided.
        """
        self._validate()
        target = conversation_id or self.conversation_id
        token = await asyncio.to_thread(_get_bot_token, self.app_id, self.app_password)
        attachment: Dict[str, Any] = {
            "contentType": "application/vnd.microsoft.card.hero",
            "content": {"text": text},
        }
        if title:
            attachment["content"]["title"] = title
        if subtitle:
            attachment["content"]["subtitle"] = subtitle
        data = {"type": "message", "attachments": [attachment]}
        return await asyncio.to_thread(_skype_send, self.service_url, token, target, data)
