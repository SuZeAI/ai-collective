from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional
from urllib import parse

from langchain.tools import tool

from server.domain.tools.base import BaseToolkit
from server.domain.tools._messaging_http import request_json

CALLMEBOT_SIGNAL_URL = "https://signal.callmebot.com/signal/send.php"


def _signal_send(
    phone: str,
    api_key: str,
    message: str,
    timeout: int = 30,
) -> Dict[str, Any]:
    params = parse.urlencode({"phone": phone, "apikey": api_key, "text": message})
    url = f"{CALLMEBOT_SIGNAL_URL}?{params}"
    return request_json("GET", url, service="Signal gateway", parse_json=False, timeout=timeout)


class SignalMessagingToolkit(BaseToolkit):
    """Signal messaging toolkit via the CallMeBot API gateway.

    Setup: visit signal.callmebot.com to register your phone number and get an API key.
    """

    name: str = "signal_messaging"

    def __init__(
        self,
        phone_number: Optional[str] = None,
        api_key: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.phone_number = phone_number
        self.api_key = api_key

    def _validate(self) -> None:
        if not self.phone_number:
            raise ValueError(
                "Signal phone number required. Configure phone_number (international format, e.g. +84901234567)."
            )
        if not self.api_key:
            raise ValueError(
                "CallMeBot API key required. Register at signal.callmebot.com and configure api_key."
            )

    @tool(parse_docstring=True)
    async def signal_send_message(
        self,
        message: str,
        phone_number: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a text message via Signal using the CallMeBot gateway.

        Args:
            message: Text message to deliver via Signal.
            phone_number: Recipient phone number in international format (e.g., +84901234567). Uses configured default if not provided.
        """
        self._validate()
        target = phone_number or self.phone_number
        return await asyncio.to_thread(_signal_send, target, self.api_key, message)
