"""Shared JSON-over-HTTP transport for the messaging toolkits.

Every ``*_messaging`` toolkit previously carried a near-identical ``_xxx_request``
helper (build URL → json-encode → urlopen → the same HTTPError/URLError handling).
This module centralizes that transport so timeouts, error formatting and (future)
connection pooling live in one place.

Error messages intentionally match the previous per-toolkit format:
    "{service} API error {code}: {body[:300]}"   on HTTP error responses
    "{service} request failed: {exc}"             on connection/timeout errors
"""

from __future__ import annotations

import json
from typing import Any, Dict, Optional
from urllib import error, request

DEFAULT_TIMEOUT = 30


def request_json(
    method: str,
    url: str,
    *,
    service: str,
    json_body: Optional[Dict[str, Any]] = None,
    raw_body: Optional[bytes] = None,
    headers: Optional[Dict[str, str]] = None,
    timeout: int = DEFAULT_TIMEOUT,
) -> Dict[str, Any]:
    """Issue an HTTP request and return the parsed JSON response (or ``{}``).

    Provide ``json_body`` for a JSON payload, or ``raw_body`` for a pre-encoded
    body (e.g. form-encoded). ``service`` is used only to format error messages.
    """
    final_headers: Dict[str, str] = dict(headers or {})
    data: Optional[bytes]
    if json_body is not None:
        data = json.dumps(json_body).encode("utf-8")
        final_headers.setdefault("Content-Type", "application/json")
    else:
        data = raw_body

    req = request.Request(url=url, method=method.upper(), data=data, headers=final_headers)
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body.strip() else {}
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{service} API error {exc.code}: {body[:300]}") from exc
    except (error.URLError, TimeoutError) as exc:
        raise RuntimeError(f"{service} request failed: {exc}") from exc
