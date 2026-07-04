from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, Optional
from urllib import error, request as urllib_request


def _header(headers: Dict[str, str], name: str) -> str:
    """Case-insensitive header lookup (HTTP headers are case-insensitive)."""
    name_lower = name.lower()
    for key, value in headers.items():
        if key.lower() == name_lower:
            return value or ""
    return ""


def hmac_sha256_hex(secret: str, message: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def hmac_sha256_b64(secret: str, message: bytes) -> str:
    digest = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")


@dataclass
class IncomingMessage:
    chat_id: str
    user_id: str
    text: str
    raw: Dict[str, Any]


class BaseHookProcessor(ABC):
    """Abstract base for all platform webhook processors."""

    platform: str = ""

    @abstractmethod
    def extract_message(self, body: Dict[str, Any]) -> Optional[IncomingMessage]:
        """Parse incoming webhook payload and extract message. Returns None if not a chat message."""

    @abstractmethod
    async def send_response(self, config: Dict[str, Any], chat_id: str, text: str) -> None:
        """Send a response back to the user on this platform."""

    def verify_request(
        self,
        headers: Dict[str, str],
        raw_body: bytes,
        config: Dict[str, Any],
    ) -> bool:
        """Optionally verify webhook signature. Default accepts all."""
        return True

    def get_verification_response(
        self,
        query_params: Dict[str, str],
        config: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """Handle GET-based verification challenges (Facebook, Instagram, WhatsApp).
        Return dict with 'content' key to send as plain text response, or None."""
        return None

    def post_challenge_response(
        self,
        body: Dict[str, Any],
        config: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """Handle POST-based liveness/handshake challenges that must be answered
        synchronously with a JSON body (e.g. Discord Interactions PING -> {"type": 1}).
        Return the JSON dict to send back, or None to continue normal processing."""
        return None


def _http_post(url: str, data: Dict, headers: Dict[str, str], timeout: int = 20) -> Dict:
    payload = json.dumps(data).encode("utf-8")
    headers = {"Content-Type": "application/json", **headers}
    req = urllib_request.Request(url=url, method="POST", data=payload, headers=headers)
    try:
        with urllib_request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body.strip() else {}
    except error.HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code}: {exc.read().decode('utf-8', errors='replace')[:200]}") from exc
    except Exception as exc:
        raise RuntimeError(str(exc)) from exc
