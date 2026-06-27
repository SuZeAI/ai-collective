"""SSRF protection for outbound HTTP made on behalf of the LLM/staff.

LLM-supplied URLs must never be allowed to reach internal services or the cloud
metadata endpoint. ``validate_public_url`` enforces an http/https scheme and
rejects any hostname that resolves to a private, loopback, link-local, reserved
or multicast address.

Set ``ALLOW_PRIVATE_HTTP=1`` to disable the guard (e.g. for local development
against internal services).
"""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse
from backend.api.settings import settings


class BlockedURLError(ValueError):
    """Raised when a URL is rejected by the SSRF guard."""


def _guard_disabled() -> bool:
    return settings.security.allow_private_http


def _is_blocked_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return True  # not a parseable IP — reject defensively
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_reserved
        or addr.is_multicast
        or addr.is_unspecified
    )


def validate_public_url(url: str) -> None:
    """Raise ``BlockedURLError`` if ``url`` is not a safe public http(s) target."""
    if _guard_disabled():
        return

    parsed = urlparse(url)
    scheme = (parsed.scheme or "").lower()
    if scheme not in ("http", "https"):
        raise BlockedURLError(f"Blocked URL scheme: {scheme or '(none)'!r}; only http/https allowed")

    host = parsed.hostname
    if not host:
        raise BlockedURLError("Blocked URL: missing host")

    # Resolve every address the host maps to and reject if any is internal.
    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if scheme == "https" else 80), proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise BlockedURLError(f"Could not resolve host {host!r}: {exc}") from exc

    resolved = {info[4][0] for info in infos}
    if not resolved:
        raise BlockedURLError(f"Could not resolve host {host!r}")

    for ip in resolved:
        if _is_blocked_ip(ip):
            raise BlockedURLError(f"Blocked URL: host {host!r} resolves to non-public address {ip}")
