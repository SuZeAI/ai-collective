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

SCRAPECREATORS_BASE = "https://api.scrapecreators.com/v2/instagram"

DEPTH_CONFIG = {
    "quick": {"results_per_page": 10, "max_captions": 3},
    "default": {"results_per_page": 20, "max_captions": 5},
    "deep": {"results_per_page": 40, "max_captions": 8},
}

CAPTION_MAX_WORDS = 500


class InstagramAPIError(RuntimeError):
    pass


def _sc_headers(token: str) -> Dict[str, str]:
    return {
        "x-api-key": token,
        "Content-Type": "application/json",
        "User-Staff": "ai-collective/instagram-tool",
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


def _compute_relevance(topic: str, text: str, hashtags: List[str]) -> float:
    q = _tokenize(topic)
    t = _tokenize(text)
    h = _tokenize(" ".join(hashtags or []))

    if not q:
        return 0.5

    overlap = len(q & t)
    hashtag_overlap = len(q & h)
    score = (overlap / len(q)) + (0.2 * hashtag_overlap / len(q))
    return round(min(1.0, max(0.0, score)), 2)


def _parse_date(item: Dict[str, Any]) -> Optional[str]:
    """Parse date from Instagram item to YYYY-MM-DD format.
    
    Handles taken_at as ISO string or unix timestamp.
    """
    ts = item.get("taken_at")
    if not ts:
        return None

    # Try ISO string first (e.g. "2026-02-26T16:00:00.000Z")
    if isinstance(ts, str):
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            pass
        # Try just the date portion
        if len(ts) >= 10:
            return ts[:10]

    # Fall back to unix timestamp
    try:
        dt = datetime.fromtimestamp(int(ts), tz=timezone.utc)
        return dt.strftime("%Y-%m-%d")
    except (ValueError, TypeError, OSError):
        pass

    return None


def _extract_hashtags(caption_text: str) -> List[str]:
    """Extract hashtags from Instagram caption text."""
    if not caption_text:
        return []
    return re.findall(r'#(\w+)', caption_text)


def _truncate_words(text: str, max_words: int = CAPTION_MAX_WORDS) -> str:
    words = (text or "").split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words]) + "..."


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
            raise InstagramAPIError(str(exc)) from exc

    query = parse.urlencode(params or {})
    req_url = f"{url}?{query}" if query else url
    req = request.Request(url=req_url, method="GET", headers=_sc_headers(token))
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except error.HTTPError as exc:
        message = f"Instagram API failed: HTTP {exc.code}"
        try:
            body = exc.read().decode("utf-8", errors="replace")
            if body:
                message = f"{message}: {body[:200]}"
        except Exception:
            pass
        raise InstagramAPIError(message) from exc
    except (error.URLError, TimeoutError, ValueError) as exc:
        raise InstagramAPIError(str(exc)) from exc


def search_instagram(
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
        f"{SCRAPECREATORS_BASE}/reels/search",
        token=token,
        params={"query": core_topic, "sort_by": "relevance"},
        timeout=30,
    )

    # Items are in the 'reels' array (ScrapeCreators v2 response)
    raw_items = data.get("reels") or data.get("items") or data.get("data") or []
    raw_items = raw_items[: config["results_per_page"]]

    items: List[Dict[str, Any]] = []
    for raw in raw_items:
        if not isinstance(raw, dict):
            continue

        # Extract reel ID and shortcode
        reel_pk = str(raw.get("id", raw.get("pk", "")))
        shortcode = raw.get("shortcode", raw.get("code", ""))

        # Caption text — can be a string or dict depending on endpoint
        caption_obj = raw.get("caption", "")
        if isinstance(caption_obj, dict):
            text = caption_obj.get("text", "")
        elif isinstance(caption_obj, str):
            text = caption_obj
        else:
            text = raw.get("desc", raw.get("text", ""))

        # Engagement metrics
        play_count = (
            raw.get("video_play_count")
            or raw.get("video_view_count")
            or raw.get("play_count")
            or 0
        )
        like_count = raw.get("like_count") or 0
        comment_count = raw.get("comment_count") or 0

        # Author info — 'owner' in reels/search, 'user' in user/reels
        owner = raw.get("owner") or raw.get("user") or {}
        author_name = owner.get("username", "") if isinstance(owner, dict) else ""

        # Duration
        duration = raw.get("video_duration")

        # Date
        date_str = _parse_date(raw)

        # Hashtags from caption text
        hashtags = _extract_hashtags(text)

        # Compute relevance with hashtag boost
        relevance = _compute_relevance(core_topic, text, hashtags)

        # Build URL — prefer API-provided url, fallback to shortcode
        url = raw.get("url", "")
        if not url and shortcode:
            url = f"https://www.instagram.com/reel/{shortcode}"

        items.append(
            {
                "video_id": reel_pk,
                "text": text,
                "url": url,
                "author_name": author_name,
                "date": date_str,
                "engagement": {
                    "views": play_count,
                    "likes": like_count,
                    "comments": comment_count,
                },
                "hashtags": hashtags,
                "duration": duration,
                "relevance": relevance,
                "why_relevant": f"Instagram: {text[:60]}" if text else f"Instagram: {core_topic}",
                "caption_snippet": "",
            }
        )

    # Hard date filter
    in_range = [i for i in items if i.get("date") and from_date <= i["date"] <= to_date]
    if in_range:
        items = in_range

    # Sort by views descending
    items.sort(key=lambda x: x["engagement"]["views"], reverse=True)
    return {"items": items}


def fetch_captions(
    video_items: List[Dict[str, Any]],
    *,
    token: str,
    depth: str = "default",
) -> Dict[str, str]:
    """Fetch transcripts for top N Instagram reels via ScrapeCreators.

    Args:
        video_items: Items from search_instagram()
        token: ScrapeCreators API key
        depth: Depth level for caption limit

    Returns:
        Dict mapping video_id -> caption text (truncated to 500 words)
    """
    config = DEPTH_CONFIG.get(depth, DEPTH_CONFIG["default"])
    max_captions = config["max_captions"]

    if not video_items or not token:
        return {}

    top_items = video_items[:max_captions]
    captions: Dict[str, str] = {}

    # First pass: use text field as caption (always available)
    for item in top_items:
        vid = item.get("video_id")
        text = item.get("text", "")
        if vid and text:
            text = _truncate_words(text)
            captions[vid] = text

    # Second pass: try to get spoken-word transcripts (1 credit each)
    if not _requests:
        return captions

    for item in top_items:
        vid = item.get("video_id")
        url = item.get("url", "")
        if not vid or not url:
            continue
        try:
            resp = _requests.get(
                f"{SCRAPECREATORS_BASE}/media/transcript",
                params={"url": url},
                headers=_sc_headers(token),
                timeout=15,
            )
            if resp.status_code == 200:
                data = resp.json()
                transcripts = data.get("transcripts") or []
                if transcripts and isinstance(transcripts, list):
                    # Combine all transcript segments
                    transcript_text = " ".join(
                        t.get("text", "")
                        for t in transcripts
                        if isinstance(t, dict) and t.get("text")
                    )
                    if transcript_text:
                        transcript_text = _truncate_words(transcript_text)
                        captions[vid] = transcript_text
        except Exception:
            # Continue on error, caption will be from text field
            pass

    return captions


def search_and_enrich(
    topic: str,
    from_date: str,
    to_date: str,
    *,
    token: str,
    depth: str = "default",
) -> Dict[str, Any]:
    """Full Instagram search: find reels, then fetch captions for top results.

    Args:
        topic: Search topic
        from_date: Start date (YYYY-MM-DD)
        to_date: End date (YYYY-MM-DD)
        depth: 'quick', 'default', or 'deep'
        token: ScrapeCreators API key

    Returns:
        Dict with 'items' list. Each item has a 'caption_snippet' field.
    """
    # Step 1: Search
    search_result = search_instagram(topic, from_date, to_date, token=token, depth=depth)
    items = search_result.get("items", [])

    if not items:
        return search_result

    # Step 2: Fetch captions for top N
    captions = fetch_captions(items, token=token, depth=depth)

    # Step 3: Attach captions to items
    for item in items:
        vid = item.get("video_id")
        if vid and captions.get(vid):
            item["caption_snippet"] = captions[vid]

    return {"items": items}


def parse_instagram_response(response: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Parse Instagram search response to normalized format.

    Returns:
        List of item dicts ready for normalization.
    """
    items = response.get("items", [])
    return items if isinstance(items, list) else []


class InstagramToolkit(BaseToolkit):
    """Instagram Reels search toolkit via ScrapeCreators API."""

    name: str = "instagram"

    def __init__(self, token: Optional[str] = None, **kwargs: Any):
        super().__init__(**kwargs)
        self.token = token

    @tool(parse_docstring=True)
    async def instagram_search(
        self,
        topic: str,
        from_date: str,
        to_date: str,
        depth: str = "default",
        token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Search Instagram Reels by topic and return normalized items.

        Args:
            topic: Search query in natural language.
            from_date: Start date in YYYY-MM-DD format.
            to_date: End date in YYYY-MM-DD format.
            depth: Search depth, one of quick, default, deep.
            token: Optional ScrapeCreators API key override.
        """
        selected_token = (token or self.token or "").strip()
        if not selected_token:
            raise ValueError("Missing ScrapeCreators API key. Configure token in tool config.")

        return await asyncio.to_thread(
            search_and_enrich,
            topic,
            from_date,
            to_date,
            token=selected_token,
            depth=depth,
        )
