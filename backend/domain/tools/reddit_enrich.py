from __future__ import annotations

import asyncio
import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib import error, parse, request
from urllib.parse import urlparse

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit

try:
    import requests as _requests
except ImportError:
    _requests = None

SCRAPECREATORS_BASE = "https://api.scrapecreators.com/v1/reddit"


class RedditRateLimitError(RuntimeError):
    """Raised when reddit.com returns HTTP 429."""


def _timestamp_to_date(created_utc: Any) -> Optional[str]:
    if not created_utc:
        return None
    try:
        dt = datetime.fromtimestamp(float(created_utc), tz=timezone.utc)
        return dt.strftime("%Y-%m-%d")
    except (ValueError, TypeError, OSError):
        return None


def extract_reddit_path(url: str) -> Optional[str]:
    try:
        parsed = urlparse(url)
        if "reddit.com" not in parsed.netloc:
            return None
        return parsed.path
    except Exception:
        return None


def _fetch_reddit_json(path: str, timeout: int = 30, retries: int = 2) -> Optional[Dict[str, Any]]:
    clean_path = path if path.startswith("/") else f"/{path}"
    if not clean_path.endswith(".json"):
        clean_path = clean_path.rstrip("/") + "/.json"
    url = f"https://www.reddit.com{clean_path}"
    headers = {
        "User-Staff": "ai-collective/reddit-enrich",
    }

    for attempt in range(retries + 1):
        try:
            if _requests is not None:
                resp = _requests.get(url, headers=headers, timeout=timeout)
                if resp.status_code == 429:
                    raise RedditRateLimitError(f"Reddit rate limited (429) fetching {url}")
                resp.raise_for_status()
                return resp.json()

            req = request.Request(url=url, method="GET", headers=headers)
            with request.urlopen(req, timeout=timeout) as resp:
                body = resp.read().decode("utf-8")
                return json.loads(body) if body else None
        except RedditRateLimitError:
            raise
        except error.HTTPError as exc:
            if exc.code == 429:
                raise RedditRateLimitError(f"Reddit rate limited (429) fetching {url}") from exc
            if attempt >= retries:
                return None
        except Exception:
            if attempt >= retries:
                return None

    return None


def _sc_headers(token: str) -> Dict[str, str]:
    return {
        "x-api-key": token,
        "Content-Type": "application/json",
        "User-Staff": "ai-collective/reddit-enrich",
    }


def _fetch_post_comments_sc(url: str, token: str, timeout: int = 30) -> List[Dict[str, Any]]:
    endpoint = f"{SCRAPECREATORS_BASE}/post/comments"
    params = {"url": url}

    if _requests is not None:
        try:
            resp = _requests.get(endpoint, params=params, headers=_sc_headers(token), timeout=timeout)
            resp.raise_for_status()
            data = resp.json()
            comments = data.get("comments", data.get("data", []))
            return comments if isinstance(comments, list) else []
        except Exception:
            return []

    query = parse.urlencode(params)
    req_url = f"{endpoint}?{query}" if query else endpoint
    req = request.Request(url=req_url, method="GET", headers=_sc_headers(token))
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            data = json.loads(body) if body else {}
            comments = data.get("comments", data.get("data", []))
            return comments if isinstance(comments, list) else []
    except Exception:
        return []


def parse_thread_data(data: Any) -> Dict[str, Any]:
    result = {
        "submission": None,
        "comments": [],
    }

    if not isinstance(data, list) or len(data) < 1:
        return result

    submission_listing = data[0]
    if isinstance(submission_listing, dict):
        children = submission_listing.get("data", {}).get("children", [])
        if children:
            sub_data = children[0].get("data", {})
            result["submission"] = {
                "score": sub_data.get("score"),
                "num_comments": sub_data.get("num_comments"),
                "upvote_ratio": sub_data.get("upvote_ratio"),
                "created_utc": sub_data.get("created_utc"),
            }

    if len(data) >= 2:
        comments_listing = data[1]
        if isinstance(comments_listing, dict):
            children = comments_listing.get("data", {}).get("children", [])
            for child in children:
                if child.get("kind") != "t1":
                    continue
                c_data = child.get("data", {})
                if not c_data.get("body"):
                    continue

                result["comments"].append(
                    {
                        "score": c_data.get("score", 0),
                        "created_utc": c_data.get("created_utc"),
                        "author": c_data.get("author", "[deleted]"),
                        "body": c_data.get("body", "")[:300],
                        "permalink": c_data.get("permalink"),
                    }
                )

    return result


def get_top_comments(comments: List[Dict[str, Any]], limit: int = 10) -> List[Dict[str, Any]]:
    valid = [c for c in comments if c.get("author") not in ("[deleted]", "[removed]")]
    sorted_comments = sorted(valid, key=lambda c: c.get("score", 0), reverse=True)
    return sorted_comments[:limit]


def extract_comment_insights(comments: List[Dict[str, Any]], limit: int = 7) -> List[str]:
    insights: List[str] = []

    for comment in comments[: limit * 2]:
        body = str(comment.get("body", "")).strip()
        if not body or len(body) < 30:
            continue

        skip_patterns = [
            r"^(this|same|agreed|exactly|yep|nope|yes|no|thanks|thank you)\.?$",
            r"^lol|lmao|haha",
            r"^\[deleted\]",
            r"^\[removed\]",
        ]
        if any(re.match(p, body.lower()) for p in skip_patterns):
            continue

        insight = body[:150]
        if len(body) > 150:
            for i, ch in enumerate(insight):
                if ch in ".!?" and i > 50:
                    insight = insight[: i + 1]
                    break
            else:
                insight = insight.rstrip() + "..."

        insights.append(insight)
        if len(insights) >= limit:
            break

    return insights


def _enrich_item_public(
    item: Dict[str, Any],
    timeout: int = 10,
    retries: int = 1,
) -> Dict[str, Any]:
    url = str(item.get("url", ""))
    path = extract_reddit_path(url)
    if not path:
        return item

    thread_data = _fetch_reddit_json(path, timeout=timeout, retries=retries)
    if not thread_data:
        return item

    parsed = parse_thread_data(thread_data)
    submission = parsed.get("submission")
    comments = parsed.get("comments", [])

    if submission:
        item["engagement"] = {
            "score": submission.get("score"),
            "num_comments": submission.get("num_comments"),
            "upvote_ratio": submission.get("upvote_ratio"),
        }

        created_utc = submission.get("created_utc")
        if created_utc:
            item["date"] = _timestamp_to_date(created_utc)

    top_comments = get_top_comments(comments)
    item["top_comments"] = []
    for c in top_comments:
        permalink = c.get("permalink", "")
        comment_url = f"https://reddit.com{permalink}" if permalink else ""
        item["top_comments"].append(
            {
                "score": c.get("score", 0),
                "date": _timestamp_to_date(c.get("created_utc")),
                "author": c.get("author", ""),
                "excerpt": str(c.get("body", ""))[:200],
                "url": comment_url,
            }
        )

    item["comment_insights"] = extract_comment_insights(top_comments)
    return item


def _enrich_item_sc(
    item: Dict[str, Any],
    token: str,
    timeout: int = 30,
) -> Dict[str, Any]:
    url = str(item.get("url", ""))
    if not url:
        return item

    raw_comments = _fetch_post_comments_sc(url, token, timeout=timeout)
    if not raw_comments:
        return item

    top_comments: List[Dict[str, Any]] = []
    for c in raw_comments[:10]:
        body = str(c.get("body", ""))
        if not body or body in ("[deleted]", "[removed]"):
            continue

        score = c.get("ups") or c.get("score", 0)
        author = c.get("author", "[deleted]")
        permalink = c.get("permalink", "")
        comment_url = f"https://reddit.com{permalink}" if permalink else ""

        top_comments.append(
            {
                "score": score,
                "date": _timestamp_to_date(c.get("created_utc")) if c.get("created_utc") else None,
                "author": author,
                "body": body[:300],
                "excerpt": body[:200],
                "url": comment_url,
            }
        )

    top_comments.sort(key=lambda c: c.get("score", 0), reverse=True)

    item["top_comments"] = []
    for c in top_comments:
        item["top_comments"].append(
            {
                "score": c.get("score", 0),
                "date": c.get("date"),
                "author": c.get("author", ""),
                "excerpt": c.get("excerpt", ""),
                "url": c.get("url", ""),
            }
        )

    item["comment_insights"] = extract_comment_insights(top_comments)
    return item


def enrich_reddit_items(
    items: List[Dict[str, Any]],
    backend: str = "auto",
    token: str = "",
    timeout: int = 10,
    retries: int = 1,
    limit: int = 5,
) -> Dict[str, Any]:
    if not items:
        return {"items": []}

    selected_backend = backend.strip().lower() if backend else "auto"
    use_sc = selected_backend == "scrapecreators" or (selected_backend == "auto" and bool(token.strip()))

    enriched: List[Dict[str, Any]] = []
    for idx, src in enumerate(items):
        item = dict(src)
        if idx >= max(0, limit):
            enriched.append(item)
            continue

        try:
            if use_sc:
                item = _enrich_item_sc(item, token=token.strip(), timeout=timeout)
            else:
                item = _enrich_item_public(item, timeout=timeout, retries=retries)
        except RedditRateLimitError:
            enriched.append(item)
            enriched.extend(dict(rest) for rest in items[idx + 1 :])
            return {
                "items": enriched,
                "backend": "reddit_json",
                "rate_limited": True,
                "message": "Reddit rate limited (429) while enriching items.",
            }

        enriched.append(item)

    return {
        "items": enriched,
        "backend": "scrapecreators" if use_sc else "reddit_json",
        "rate_limited": False,
    }


class RedditEnrichToolkit(BaseToolkit):
    """Enrich existing Reddit search items with thread-level engagement and comments."""

    name: str = "reddit_enrich"

    def __init__(self, token: Optional[str] = None, **kwargs: Any):
        super().__init__(**kwargs)
        self.token = token

    @tool(parse_docstring=True)
    async def reddit_enrich(
        self,
        items: List[Dict[str, Any]],
        backend: str = "auto",
        token: Optional[str] = None,
        timeout: int = 10,
        retries: int = 1,
        limit: int = 5,
    ) -> Dict[str, Any]:
        """Enrich Reddit items with real thread metrics and top comments.

        Args:
            items: Reddit items to enrich, each item should include a reddit.com url field.
            backend: One of auto, scrapecreators, reddit_json.
            token: Optional ScrapeCreators API key override.
            timeout: HTTP timeout per request in seconds.
            retries: Retry count for reddit_json backend.
            limit: Maximum number of items to enrich.
        """
        selected_token = (token or self.token or "").strip()
        raw = await asyncio.to_thread(
            enrich_reddit_items,
            items,
            backend,
            selected_token,
            timeout,
            retries,
            limit,
        )
        return raw