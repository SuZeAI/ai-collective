from __future__ import annotations

import asyncio
import json
import math
import re
from typing import Any, Dict, List, Optional
from urllib import error, parse, request

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit
from backend.api.settings import settings

TRUTHSOCIAL_SEARCH_URL = "https://truthsocial.com/api/v2/search"

DEPTH_CONFIG = {
    "quick": 15,
    "default": 30,
    "deep": 60,
}


class TruthSocialAPIError(RuntimeError):
    pass


def _request_json(url: str, *, token: str, timeout: int = 30) -> Dict[str, Any]:
    req = request.Request(
        url=url,
        method="GET",
        headers={
            "Authorization": f"Bearer {token}",
            "User-Staff": "ai-collective/truthsocial-tool",
        },
    )

    try:
        with request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except error.HTTPError as exc:
        if exc.code == 401:
            raise TruthSocialAPIError("Truth Social token expired") from exc
        if exc.code == 403:
            raise TruthSocialAPIError("Truth Social access denied (Cloudflare)") from exc
        if exc.code == 429:
            raise TruthSocialAPIError("Truth Social rate limited") from exc

        message = f"Truth Social search failed: HTTP {exc.code}"
        try:
            body = exc.read().decode("utf-8", errors="replace")
            if body:
                message = f"{message}: {body[:200]}"
        except Exception:
            pass
        raise TruthSocialAPIError(message) from exc
    except (error.URLError, TimeoutError, ValueError) as exc:
        raise TruthSocialAPIError(str(exc)) from exc


def _strip_html(html: str) -> str:
    text = re.sub(r"<br\\s*/?>", "\n", html)
    text = re.sub(r"<[^>]+>", "", text)
    return text.strip()


def _extract_core_subject(topic: str) -> str:
    text = topic.lower().strip()
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
    words = text.split()
    filtered = [w for w in words if w not in noise]
    result = " ".join(filtered) if filtered else text
    return result.rstrip("?!.")


def _parse_date(status: Dict[str, Any]) -> Optional[str]:
    val = status.get("created_at")
    if val and isinstance(val, str) and len(val) >= 10:
        return val[:10]
    return None


def search_truthsocial(
    topic: str,
    from_date: str,
    to_date: str,
    *,
    token: str,
    depth: str = "default",
) -> Dict[str, Any]:
    del from_date, to_date

    count = DEPTH_CONFIG.get(depth, DEPTH_CONFIG["default"])
    core_topic = _extract_core_subject(topic)

    params = {
        "q": core_topic,
        "type": "statuses",
        "limit": str(min(count, 40)),
    }
    url = f"{TRUTHSOCIAL_SEARCH_URL}?{parse.urlencode(params)}"
    return _request_json(url, token=token)


def parse_truthsocial_response(response: Dict[str, Any]) -> List[Dict[str, Any]]:
    statuses = response.get("statuses", [])
    if not isinstance(statuses, list):
        return []

    items: List[Dict[str, Any]] = []
    for i, status in enumerate(statuses):
        if not isinstance(status, dict):
            continue

        content_html = status.get("content") or ""
        text = _strip_html(str(content_html))

        account = status.get("account") or {}
        if not isinstance(account, dict):
            account = {}

        handle = str(account.get("acct") or account.get("username") or "").strip()
        display_name = str(account.get("display_name") or handle).strip()

        url = str(status.get("url") or "").strip()

        likes = int(status.get("favourites_count") or 0)
        reposts = int(status.get("reblogs_count") or 0)
        replies = int(status.get("replies_count") or 0)

        date_str = _parse_date(status)

        rank_score = max(0.3, 1.0 - (i * 0.02))
        engagement_boost = min(0.2, math.log1p(likes + reposts) / 40)
        relevance = min(1.0, rank_score * 0.7 + engagement_boost + 0.1)

        # Endpoint already returns ranked search results; apply a mild engagement boost.
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
                },
                "relevance": round(relevance, 2),
                "why_relevant": (
                    f"Truth Social: @{handle}: {text[:60]}"
                    if text
                    else f"Truth Social: {handle}"
                ),
            }
        )

    return items


class TruthSocialToolkit(BaseToolkit):
    """Truth Social search toolkit via Mastodon-compatible API."""

    name: str = "truthsocial"

    def __init__(self, token: Optional[str] = None, **kwargs: Any):
        super().__init__(**kwargs)
        self.token = token or settings.tools.truthsocial_token

    @tool(parse_docstring=True)
    async def truthsocial_search(
        self,
        topic: str,
        from_date: str,
        to_date: str,
        depth: str = "default",
        token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Search Truth Social posts by topic and return normalized items.

        Args:
            topic: Search query in natural language.
            from_date: Start date in YYYY-MM-DD format.
            to_date: End date in YYYY-MM-DD format.
            depth: Search depth, one of quick, default, deep.
            token: Optional bearer token override.
        """
        selected_token = (token or self.token or "").strip()
        if not selected_token:
            raise ValueError("Missing Truth Social token. Set TRUTHSOCIAL_TOKEN or pass token in tool config.")

        raw = await asyncio.to_thread(
            search_truthsocial,
            topic,
            from_date,
            to_date,
            token=selected_token,
            depth=depth,
        )
        return {"items": parse_truthsocial_response(raw)}