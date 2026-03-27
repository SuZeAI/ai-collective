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

SCRAPECREATORS_BASE = "https://api.scrapecreators.com/v1/tiktok"

DEPTH_CONFIG = {
    "quick": {"results_per_page": 10, "max_captions": 3},
    "default": {"results_per_page": 20, "max_captions": 5},
    "deep": {"results_per_page": 40, "max_captions": 8},
}

CAPTION_MAX_WORDS = 500


class TikTokAPIError(RuntimeError):
    pass


def _sc_headers(token: str) -> Dict[str, str]:
    return {
        "x-api-key": token,
        "Content-Type": "application/json",
        "User-Agent": "ai-collective/tiktok-tool",
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
    ts = item.get("create_time")
    if ts is None:
        return None

    try:
        iv = int(ts)
        # Some APIs return milliseconds.
        if iv > 10_000_000_000:
            iv = iv // 1000
        dt = datetime.fromtimestamp(iv, tz=timezone.utc)
        return dt.strftime("%Y-%m-%d")
    except (ValueError, TypeError, OSError):
        return None


def _clean_webvtt(text: str) -> str:
    if not text:
        return ""

    lines: list[str] = []
    for raw_line in text.split("\n"):
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("WEBVTT"):
            continue
        if "-->" in line:
            continue
        if re.match(r"^\d{2}:\d{2}", line):
            continue
        lines.append(line)
    return " ".join(lines)


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
            raise TikTokAPIError(str(exc)) from exc

    query = parse.urlencode(params or {})
    req_url = f"{url}?{query}" if query else url
    req = request.Request(url=req_url, method="GET", headers=_sc_headers(token))
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except error.HTTPError as exc:
        message = f"TikTok API failed: HTTP {exc.code}"
        try:
            body = exc.read().decode("utf-8", errors="replace")
            if body:
                message = f"{message}: {body[:200]}"
        except Exception:
            pass
        raise TikTokAPIError(message) from exc
    except (error.URLError, TimeoutError, ValueError) as exc:
        raise TikTokAPIError(str(exc)) from exc


def _truncate_words(text: str, max_words: int = CAPTION_MAX_WORDS) -> str:
    words = (text or "").split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words]) + "..."


def search_tiktok(
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
        f"{SCRAPECREATORS_BASE}/search/keyword",
        token=token,
        params={"query": core_topic, "sort_by": "relevance"},
        timeout=30,
    )

    raw_entries = data.get("search_item_list") or data.get("data") or []
    raw_items: List[Dict[str, Any]] = []
    for entry in raw_entries:
        if not isinstance(entry, dict):
            continue
        raw_items.append(entry.get("aweme_info", entry))

    raw_items = raw_items[: config["results_per_page"]]

    items: List[Dict[str, Any]] = []
    for raw in raw_items:
        if not isinstance(raw, dict):
            continue

        video_id = str(raw.get("aweme_id") or "")
        text = str(raw.get("desc") or "")
        stats = raw.get("statistics") or {}
        author = raw.get("author") or {}

        play_count = int(stats.get("play_count") or 0)
        digg_count = int(stats.get("digg_count") or 0)
        comment_count = int(stats.get("comment_count") or 0)
        share_count = int(stats.get("share_count") or 0)

        author_name = str(author.get("unique_id") or "")
        share_url = str(raw.get("share_url") or "")

        text_extra = raw.get("text_extra") or []
        hashtags = [
            t.get("hashtag_name", "")
            for t in text_extra
            if isinstance(t, dict) and t.get("hashtag_name")
        ]

        url = share_url.split("?")[0] if share_url else ""
        if not url and author_name and video_id:
            url = f"https://www.tiktok.com/@{author_name}/video/{video_id}"

        date_str = _parse_date(raw)
        relevance = _compute_relevance(core_topic, text, hashtags)

        items.append(
            {
                "video_id": video_id,
                "text": text,
                "url": url,
                "author_name": author_name,
                "date": date_str,
                "engagement": {
                    "views": play_count,
                    "likes": digg_count,
                    "comments": comment_count,
                    "shares": share_count,
                },
                "hashtags": hashtags,
                "duration": (raw.get("video") or {}).get("duration"),
                "relevance": relevance,
                "why_relevant": f"TikTok: {text[:60]}" if text else f"TikTok: {core_topic}",
                "caption_snippet": "",
            }
        )

    in_range = [i for i in items if i.get("date") and from_date <= i["date"] <= to_date]
    if in_range:
        items = in_range

    items.sort(key=lambda x: x["engagement"]["views"], reverse=True)
    return {"items": items}


def fetch_captions(
    video_items: List[Dict[str, Any]],
    *,
    token: str,
    depth: str = "default",
) -> Dict[str, str]:
    config = DEPTH_CONFIG.get(depth, DEPTH_CONFIG["default"])
    top_items = video_items[: config["max_captions"]]

    captions: Dict[str, str] = {}

    for item in top_items:
        vid = str(item.get("video_id") or "")
        text = _truncate_words(str(item.get("text") or ""))
        if vid and text:
            captions[vid] = text

    for item in top_items:
        vid = str(item.get("video_id") or "")
        video_url = str(item.get("url") or "")
        if not vid or not video_url:
            continue

        try:
            data = _request_json(
                f"{SCRAPECREATORS_BASE}/video/transcript",
                token=token,
                params={"url": video_url},
                timeout=15,
            )
        except TikTokAPIError:
            continue

        transcript = data.get("transcript")
        if not transcript:
            continue

        if isinstance(transcript, list):
            transcript = " ".join(str(part) for part in transcript)
        transcript_text = _truncate_words(_clean_webvtt(str(transcript)))
        if transcript_text:
            captions[vid] = transcript_text

    return captions


def search_and_enrich(
    topic: str,
    from_date: str,
    to_date: str,
    *,
    token: str,
    depth: str = "default",
) -> Dict[str, Any]:
    result = search_tiktok(topic, from_date, to_date, token=token, depth=depth)
    items = result.get("items", [])
    if not items:
        return result

    captions = fetch_captions(items, token=token, depth=depth)
    for item in items:
        vid = item.get("video_id")
        if vid and captions.get(vid):
            item["caption_snippet"] = captions[vid]
    return {"items": items}


def parse_tiktok_response(response: Dict[str, Any]) -> List[Dict[str, Any]]:
    items = response.get("items", [])
    return items if isinstance(items, list) else []


class TikTokToolkit(BaseToolkit):
    """TikTok search toolkit via ScrapeCreators API."""

    name: str = "tiktok"

    def __init__(self, token: Optional[str] = None, **kwargs: Any):
        super().__init__(**kwargs)
        self.token = token or os.getenv("SCRAPECREATORS_API_KEY", "")

    @tool(parse_docstring=True)
    async def tiktok_search(
        self,
        topic: str,
        from_date: str,
        to_date: str,
        depth: str = "default",
        token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Search TikTok videos by topic and return normalized items.

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

        return await asyncio.to_thread(
            search_and_enrich,
            topic,
            from_date,
            to_date,
            token=selected_token,
            depth=depth,
        )
