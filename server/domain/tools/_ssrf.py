"""SSRF protection for outbound HTTP made on behalf of the LLM/staff.

LLM-supplied URLs must never be allowed to reach internal services or the cloud
metadata endpoint. ``validate_public_url`` enforces an http/https scheme and
rejects any hostname that resolves to a private, loopback, link-local, reserved
or multicast address.

``validate_public_url`` alone is vulnerable to DNS rebinding: it resolves the
host once to check the address, but the actual connection (made later, by
urllib/httpx's own resolver) re-resolves the host and may get a different
answer from a malicious/rebinding DNS server. ``resolve_validated_ip`` +
``PinnedHTTPConnection``/``PinnedHTTPSConnection`` (urllib) and
``SSRFSafeAsyncTransport`` (httpx) close that gap by resolving once,
validating, and pinning the actual socket connection to that exact address —
while still sending the correct ``Host`` header / TLS SNI so hostname-based
routing and certificate validation keep working.

Set ``ALLOW_PRIVATE_HTTP=1`` to disable the guard (e.g. for local development
against internal services).
"""

from __future__ import annotations

import http.client
import ipaddress
import socket
from urllib.parse import urlparse
from urllib.request import HTTPHandler, HTTPSHandler, HTTPRedirectHandler, build_opener

from server.api.settings import settings


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


def _resolve_all(host: str, port: int) -> list[str]:
    try:
        infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise BlockedURLError(f"Could not resolve host {host!r}: {exc}") from exc
    resolved: list[str] = []
    for info in infos:
        ip = info[4][0]
        if ip not in resolved:
            resolved.append(ip)
    if not resolved:
        raise BlockedURLError(f"Could not resolve host {host!r}")
    return resolved


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

    resolved = _resolve_all(host, parsed.port or (443 if scheme == "https" else 80))
    for ip in resolved:
        if _is_blocked_ip(ip):
            raise BlockedURLError(f"Blocked URL: host {host!r} resolves to non-public address {ip}")


def resolve_validated_ip(host: str, port: int) -> str | None:
    """Resolve ``host``, validate every candidate address, and return one to pin to.

    Returns ``None`` when the guard is disabled (callers should fall back to
    normal, unpinned resolution in that case).
    """
    if _guard_disabled():
        return None
    resolved = _resolve_all(host, port)
    for ip in resolved:
        if _is_blocked_ip(ip):
            raise BlockedURLError(f"Blocked URL: host {host!r} resolves to non-public address {ip}")
    # Prefer IPv4: some container/network setups advertise a working AAAA
    # record with no real IPv6 route, which would otherwise pin the connection
    # to an unreachable address.
    for ip in resolved:
        if ipaddress.ip_address(ip).version == 4:
            return ip
    return resolved[0]


# ── urllib: connection classes that pin to the validated IP ──────────────────

class PinnedHTTPConnection(http.client.HTTPConnection):
    def connect(self) -> None:
        ip = resolve_validated_ip(self.host, self.port) or self.host
        self.sock = self._create_connection((ip, self.port), self.timeout, self.source_address)


class PinnedHTTPSConnection(http.client.HTTPSConnection):
    def connect(self) -> None:
        ip = resolve_validated_ip(self.host, self.port) or self.host
        sock = self._create_connection((ip, self.port), self.timeout, self.source_address)
        if self._tunnel_host:
            self.sock = sock
            self._tunnel()
        self.sock = self._context.wrap_socket(sock, server_hostname=self.host)


class _SSRFSafeRedirectHandler(HTTPRedirectHandler):
    """Re-validate the target of every redirect to prevent redirect-based SSRF."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[override]
        validate_public_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class _SSRFSafeHTTPHandler(HTTPHandler):
    def http_open(self, req):
        return self.do_open(PinnedHTTPConnection, req)


class _SSRFSafeHTTPSHandler(HTTPSHandler):
    def https_open(self, req):
        return self.do_open(PinnedHTTPSConnection, req, context=self._context)


def build_ssrf_safe_opener():
    """Build a urllib opener whose connections are pinned to the validated IP."""
    return build_opener(_SSRFSafeHTTPHandler, _SSRFSafeHTTPSHandler, _SSRFSafeRedirectHandler)


# ── httpx: transport that pins to the validated IP ────────────────────────────

def make_ssrf_safe_async_transport(**kwargs):
    """Build an ``httpx.AsyncHTTPTransport`` that pins each request's connection
    to a pre-validated IP (via the ``sni_hostname``/``Host`` header trick) so the
    TLS handshake and hostname-based routing still target the original host."""
    import httpx

    class _SSRFSafeAsyncTransport(httpx.AsyncHTTPTransport):
        async def handle_async_request(self, request: "httpx.Request") -> "httpx.Response":
            validate_public_url(str(request.url))
            host = request.url.host
            port = request.url.port or (443 if request.url.scheme == "https" else 80)
            ip = resolve_validated_ip(host, port)
            if ip is not None:
                request.headers.setdefault("Host", host)
                request.extensions["sni_hostname"] = host
                request.url = request.url.copy_with(host=ip)
            return await super().handle_async_request(request)

    return _SSRFSafeAsyncTransport(**kwargs)
