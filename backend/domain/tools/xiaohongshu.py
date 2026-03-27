from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib import error, request

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit

_DEFAULT_TIMEOUT_SECONDS = 20
_DEFAULT_RETRIES = 2


class XiaohongshuAPIError(RuntimeError):
    pass


def _request_json(
    method: str,
    url: str,
    *,
    payload: Optional[Dict[str, Any]] = None,
    timeout: int = _DEFAULT_TIMEOUT_SECONDS,
    retries: int = _DEFAULT_RETRIES,
) -> Dict[str, Any]:
    headers = {
        "User-Agent": "ai-collective/xiaohongshu-tool",
    }
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = request.Request(url=url, data=data, method=method.upper(), headers=headers)

    last_exc: Exception | None = None
    for _ in range(max(1, retries)):
        try:
            with request.urlopen(req, timeout=timeout) as resp:
                body = resp.read().decode("utf-8")
                return json.loads(body) if body else {}
        except error.HTTPError as exc:
            body = ""
            try:
                body = exc.read().decode("utf-8", errors="replace")
            except Exception:
                body = ""

            message = f"HTTP {exc.code} while calling Xiaohongshu API"
            if body:
                message = f"{message}: {body[:200]}"
            last_exc = XiaohongshuAPIError(message)
            if 400 <= exc.code < 500 and exc.code != 429:
                break
        except (error.URLError, TimeoutError, ValueError) as exc:
            last_exc = exc

    raise XiaohongshuAPIError(str(last_exc) if last_exc else "Unknown Xiaohongshu API error")


def _to_int(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return int(value)

    text = str(value).strip().lower().replace(",", "")
    if not text:
        return 0

    try:
        if text.endswith("万"):
            return int(float(text[:-1]) * 10000)
        if text.endswith("亿"):
            return int(float(text[:-1]) * 100000000)
        return int(float(text))
    except (TypeError, ValueError):
        return 0


def _timestamp_to_date_ms(ts: Any) -> Optional[str]:
    try:
        iv = int(ts)
        if iv <= 0:
            return None
        dt = datetime.fromtimestamp(iv / 1000.0, tz=timezone.utc)
        return dt.strftime("%Y-%m-%d")
    except (TypeError, ValueError, OSError):
        return None


def _relevance_from_interactions(likes: int, comments: int, favorites: int) -> float:
    weighted = (likes * 1.0) + (comments * 2.5) + (favorites * 1.5)
    score = min(1.0, max(0.05, weighted / 5000.0))
    return round(score, 3)


def _build_note_url(feed_id: str, xsec_token: str) -> str:
    if xsec_token:
        return f"https://www.xiaohongshu.com/explore/{feed_id}?xsec_token={xsec_token}"
    return f"https://www.xiaohongshu.com/explore/{feed_id}"


def _in_date_range(date_value: Optional[str], from_date: str, to_date: str) -> bool:
    if not date_value:
        return True
    return from_date <= date_value <= to_date


def search_feeds(
    topic: str,
    from_date: str,
    to_date: str,
    base_url: str,
    depth: str = "default",
) -> Dict[str, Any]:
    base = (base_url or "").rstrip("/")
    if not base:
        raise ValueError("Missing Xiaohongshu API base URL")

    login = _request_json("GET", f"{base}/api/v1/login/status", timeout=8, retries=1)
    is_logged_in = login.get("data", {}).get("is_logged_in") if isinstance(login, dict) else False
    if not is_logged_in:
        raise XiaohongshuAPIError("Xiaohongshu API reachable but not logged in")

    publish_time = "一天内" if depth == "quick" else "一周内" if depth == "default" else "半年内"
    payload = {
        "keyword": topic,
        "filters": {
            "sort_by": "综合",
            "note_type": "不限",
            "publish_time": publish_time,
            "search_scope": "不限",
            "location": "不限",
        },
    }

    resp = _request_json("POST", f"{base}/api/v1/feeds/search", payload=payload, timeout=20, retries=1)
    feeds = resp.get("data", {}).get("feeds", []) if isinstance(resp, dict) else []
    if not isinstance(feeds, list):
        feeds = []

    limit = {"quick": 8, "default": 15, "deep": 25}.get(depth, 15)
    items: List[Dict[str, Any]] = []

    for i, feed in enumerate(feeds[:limit]):
        if not isinstance(feed, dict):
            continue

        note = feed.get("noteCard") or {}
        if not isinstance(note, dict):
            note = {}

        interact = note.get("interactInfo") or {}
        if not isinstance(interact, dict):
            interact = {}

        feed_id = str(feed.get("id") or note.get("noteId") or "").strip()
        if not feed_id:
            continue

        date_value = _timestamp_to_date_ms(note.get("time"))
        if not _in_date_range(date_value, from_date, to_date):
            continue

        xsec_token = str(feed.get("xsecToken") or note.get("xsecToken") or "").strip()
        title = str(note.get("displayTitle") or note.get("title") or "").strip()
        snippet = str(note.get("desc") or note.get("displayDesc") or title or "").strip()

        likes = _to_int(interact.get("likedCount"))
        comments = _to_int(interact.get("commentCount"))
        favorites = _to_int(interact.get("collectedCount"))

        items.append(
            {
                "id": f"XHS{i + 1}",
                "title": title[:200] if title else f"Xiaohongshu note {feed_id}",
                "url": _build_note_url(feed_id, xsec_token),
                "source_domain": "xiaohongshu.com",
                "snippet": snippet[:500],
                "date": date_value,
                "date_confidence": "high" if date_value else "low",
                "relevance": _relevance_from_interactions(likes, comments, favorites),
                "why_relevant": (
                    f"Xiaohongshu engagement: likes={likes}, "
                    f"comments={comments}, favorites={favorites}"
                ),
                "engagement": {
                    "likes": likes,
                    "comments": comments,
                    "favorites": favorites,
                },
            }
        )

    return {"items": items}


class XiaohongshuToolkit(BaseToolkit):
    """Xiaohongshu search toolkit via xiaohongshu-mcp REST API."""

    name: str = "xiaohongshu"

    def __init__(self, base_url: Optional[str] = None, **kwargs: Any):
        super().__init__(**kwargs)
        self.base_url = base_url or os.getenv("XIAOHONGSHU_API_BASE_URL", "")

    @tool(parse_docstring=True)
    async def xiaohongshu_search(
        self,
        topic: str,
        from_date: str,
        to_date: str,
        depth: str = "default",
        base_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Search Xiaohongshu posts by topic and return normalized results.

        Args:
            topic: Search query in natural language.
            from_date: Start date in YYYY-MM-DD format.
            to_date: End date in YYYY-MM-DD format.
            depth: Search depth, one of quick, default, deep.
            base_url: Optional Xiaohongshu API base URL override.
        """
        resolved_base_url = (base_url or self.base_url or "").strip()
        if not resolved_base_url:
            raise ValueError(
                "Missing Xiaohongshu API base URL. Set XIAOHONGSHU_API_BASE_URL or pass base_url."
            )

        return await asyncio.to_thread(
            search_feeds,
            topic,
            from_date,
            to_date,
            resolved_base_url,
            depth,
        )