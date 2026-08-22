from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit
from backend.domain.tools._messaging_http import request_json

WHATSAPP_API_BASE = "https://graph.facebook.com/v19.0"


def _wa_request(
    method: str,
    path: str,
    access_token: str,
    data: Optional[Dict] = None,
    timeout: int = 30,
) -> Dict[str, Any]:
    url = f"{WHATSAPP_API_BASE}{path}?access_token={access_token}"
    return request_json(method, url, service="WhatsApp", json_body=data, timeout=timeout)


class WhatsAppBusinessToolkit(BaseToolkit):
    """WhatsApp Business Cloud API toolkit for sending messages to customers."""

    name: str = "whatsapp_business"

    def __init__(
        self,
        access_token: Optional[str] = None,
        phone_number_id: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.access_token = access_token
        self.phone_number_id = phone_number_id

    def _validate(self) -> None:
        if not self.access_token:
            raise ValueError("WhatsApp access token required. Configure access_token.")
        if not self.phone_number_id:
            raise ValueError("WhatsApp phone number ID required. Configure phone_number_id.")

    @tool(parse_docstring=True)
    async def whatsapp_send_text(
        self,
        to: str,
        message: str,
    ) -> Dict[str, Any]:
        """Send a text message via WhatsApp Business Cloud API.

        Args:
            to: Recipient phone number in E.164 format (e.g., +84901234567).
            message: Text message content (max 4096 characters).
        """
        self._validate()
        data = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to.lstrip("+"),
            "type": "text",
            "text": {"preview_url": False, "body": message},
        }
        return await asyncio.to_thread(
            _wa_request,
            "POST",
            f"/{self.phone_number_id}/messages",
            self.access_token,
            data,
        )

    @tool(parse_docstring=True)
    async def whatsapp_send_template(
        self,
        to: str,
        template_name: str,
        language_code: str = "en_US",
        components: Optional[List[Dict]] = None,
    ) -> Dict[str, Any]:
        """Send an approved WhatsApp Business template message.

        Args:
            to: Recipient phone number in E.164 format.
            template_name: Name of the approved Meta Business template.
            language_code: Template language code (e.g., en_US, vi, zh_CN).
            components: Optional list of template component parameters for variable substitution.
        """
        self._validate()
        template: Dict[str, Any] = {
            "name": template_name,
            "language": {"code": language_code},
        }
        if components:
            template["components"] = components
        data = {
            "messaging_product": "whatsapp",
            "to": to.lstrip("+"),
            "type": "template",
            "template": template,
        }
        return await asyncio.to_thread(
            _wa_request,
            "POST",
            f"/{self.phone_number_id}/messages",
            self.access_token,
            data,
        )

    @tool(parse_docstring=True)
    async def whatsapp_send_image(
        self,
        to: str,
        image_url: str,
        caption: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send an image message via WhatsApp Business.

        Args:
            to: Recipient phone number in E.164 format.
            image_url: Public HTTPS URL of the image (JPEG or PNG).
            caption: Optional image caption text.
        """
        self._validate()
        image_data: Dict[str, Any] = {"link": image_url}
        if caption:
            image_data["caption"] = caption
        data = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to.lstrip("+"),
            "type": "image",
            "image": image_data,
        }
        return await asyncio.to_thread(
            _wa_request,
            "POST",
            f"/{self.phone_number_id}/messages",
            self.access_token,
            data,
        )

    @tool(parse_docstring=True)
    async def whatsapp_mark_read(
        self,
        message_id: str,
    ) -> Dict[str, Any]:
        """Mark a received WhatsApp message as read to show double blue ticks.

        Args:
            message_id: ID of the received message to mark as read.
        """
        self._validate()
        data = {
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": message_id,
        }
        return await asyncio.to_thread(
            _wa_request,
            "POST",
            f"/{self.phone_number_id}/messages",
            self.access_token,
            data,
        )
