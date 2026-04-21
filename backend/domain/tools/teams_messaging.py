from __future__ import annotations

import asyncio
import json
import os
from typing import Any, Dict, List, Optional
from urllib import error, request

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit


def _webhook_post(webhook_url: str, data: Dict, timeout: int = 30) -> Dict[str, Any]:
    payload = json.dumps(data).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    req = request.Request(url=webhook_url, method="POST", data=payload, headers=headers)
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return {"ok": True, "response": body[:500]}
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Teams webhook error {exc.code}: {body[:300]}") from exc
    except (error.URLError, TimeoutError) as exc:
        raise RuntimeError(f"Teams request failed: {exc}") from exc


class TeamsMessagingToolkit(BaseToolkit):
    """Microsoft Teams webhook toolkit for sending messages and Adaptive Cards."""

    name: str = "teams_messaging"

    def __init__(
        self,
        webhook_url: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.webhook_url = webhook_url or os.getenv("TEAMS_WEBHOOK_URL", "")

    def _webhook(self) -> str:
        if not self.webhook_url:
            raise ValueError(
                "Teams webhook URL required. Set TEAMS_WEBHOOK_URL or configure webhook_url."
            )
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
