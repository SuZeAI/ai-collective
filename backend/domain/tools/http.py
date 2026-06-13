from __future__ import annotations

import asyncio
import json
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Dict, Optional
from urllib.parse import urlencode

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit
from backend.domain.tools._ssrf import BlockedURLError, validate_public_url
from backend.api.settings import settings


class _SSRFSafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Re-validate the target of every redirect to prevent redirect-based SSRF."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[override]
        validate_public_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_SSRF_SAFE_OPENER = urllib.request.build_opener(_SSRFSafeRedirectHandler())

DEFAULT_TIMEOUT = 30
DEBUG = settings.tools.last30days_debug
MAX_RETRIES = 5
RETRY_DELAY = 2.0
USER_AGENT = "ai-collective/http-tool"


def log(msg: str) -> None:
    if DEBUG:
        sys.stderr.write(f"[DEBUG] {msg}\n")
        sys.stderr.flush()


class HTTPError(Exception):
    """HTTP request error with optional status code and response body."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        body: Optional[str] = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.body = body


def _coerce_positive_int(value: Any, *, default: int, field_name: str) -> int:
    """Convert runtime values (including numeric strings) into positive integers."""

    if value is None:
        return default

    if isinstance(value, bool):
        raise HTTPError(f"Invalid {field_name}: {value!r}; expected a positive integer")

    if isinstance(value, str):
        value = value.strip()
        if not value:
            return default

    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise HTTPError(f"Invalid {field_name}: {value!r}; expected a positive integer") from exc

    if parsed <= 0:
        raise HTTPError(f"Invalid {field_name}: {parsed}; expected a positive integer")

    return parsed


def _looks_like_json(content_type: Optional[str], body: str) -> bool:
    """Best-effort check to decide whether response body should be JSON-decoded."""

    normalized_content_type = (content_type or "").lower()
    if "application/json" in normalized_content_type or "+json" in normalized_content_type:
        return True

    stripped = body.lstrip()
    if not stripped:
        return True

    return stripped[0] in ("{", "[")


def request(
    method: str,
    url: str,
    *,
    headers: Optional[Dict[str, str]] = None,
    json_data: Optional[Dict[str, Any]] = None,
    data: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
    timeout: int = DEFAULT_TIMEOUT,
    retries: int = MAX_RETRIES,
    raw: bool = False,
) -> Any:
    """Make an HTTP request and return parsed JSON or raw text."""

    timeout = _coerce_positive_int(timeout, default=DEFAULT_TIMEOUT, field_name="timeout")
    retries = _coerce_positive_int(retries, default=MAX_RETRIES, field_name="retries")

    request_headers = dict(headers or {})
    request_headers.setdefault("User-Agent", USER_AGENT)

    encoded_params = urlencode({k: v for k, v in (params or {}).items() if v is not None}, doseq=True)
    request_url = f"{url}?{encoded_params}" if encoded_params else url

    # SSRF guard: reject internal/metadata targets before issuing the request.
    validate_public_url(request_url)

    body_bytes = None
    if json_data is not None:
        body_bytes = json.dumps(json_data).encode("utf-8")
        request_headers.setdefault("Content-Type", "application/json")
    elif data is not None:
        body_bytes = data.encode("utf-8")

    req = urllib.request.Request(
        request_url,
        data=body_bytes,
        headers=request_headers,
        method=method.upper(),
    )

    log(f"{method.upper()} {request_url}")

    last_error: Optional[HTTPError] = None
    for attempt in range(retries):
        try:
            with _SSRF_SAFE_OPENER.open(req, timeout=timeout) as response:
                body = response.read().decode("utf-8")
                content_type = response.headers.get("Content-Type") if response.headers else None
                log(f"Response: {response.status} ({len(body)} bytes)")
                if raw:
                    return body
                if _looks_like_json(content_type, body):
                    return json.loads(body) if body else {}
                return body
        except urllib.error.HTTPError as exc:
            body = None
            try:
                body = exc.read().decode("utf-8")
            except Exception:
                pass

            log(f"HTTP Error {exc.code}: {exc.reason}")
            last_error = HTTPError(f"HTTP {exc.code}: {exc.reason}", exc.code, body)

            if 400 <= exc.code < 500 and exc.code != 429:
                raise last_error

            if attempt < retries - 1:
                if exc.code == 429:
                    retry_after = exc.headers.get("Retry-After") if hasattr(exc, "headers") else None
                    if retry_after:
                        try:
                            delay = float(retry_after)
                        except ValueError:
                            delay = RETRY_DELAY * (2 ** attempt) + 1
                    else:
                        delay = RETRY_DELAY * (2 ** attempt) + 1
                else:
                    delay = RETRY_DELAY * (2 ** attempt)
                time.sleep(delay)
        except urllib.error.URLError as exc:
            log(f"URL Error: {exc.reason}")
            last_error = HTTPError(f"URL Error: {exc.reason}")
            if attempt < retries - 1:
                time.sleep(RETRY_DELAY * (attempt + 1))
        except json.JSONDecodeError as exc:
            log(f"JSON decode error: {exc}")
            raise HTTPError(f"Invalid JSON response: {exc}") from exc
        except (OSError, TimeoutError, ConnectionResetError) as exc:
            log(f"Connection error: {type(exc).__name__}: {exc}")
            last_error = HTTPError(f"Connection error: {type(exc).__name__}: {exc}")
            if attempt < retries - 1:
                time.sleep(RETRY_DELAY * (attempt + 1))

    if last_error is not None:
        raise last_error
    raise HTTPError("Request failed with no error details")


def get(url: str, *, headers: Optional[Dict[str, str]] = None, **kwargs: Any) -> Any:
    return request("GET", url, headers=headers, **kwargs)


def post(
    url: str,
    json_data: Dict[str, Any],
    *,
    headers: Optional[Dict[str, str]] = None,
    **kwargs: Any,
) -> Any:
    return request("POST", url, headers=headers, json_data=json_data, **kwargs)


def post_raw(
    url: str,
    json_data: Dict[str, Any],
    *,
    headers: Optional[Dict[str, str]] = None,
    **kwargs: Any,
) -> str:
    return request("POST", url, headers=headers, json_data=json_data, raw=True, **kwargs)


def get_reddit_json(
    path: str,
    *,
    timeout: int = DEFAULT_TIMEOUT,
    retries: int = MAX_RETRIES,
) -> Dict[str, Any]:
    if not path.startswith("/"):
        path = "/" + path

    path = path.rstrip("/")
    if not path.endswith(".json"):
        path = path + ".json"

    url = f"https://www.reddit.com{path}?raw_json=1"
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    }
    return get(url, headers=headers, timeout=timeout, retries=retries)


class HTTPToolkit(BaseToolkit):
    """Generic HTTP utilities for GET/POST JSON requests."""

    name: str = "http"

    def __init__(
        self,
        timeout: int = DEFAULT_TIMEOUT,
        retries: int = MAX_RETRIES,
        user_agent: str = USER_AGENT,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.timeout = timeout
        self.retries = retries
        self.user_agent = user_agent or USER_AGENT

    def _merged_headers(self, headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        merged = dict(headers or {})
        merged.setdefault("User-Agent", self.user_agent)
        return merged

    @tool(parse_docstring=True)
    async def http_request(
        self,
        method: str,
        url: str,
        headers: Optional[Dict[str, str]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        data: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
        timeout: Optional[int] = None,
        retries: Optional[int] = None,
        raw: bool = False,
    ) -> Any:
        """Make an HTTP request and return parsed JSON or raw text.

        Args:
            method: HTTP method such as GET, POST, PUT, PATCH, or DELETE.
            url: Absolute request URL.
            headers: Optional request headers.
            json_data: Optional JSON body to send.
            data: Optional plain text request body.
            params: Optional query string parameters.
            timeout: Optional timeout in seconds.
            retries: Optional retry count.
            raw: Return raw text instead of parsing JSON.
        """
        return await asyncio.to_thread(
            request,
            method=method,
            url=url,
            headers=self._merged_headers(headers),
            json_data=json_data,
            data=data,
            params=params,
            timeout=timeout or self.timeout,
            retries=retries if retries is not None else self.retries,
            raw=raw,
        )

    @tool(parse_docstring=True)
    async def http_get(
        self,
        url: str,
        headers: Optional[Dict[str, str]] = None,
        params: Optional[Dict[str, Any]] = None,
        timeout: Optional[int] = None,
        retries: Optional[int] = None,
        raw: bool = False,
    ) -> Any:
        """Make an HTTP GET request.

        Args:
            url: Absolute request URL.
            headers: Optional request headers.
            params: Optional query string parameters.
            timeout: Optional timeout in seconds.
            retries: Optional retry count.
            raw: Return raw text instead of parsing JSON.
        """
        return await asyncio.to_thread(
            get,
            url=url,
            headers=self._merged_headers(headers),
            params=params,
            timeout=timeout or self.timeout,
            retries=retries if retries is not None else self.retries,
            raw=raw,
        )

    @tool(parse_docstring=True)
    async def http_post_json(
        self,
        url: str,
        json_data: Dict[str, Any],
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[int] = None,
        retries: Optional[int] = None,
        raw: bool = False,
    ) -> Any:
        """Make an HTTP POST request with a JSON body.

        Args:
            url: Absolute request URL.
            json_data: JSON-serializable request body.
            headers: Optional request headers.
            timeout: Optional timeout in seconds.
            retries: Optional retry count.
            raw: Return raw text instead of parsing JSON.
        """
        fn = post_raw if raw else post
        return await asyncio.to_thread(
            fn,
            url=url,
            json_data=json_data,
            headers=self._merged_headers(headers),
            timeout=timeout or self.timeout,
            retries=retries if retries is not None else self.retries,
        )

    @tool(parse_docstring=True)
    async def http_get_reddit_json(
        self,
        path: str,
        timeout: Optional[int] = None,
        retries: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Fetch Reddit thread JSON from a Reddit path.

        Args:
            path: Reddit path like /r/subreddit/comments/id/title.
            timeout: Optional timeout in seconds.
            retries: Optional retry count.
        """
        return await asyncio.to_thread(
            get_reddit_json,
            path=path,
            timeout=timeout or self.timeout,
            retries=retries if retries is not None else self.retries,
        )
