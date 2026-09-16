from __future__ import annotations

import asyncio
import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib import error, parse, request

from langchain.tools import tool

from server.domain.tools.base import BaseToolkit

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

HANDLE_REGEX = re.compile(r"(?:from:)?@?([A-Za-z0-9_]{1,15})")


class ScrapeCreatorsXAPIError(RuntimeError):
    pass


def _sc_headers(token: str) -> Dict[str, str]:
    return {
        "x-api-key": token,
        "Content-Type": "application/json",
        "User-Staff": "ai-collective/scrapecreators-x-tool",
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


def _call_sc_x_endpoint(
    endpoint: str,
    *,
    token: str,
    params: Optional[Dict[str, Any]] = None,
    timeout: int = 30,
) -> Dict[str, Any]:
    return _request_json(
        f"{SCRAPECREATORS_BASE}/{endpoint}",
        token=token,
        params=params,
        timeout=timeout,
    )


def _extract_handle(topic: str) -> str:
    text = (topic or "").strip()
    if not text:
        return ""

    # Prefer an explicit @handle/from:handle marker when present.
    explicit = re.search(r"(?:from:|@)([A-Za-z0-9_]{1,15})", text, flags=re.IGNORECASE)
    if explicit:
        return explicit.group(1)

    match = HANDLE_REGEX.search(text)
    return match.group(1) if match else ""


def _extract_tweet_id(text: str) -> str:
    if not text:
        return ""
    m = re.search(r"status/(\d+)", text)
    if m:
        return m.group(1)
    m = re.search(r"\b(\d{8,})\b", text)
    return m.group(1) if m else ""


def _to_int(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


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

    handle = _extract_handle(topic)
    if not handle:
        raise ValueError(
            "ScrapeCreators does not provide a general Twitter search endpoint in this integration. "
            "Use an explicit handle in topic, e.g. '@openai AI updates' or 'from:openai'."
        )

    data: Dict[str, Any] = {}
    last_error: Optional[Exception] = None

    # ScrapeCreators docs show /user-tweets, while parameter naming can vary by backend version.
    for params in (
        {"username": handle},
        {"screen_name": handle},
        {"handle": handle},
        {"user": handle},
    ):
        try:
            data = _call_sc_x_endpoint("user-tweets", token=token, params=params, timeout=30)
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            continue

        raw_items = data.get("tweets") or data.get("data") or data.get("results") or []
        if isinstance(raw_items, list) and raw_items:
            break

    if not data and last_error is not None:
        raise ScrapeCreatorsXAPIError(str(last_error)) from last_error

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

        likes = _to_int(raw.get("favorite_count") or raw.get("likes"))
        retweets = _to_int(raw.get("retweet_count") or raw.get("retweets"))
        replies = _to_int(raw.get("reply_count") or raw.get("replies"))
        quotes = _to_int(raw.get("quote_count") or raw.get("quotes"))

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
        self.token = token

    def _require_token(self, token: Optional[str]) -> str:
        selected_token = (token or self.token or "").strip()
        if not selected_token:
            raise ValueError("Missing ScrapeCreators API key. Configure token in tool config.")
        return selected_token

    @tool(parse_docstring=True)
    async def scrapecreators_x_profile(
        self,
        username: str,
        token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get Twitter profile information from ScrapeCreators.

        Args:
            username: X handle without @.
            token: Optional ScrapeCreators API key override.
        """
        selected_token = self._require_token(token)
        return await asyncio.to_thread(
            _call_sc_x_endpoint,
            "profile",
            token=selected_token,
            params={"username": username.lstrip("@")},
            timeout=30,
        )

    @tool(parse_docstring=True)
    async def scrapecreators_x_user_tweets(
        self,
        username: str,
        depth: str = "default",
        token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get tweets from a specific user profile via ScrapeCreators.

        Args:
            username: X handle without @.
            depth: Number of results to keep, one of quick, default, deep.
            token: Optional ScrapeCreators API key override.
        """
        selected_token = self._require_token(token)
        data = await asyncio.to_thread(
            _call_sc_x_endpoint,
            "user-tweets",
            token=selected_token,
            params={"username": username.lstrip("@")},
            timeout=30,
        )
        limit = DEPTH_CONFIG.get(depth, DEPTH_CONFIG["default"])["results_per_page"]
        tweets = data.get("tweets") or data.get("data") or data.get("results") or []
        if isinstance(tweets, list):
            data["tweets"] = tweets[:limit]
        return data

    @tool(parse_docstring=True)
    async def scrapecreators_x_tweet(
        self,
        tweet_id_or_url: str,
        token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get detailed information for a single tweet.

        Args:
            tweet_id_or_url: Tweet numeric ID or a full tweet URL.
            token: Optional ScrapeCreators API key override.
        """
        selected_token = self._require_token(token)
        tweet_id = _extract_tweet_id(tweet_id_or_url)
        params = {"tweet_id": tweet_id} if tweet_id else {"url": tweet_id_or_url}
        return await asyncio.to_thread(
            _call_sc_x_endpoint,
            "tweet",
            token=selected_token,
            params=params,
            timeout=30,
        )

    @tool(parse_docstring=True)
    async def scrapecreators_x_tweet_transcript(
        self,
        tweet_id_or_url: str,
        token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get transcript for a video tweet.

        Args:
            tweet_id_or_url: Tweet numeric ID or a full tweet URL.
            token: Optional ScrapeCreators API key override.
        """
        selected_token = self._require_token(token)
        tweet_id = _extract_tweet_id(tweet_id_or_url)
        params = {"tweet_id": tweet_id} if tweet_id else {"url": tweet_id_or_url}
        return await asyncio.to_thread(
            _call_sc_x_endpoint,
            "tweet/transcript",
            token=selected_token,
            params=params,
            timeout=60,
        )

    @tool(parse_docstring=True)
    async def scrapecreators_x_community(
        self,
        community_id: str,
        token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get details for an X community.

        Args:
            community_id: X community identifier.
            token: Optional ScrapeCreators API key override.
        """
        selected_token = self._require_token(token)
        return await asyncio.to_thread(
            _call_sc_x_endpoint,
            "community",
            token=selected_token,
            params={"community_id": community_id},
            timeout=30,
        )

    @tool(parse_docstring=True)
    async def scrapecreators_x_community_tweets(
        self,
        community_id: str,
        depth: str = "default",
        token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get tweets from an X community.

        Args:
            community_id: X community identifier.
            depth: Number of results to keep, one of quick, default, deep.
            token: Optional ScrapeCreators API key override.
        """
        selected_token = self._require_token(token)
        data = await asyncio.to_thread(
            _call_sc_x_endpoint,
            "community/tweets",
            token=selected_token,
            params={"community_id": community_id},
            timeout=30,
        )
        limit = DEPTH_CONFIG.get(depth, DEPTH_CONFIG["default"])["results_per_page"]
        tweets = data.get("tweets") or data.get("data") or data.get("results") or []
        if isinstance(tweets, list):
            data["tweets"] = tweets[:limit]
        return data

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
            topic: Include an explicit X handle, e.g. '@openai AI updates' or 'from:openai'.
            from_date: Start date in YYYY-MM-DD format.
            to_date: End date in YYYY-MM-DD format.
            depth: Search depth, one of quick, default, deep.
            token: Optional ScrapeCreators API key override.
        """
        selected_token = self._require_token(token)

        raw = await asyncio.to_thread(
            search_x,
            topic,
            from_date,
            to_date,
            token=selected_token,
            depth=depth,
        )
        return {"items": parse_x_response(raw)}
