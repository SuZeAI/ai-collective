from __future__ import annotations

from typing import Any, Dict, Optional

from backend.domain.thirty_part.base_hook import BaseHookProcessor, IncomingMessage


class SnapchatHookProcessor(BaseHookProcessor):
    """Snapchat does not provide a public direct-messaging webhook API.
    This processor only serves as a placeholder stub.
    """

    platform = "snapchat_messaging"

    def extract_message(self, body: Dict[str, Any]) -> Optional[IncomingMessage]:
        return None  # No inbound messaging API

    async def send_response(self, config: Dict[str, Any], chat_id: str, text: str) -> None:
        raise NotImplementedError(
            "Snapchat does not support direct messaging via API. "
            "Use Snapchat Ads API for campaign management only."
        )
