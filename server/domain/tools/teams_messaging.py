from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

from langchain.tools import tool

from server.domain.tools.base import BaseToolkit
from server.domain.tools._messaging_http import request_json


def _webhook_post(webhook_url: str, data: Dict, timeout: int = 30) -> Dict[str, Any]:
    return request_json("POST", webhook_url, service="Teams webhook", json_body=data, parse_json=False, timeout=timeout)


class TeamsMessagingToolkit(BaseToolkit):
    """Microsoft Teams webhook toolkit for sending messages and Adaptive Cards."""

    name: str = "teams_messaging"

    def __init__(
        self,
        webhook_url: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.webhook_url = webhook_url

    def _webhook(self) -> str:
        if not self.webhook_url:
            raise ValueError("Teams webhook URL required. Configure webhook_url.")
        return self.webhook_url

    @tool(parse_docstring=True)
    async def teams_send_message(
        self,
        text: str,
        title: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a plain text message to a Microsoft Teams channel via Incoming Webhook.

        Args:
            text: Message body text.
            title: Optional message title displayed above the body.
        """
        data: Dict[str, Any] = {"text": text}
        if title:
            data["title"] = title
        return await asyncio.to_thread(_webhook_post, self._webhook(), data)

    @tool(parse_docstring=True)
    async def teams_send_card(
        self,
        title: str,
        text: str,
        facts: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Send an Adaptive Card to a Microsoft Teams channel.

        Args:
            title: Card title heading.
            text: Card body text.
            facts: Optional list of fact pairs, e.g. [{"name": "Status", "value": "Active"}].
        """
        card_body: List[Dict[str, Any]] = [
            {"type": "TextBlock", "size": "Medium", "weight": "Bolder", "text": title},
            {"type": "TextBlock", "text": text, "wrap": True},
        ]
        if facts:
            card_body.append({
                "type": "FactSet",
                "facts": [{"title": f["name"], "value": f["value"]} for f in facts],
            })

        data: Dict[str, Any] = {
            "type": "message",
            "attachments": [{
                "contentType": "application/vnd.microsoft.card.adaptive",
                "contentUrl": None,
                "content": {
                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                    "type": "AdaptiveCard",
                    "version": "1.4",
                    "body": card_body,
                    "msteams": {"width": "Full"},
                },
            }],
        }
        return await asyncio.to_thread(_webhook_post, self._webhook(), data)

    @tool(parse_docstring=True)
    async def teams_send_action_card(
        self,
        title: str,
        text: str,
        button_label: str,
        button_url: str,
    ) -> Dict[str, Any]:
        """Send an Adaptive Card with a clickable action button to Teams.

        Args:
            title: Card title.
            text: Card body text.
            button_label: Label text for the action button.
            button_url: URL to open when the button is clicked.
        """
        data: Dict[str, Any] = {
            "type": "message",
            "attachments": [{
                "contentType": "application/vnd.microsoft.card.adaptive",
                "contentUrl": None,
                "content": {
                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                    "type": "AdaptiveCard",
                    "version": "1.4",
                    "body": [
                        {"type": "TextBlock", "size": "Medium", "weight": "Bolder", "text": title},
                        {"type": "TextBlock", "text": text, "wrap": True},
                    ],
                    "actions": [
                        {"type": "Action.OpenUrl", "title": button_label, "url": button_url}
                    ],
                },
            }],
        }
        return await asyncio.to_thread(_webhook_post, self._webhook(), data)
