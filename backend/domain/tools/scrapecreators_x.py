from __future__ import annotations

import asyncio
import json
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib import error, parse, request

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit

try:
    import requests as _requests
except ImportError:
    _requests = None

SCRAPECREATORS_BASE = "https://api.scrapecreators.com/v1/twitter"

DEPTH_CONFIG = {
    "quick": {"results_per_page": 10},
    "default": {"results_per_page": 20},
    "deep": {"results_per_page": 40},
}


class ScrapeCreatorsXAPIError(RuntimeError):
    pass


def _sc_headers(token: str) -> Dict[str, str]:
    return {
        "x-api-key": token,
        "Content-Type": "application/json",
        "User-Agent": "ai-collective/scrapecreators-x-tool",
    }


def _extract_core_subject(topic: str) -> str:
    text = (topic or "").lower().strip()
    if not text:
        return ""

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
        "prompt",
        "prompts",
        "prompting",
        "methods",
        "strategies",
        "approaches",
    }

    words = [w for w in text.split() if w not in noise]
    return " ".join(words) if words else text


def _tokenize(text: str) -> set[str]:
    return {w for w in re.sub(r"[^\w\s]", " ", (text or "").lower()).split() if len(w) > 1}


def _compute_relevance(topic: str, text: str) -> float:
    q = _tokenize(topic)
    t = _tokenize(text)

    if not q:
        return 0.5

    overlap = len(q & t)
    score = overlap / len(q)
    return round(min(1.0, max(0.0, score)), 2)


def _parse_date(item: Dict[str, Any]) -> Optional[str]:
    created_at = item.get("created_at")
    if created_at and isinstance(created_at, str):
        try:
            dt = datetime.strptime(created_at, "%a %b %d %H:%M:%S %z %Y")
            return dt.strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            pass

    ts = item.get("timestamp") or item.get("created_at_timestamp")
    if ts:
        try:
            dt = datetime.fromtimestamp(int(ts), tz=timezone.utc)
            return dt.strftime("%Y-%m-%d")
        except (ValueError, TypeError, OSError):
            pass

    for key in ("created_at", "date"):
        val = item.get(key)
        if val and isinstance(val, str):
            try:
                dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
                return dt.strftime("%Y-%m-%d")
            except (ValueError, TypeError):
                pass

    return None


def _request_json(
    url: str,
    *,
    token: str,
    params: Optional[Dict[str, Any]] = None,
    timeout: int = 30,
) -> Dict[str, Any]:
    if _requests is not None:
        try:
            resp = _requests.get(url, params=params, headers=_sc_headers(token), timeout=timeout)
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            raise ScrapeCreatorsXAPIError(str(exc)) from exc

    query = parse.urlencode(params or {})
    req_url = f"{url}?{query}" if query else url
    req = request.Request(url=req_url, method="GET", headers=_sc_headers(token))
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except error.HTTPError as exc:
        message = f"ScrapeCreators X API failed: HTTP {exc.code}"
        try:
            body = exc.read().decode("utf-8", errors="replace")
            if body:
                message = f"{message}: {body[:200]}"
        except Exception:
            pass
        raise ScrapeCreatorsXAPIError(message) from exc
    except (error.URLError, TimeoutError, ValueError) as exc:
        raise ScrapeCreatorsXAPIError(str(exc)) from exc


def search_x(
    topic: str,
    from_date: str,
    to_date: str,
    *,
    token: str,
    depth: str = "default",
) -> Dict[str, Any]:
    config = DEPTH_CONFIG.get(depth, DEPTH_CONFIG["default"])
    core_topic = _extract_core_subject(topic)

    data = _request_json(
        f"{SCRAPECREATORS_BASE}/search/tweets",
        token=token,
        params={"query": core_topic, "sort_by": "relevance"},
        timeout=30,
    )

    raw_items = data.get("tweets") or data.get("data") or data.get("results") or []
    raw_items = raw_items[: config["results_per_page"]]

    items: List[Dict[str, Any]] = []
    for i, raw in enumerate(raw_items):
        if not isinstance(raw, dict):
            continue

        tweet_id = str(raw.get("id") or raw.get("tweet_id") or raw.get("id_str") or f"sc-x-{i}")
        text = str(raw.get("full_text") or raw.get("text") or "")

        user = raw.get("user") or raw.get("author") or {}
        if not isinstance(user, dict):
            user = {}
        author_handle = str(user.get("screen_name") or user.get("username") or "")

        likes = int(raw.get("favorite_count") or raw.get("likes") or 0)
        retweets = int(raw.get("retweet_count") or raw.get("retweets") or 0)
        replies = int(raw.get("reply_count") or raw.get("replies") or 0)
        quotes = int(raw.get("quote_count") or raw.get("quotes") or 0)

        date_str = _parse_date(raw)
        relevance = _compute_relevance(core_topic, text)

        url = ""
        if author_handle and tweet_id and not tweet_id.startswith("sc-x-"):
            url = f"https://x.com/{author_handle}/status/{tweet_id}"

        items.append(
            {
                "id": tweet_id,
                "text": text,
                "url": url,
                "author_handle": author_handle,
                "date": date_str,
                "engagement": {
                    "likes": likes,
                    "reposts": retweets,
                    "replies": replies,
                    "quotes": quotes,
                },
                "relevance": relevance,
                "why_relevant": f"X(SC): @{author_handle}: {text[:60]}" if text else f"X(SC): {core_topic}",
            }
        )

    in_range = [i for i in items if i.get("date") and from_date <= i["date"] <= to_date]
    if in_range:
        items = in_range

    items.sort(
        key=lambda x: (x["engagement"]["likes"] + x["engagement"]["reposts"]),
        reverse=True,
    )

    return {"items": items}


def parse_x_response(response: Dict[str, Any]) -> List[Dict[str, Any]]:
    items = response.get("items", [])
    return items if isinstance(items, list) else []


class ScrapeCreatorsXToolkit(BaseToolkit):
    """X/Twitter search toolkit via ScrapeCreators API."""

    name: str = "scrapecreators_x"

    def __init__(self, token: Optional[str] = None, **kwargs: Any):
        super().__init__(**kwargs)
        self.token = token or os.getenv("SCRAPECREATORS_API_KEY", "")

    @tool(parse_docstring=True)
    async def scrapecreators_x_search(
        self,
        topic: str,
        from_date: str,
        to_date: str,
        depth: str = "default",
        token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Search X (Twitter) posts via ScrapeCreators and return normalized items.

        Args:
            topic: Search query in natural language.
            from_date: Start date in YYYY-MM-DD format.
            to_date: End date in YYYY-MM-DD format.
            depth: Search depth, one of quick, default, deep.
            token: Optional ScrapeCreators API key override.
        """
        selected_token = (token or self.token or "").strip()
        if not selected_token:
            raise ValueError(
                "Missing ScrapeCreators API key. Set SCRAPECREATORS_API_KEY or pass token in tool config."
            )

        raw = await asyncio.to_thread(
            search_x,
            topic,
            from_date,
            to_date,
            token=selected_token,
            depth=depth,
        )
        return {"items": parse_x_response(raw)}