from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional
from urllib import parse, request as urllib_request

from backend.domain.third_party.base_hook import BaseHookProcessor, IncomingMessage

CALLMEBOT_URL = "https://signal.callmebot.com/signal/send.php"


class SignalHookProcessor(BaseHookProcessor):
    """Signal via CallMeBot gateway — outbound only (no inbound webhook)."""

    platform = "signal_messaging"

    def verify_request(
        self, headers: Dict[str, str], raw_body: bytes, config: Dict[str, Any]
    ) -> bool:
        # No-op: extract_message below never returns a message for this
        # platform (CallMeBot is outbound-only), so there is nothing an
        # inbound POST here could forge — accepting is safe regardless.
        return True

    def extract_message(self, body: Dict[str, Any]) -> Optional[IncomingMessage]:
        # CallMeBot has no inbound webhook — return None always
        return None

    async def send_response(self, config: Dict[str, Any], chat_id: str, text: str) -> None:
        phone = config.get("phone_number", "") or chat_id
        api_key = config.get("api_key", "")
        if not phone or not api_key:
            raise ValueError("Signal hook requires phone_number and api_key (CallMeBot)")

        def _send() -> None:
            params = parse.urlencode({"phone": phone, "apikey": api_key, "text": text})
            url = f"{CALLMEBOT_URL}?{params}"
            req = urllib_request.Request(url=url, method="GET")
            with urllib_request.urlopen(req, timeout=20):
                pass

        await asyncio.to_thread(_send)
