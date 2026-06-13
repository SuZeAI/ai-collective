from __future__ import annotations

import asyncio
import json
import math
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib import error, parse, request

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit
from backend.api.settings import settings

BSKY_SESSION_URL = "https://bsky.social/xrpc/com.atproto.server.createSession"
BSKY_SEARCH_URL = "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts"

DEPTH_CONFIG = {
    "quick": 15,
    "default": 30,
    "deep": 60,
}

_cached_token: Optional[str] = None
_cached_handle: Optional[str] = None
_session_error: Optional[str] = None


class BlueskyAPIError(RuntimeError):
    pass


def _request_json(
    method: str,
    url: str,
    *,
    headers: Optional[Dict[str, str]] = None,
    json_data: Optional[Dict[str, Any]] = None,
    timeout: int = 30,
) -> Dict[str, Any]:
    req_headers = dict(headers or {})
    payload = None
    if json_data is not None:
        payload = json.dumps(json_data).encode("utf-8")
        req_headers.setdefault("Content-Type", "application/json")

    req = request.Request(url=url, method=method, data=payload, headers=req_headers)

    try:
        with request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except error.HTTPError as exc:
        body_text = ""
        try:
            body_text = exc.read().decode("utf-8", errors="replace")
        except Exception:
            body_text = ""

        message = f"HTTP {exc.code}"
        if body_text:
            message = f"{message}: {body_text[:300]}"
        raise BlueskyAPIError(message) from exc
    except (error.URLError, TimeoutError, ValueError) as exc:
        raise BlueskyAPIError(str(exc)) from exc


def _extract_core_subject(topic: str) -> str:
    text = (topic or "").lower().strip().rstrip("?!.")
    if not text:
        return ""

    prefixes = [
        "what are the best",
        "what is the best",
        "what are the latest",
        "what are people saying about",
        "what do people think about",
        "how do i use",
        "how to use",
        "how to",
        "what are",
        "what is",
        "tips for",
        "best practices for",
    ]
    for prefix in prefixes:
        if text.startswith(prefix + " "):
            text = text[len(prefix):].strip()

    noise = {
        "best",
        "top",
        "good",
        "great",
        "awesome",
        "latest",
        "new",
        "news",
        "update",
        "updates",
        "trending",
        "hottest",
        "popular",
        "viral",
        "practices",
        "features",
        "recommendations",
        "advice",
    }
    words = [w for w in text.split() if w not in noise]
    return " ".join(words) if words else text


def _parse_date(item: Dict[str, Any]) -> Optional[str]:
    for key in ("indexedAt", "createdAt"):
        val = item.get(key)
        if val and isinstance(val, str):
            try:
                dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
                return dt.strftime("%Y-%m-%d")
            except (ValueError, TypeError):
                continue
    return None


def _create_session(handle: str, app_password: str) -> Optional[str]:
    global _cached_token, _cached_handle, _session_error

    if _cached_token and _cached_handle == handle:
        return _cached_token

    _cached_token = None
    _cached_handle = None

    try:
        response = _request_json(
            "POST",
            BSKY_SESSION_URL,
            json_data={"identifier": handle, "password": app_password},
            timeout=15,
        )
    except BlueskyAPIError as exc:
        msg = str(exc).lower()
        if "http 403" in msg and "cloudflare" in msg:
            _session_error = (
                "Cloudflare blocked the request (403 Forbidden). "
                "Try a different network or VPN."
            )
        elif "http 401" in msg:
            _session_error = (
                "Invalid Bluesky credentials (401 Unauthorized). "
                "Check BSKY_HANDLE and BSKY_APP_PASSWORD."
            )
        else:
            _session_error = f"Session request failed: {exc}"
        return None

    token = str(response.get("accessJwt") or "").strip()
    if not token:
        _session_error = "No accessJwt in session response"
        return None

    _cached_token = token
    _cached_handle = handle
    _session_error = None
    return token


def search_bluesky(
    topic: str,
    from_date: str,
    to_date: str,
    *,
    handle: str,
    app_password: str,
    depth: str = "default",
) -> Dict[str, Any]:
    del from_date, to_date

    token = _create_session(handle, app_password)
    if not token:
        return {
            "posts": [],
            "error": _session_error or "Bluesky session creation failed",
        }

    count = DEPTH_CONFIG.get(depth, DEPTH_CONFIG["default"])
    core_topic = _extract_core_subject(topic)
    params = {
        "q": core_topic,
        "limit": str(min(count, 100)),
        "sort": "top",
    }
    url = f"{BSKY_SEARCH_URL}?{parse.urlencode(params)}"

    try:
        return _request_json(
            "GET",
            url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
    except BlueskyAPIError as exc:
        msg = str(exc).lower()
        if "http 403" in msg and "cloudflare" in msg:
            return {
                "posts": [],
                "error": "Bluesky search blocked by Cloudflare (403). Try a different network or VPN.",
            }
        return {"posts": [], "error": f"Bluesky search failed: {exc}"}


def parse_bluesky_response(response: Dict[str, Any]) -> List[Dict[str, Any]]:
    posts = response.get("posts", [])
    if not isinstance(posts, list):
        return []

    items: List[Dict[str, Any]] = []
    for i, post in enumerate(posts):
        if not isinstance(post, dict):
            continue

        record = post.get("record") or {}
        if not isinstance(record, dict):
            record = {}

        text = str(record.get("text") or "")

        author = post.get("author") or {}
        if not isinstance(author, dict):
            author = {}
        handle = str(author.get("handle") or "")
        display_name = str(author.get("displayName") or handle)

        uri = str(post.get("uri") or "")
        rkey = uri.rsplit("/", 1)[-1] if uri else ""
        url = f"https://bsky.app/profile/{handle}/post/{rkey}" if handle and rkey else ""

        likes = int(post.get("likeCount") or 0)
        reposts = int(post.get("repostCount") or 0)
        replies = int(post.get("replyCount") or 0)
        quotes = int(post.get("quoteCount") or 0)

        date_str = _parse_date(post) or _parse_date(record)

        rank_score = max(0.3, 1.0 - (i * 0.02))
        engagement_boost = min(0.2, math.log1p(likes + reposts) / 40)
        relevance = min(1.0, rank_score * 0.7 + engagement_boost + 0.1)

        items.append(
            {
                "handle": handle,
                "display_name": display_name,
                "text": text,
                "url": url,
                "date": date_str,
                "engagement": {
                    "likes": likes,
                    "reposts": reposts,
                    "replies": replies,
                    "quotes": quotes,
                },
                "relevance": round(relevance, 2),
                "why_relevant": f"Bluesky: @{handle}: {text[:60]}" if text else f"Bluesky: {handle}",
            }
        )

    return items


def search_and_parse_bluesky(
    topic: str,
    from_date: str,
    to_date: str,
    *,
    handle: str,
    app_password: str,
    depth: str = "default",
) -> Dict[str, Any]:
    raw = search_bluesky(
        topic,
        from_date,
        to_date,
        handle=handle,
        app_password=app_password,
        depth=depth,
    )
    items = parse_bluesky_response(raw)

    in_range = [i for i in items if i.get("date") and from_date <= i["date"] <= to_date]
    if in_range:
        items = in_range

    result: Dict[str, Any] = {"items": items}
    if raw.get("error"):
        result["error"] = raw["error"]
    return result


class BlueskyToolkit(BaseToolkit):
    """Bluesky search toolkit via AT Protocol."""

    name: str = "bluesky"

    def __init__(
        self,
        handle: Optional[str] = None,
        app_password: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.handle = handle or settings.tools.bsky_handle
        self.app_password = app_password or settings.tools.bsky_app_password

    @tool(parse_docstring=True)
    async def bluesky_search(
        self,
        topic: str,
        from_date: str,
        to_date: str,
        depth: str = "default",
        handle: Optional[str] = None,
        app_password: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Search Bluesky posts by topic and return normalized items.

        Args:
            topic: Search query in natural language.
            from_date: Start date in YYYY-MM-DD format.
            to_date: End date in YYYY-MM-DD format.
            depth: Search depth, one of quick, default, deep.
            handle: Optional Bluesky handle override.
            app_password: Optional Bluesky app password override.
        """
        selected_handle = (handle or self.handle or "").strip()
        selected_app_password = (app_password or self.app_password or "").strip()

        if not selected_handle or not selected_app_password:
            raise ValueError(
                "Missing Bluesky credentials. Set BSKY_HANDLE and BSKY_APP_PASSWORD or pass handle/app_password in tool config."
            )

        return await asyncio.to_thread(
            search_and_parse_bluesky,
            topic,
            from_date,
            to_date,
            handle=selected_handle,
            app_password=selected_app_password,
            depth=depth,
        )