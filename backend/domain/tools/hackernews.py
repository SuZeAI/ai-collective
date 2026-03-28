from __future__ import annotations

import asyncio
import html
import math
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Dict, List
from urllib.parse import urlencode

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit
from backend.domain.tools.http import HTTPError, request

ALGOLIA_SEARCH_URL = "https://hn.algolia.com/api/v1/search"
ALGOLIA_ITEM_URL = "https://hn.algolia.com/api/v1/items"

DEPTH_CONFIG = {
    "quick": 15,
    "default": 30,
    "deep": 60,
}

ENRICH_LIMITS = {
    "quick": 3,
    "default": 5,
    "deep": 10,
}

NOISE_WORDS = frozenset(
    {
        "best",
        "top",
        "good",
        "great",
        "awesome",
        "killer",
        "latest",
        "new",
        "news",
        "update",
        "updates",
        "trending",
        "popular",
        "guide",
        "tutorial",
        "how",
        "to",
        "the",
        "a",
        "an",
        "for",
        "with",
        "of",
        "in",
        "on",
        "is",
        "are",
        "what",
        "which",
        "using",
    }
)


def _extract_core_subject(topic: str) -> str:
    text = (topic or "").lower().strip().rstrip("?!.")
    if not text:
        return ""
    words = [word for word in text.split() if word not in NOISE_WORDS]
    return " ".join(words) if words else text


def _tokenize(text: str) -> set[str]:
    return {word for word in re.sub(r"[^\w\s]", " ", (text or "").lower()).split() if len(word) > 1}


def _token_overlap_relevance(query: str, text: str) -> float:
    query_tokens = _tokenize(query)
    text_tokens = _tokenize(text)
    if not query_tokens:
        return 0.5
    overlap = len(query_tokens & text_tokens)
    return round(min(1.0, max(0.0, overlap / len(query_tokens))), 2)


def _date_to_unix(date_str: str) -> int:
    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return int(dt.timestamp())


def _unix_to_date(ts: int) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")


def _strip_html(text: str) -> str:
    text = html.unescape(text or "")
    text = re.sub(r"<p>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    return text.strip()


def search_hackernews(
    topic: str,
    from_date: str,
    to_date: str,
    depth: str = "default",
) -> Dict[str, Any]:
    count = DEPTH_CONFIG.get(depth, DEPTH_CONFIG["default"])
    from_ts = _date_to_unix(from_date)
    to_ts = _date_to_unix(to_date) + 86400
    core_topic = _extract_core_subject(topic)

    params = {
        "query": core_topic or topic,
        "tags": "story",
        "numericFilters": f"created_at_i>{from_ts},created_at_i<{to_ts},points>2",
        "hitsPerPage": str(count),
    }
    url = f"{ALGOLIA_SEARCH_URL}?{urlencode(params)}"

    try:
        response = request("GET", url, timeout=30)
    except HTTPError as exc:
        return {"hits": [], "error": str(exc)}
    except Exception as exc:
        return {"hits": [], "error": str(exc)}

    return response if isinstance(response, dict) else {"hits": []}


def parse_hackernews_response(response: Dict[str, Any], query: str = "") -> List[Dict[str, Any]]:
    hits = response.get("hits", [])
    if not isinstance(hits, list):
        return []

    items: List[Dict[str, Any]] = []
    for index, hit in enumerate(hits):
        if not isinstance(hit, dict):
            continue

        object_id = str(hit.get("objectID", "")).strip()
        if not object_id:
            continue

        points = hit.get("points") or 0
        num_comments = hit.get("num_comments") or 0
        created_at_i = hit.get("created_at_i")
        date_str = _unix_to_date(created_at_i) if isinstance(created_at_i, int) else None

        title = str(hit.get("title", "")).strip()
        article_url = str(hit.get("url") or "").strip()
        hn_url = f"https://news.ycombinator.com/item?id={object_id}"

        rank_score = max(0.3, 1.0 - (index * 0.02))
        engagement_boost = min(0.2, math.log1p(max(0, int(points))) / 40)
        if query:
            content_score = _token_overlap_relevance(query, title)
            relevance = min(1.0, 0.6 * rank_score + 0.4 * content_score + engagement_boost)
        else:
            relevance = min(1.0, rank_score * 0.7 + engagement_boost + 0.1)

        items.append(
            {
                "id": f"HN{index + 1}",
                "object_id": object_id,
                "title": title,
                "url": article_url or hn_url,
                "source_url": article_url,
                "hn_url": hn_url,
                "author": str(hit.get("author", "")).strip(),
                "date": date_str,
                "engagement": {
                    "points": points,
                    "num_comments": num_comments,
                },
                "relevance": round(relevance, 2),
                "why_relevant": f"Hacker News discussion about {title[:80] or query[:80]}",
            }
        )

    return items


def _fetch_item_comments(object_id: str, max_comments: int = 5) -> Dict[str, Any]:
    url = f"{ALGOLIA_ITEM_URL}/{object_id}"

    try:
        data = request("GET", url, timeout=15)
    except Exception:
        return {"comments": [], "comment_insights": []}

    children = data.get("children", []) if isinstance(data, dict) else []
    real_comments = [comment for comment in children if isinstance(comment, dict) and comment.get("text") and comment.get("author")]
    real_comments.sort(key=lambda comment: comment.get("points") or 0, reverse=True)

    comments: List[Dict[str, Any]] = []
    insights: List[str] = []
    for comment in real_comments[:max_comments]:
        text = _strip_html(str(comment.get("text", "")))
        excerpt = text[:300] + "..." if len(text) > 300 else text
        comments.append(
            {
                "author": str(comment.get("author", "")).strip(),
                "text": excerpt,
                "points": comment.get("points") or 0,
            }
        )

        first_sentence = text.split(". ")[0].split("\n")[0][:200].strip()
        if first_sentence:
            insights.append(first_sentence)

    return {"comments": comments, "comment_insights": insights}


def enrich_top_stories(items: List[Dict[str, Any]], depth: str = "default") -> List[Dict[str, Any]]:
    if not items:
        return items

    limit = ENRICH_LIMITS.get(depth, ENRICH_LIMITS["default"])
    to_enrich = sorted(
        range(len(items)),
        key=lambda index: items[index].get("engagement", {}).get("points", 0),
        reverse=True,
    )[:limit]

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(_fetch_item_comments, items[index]["object_id"]): index
            for index in to_enrich
        }
        for future in as_completed(futures):
            index = futures[future]
            try:
                result = future.result(timeout=15)
                items[index]["top_comments"] = result["comments"]
                items[index]["comment_insights"] = result["comment_insights"]
            except Exception:
                items[index]["top_comments"] = []
                items[index]["comment_insights"] = []

    return items


def search_and_enrich_hackernews(
    topic: str,
    from_date: str,
    to_date: str,
    depth: str = "default",
) -> Dict[str, Any]:
    raw = search_hackernews(topic, from_date, to_date, depth=depth)
    items = parse_hackernews_response(raw, query=topic)
    enriched = enrich_top_stories(items, depth=depth)
    result: Dict[str, Any] = {"items": enriched}
    if raw.get("error"):
        result["error"] = raw["error"]
    return result


class HackerNewsToolkit(BaseToolkit):
    """Hacker News search toolkit via Algolia API."""

    name: str = "hackernews"

    @tool(parse_docstring=True)
    async def hackernews_search(
        self,
        topic: str,
        from_date: str,
        to_date: str,
        depth: str = "default",
    ) -> Dict[str, Any]:
        """Search Hacker News stories by topic and return normalized items.

        Args:
            topic: Search query in natural language.
            from_date: Start date in YYYY-MM-DD format.
            to_date: End date in YYYY-MM-DD format.
            depth: Search depth, one of quick, default, deep.
        """
        selected_depth = (depth or "default").strip().lower()
        if selected_depth not in DEPTH_CONFIG:
            selected_depth = "default"

        return await asyncio.to_thread(
            search_and_enrich_hackernews,
            topic,
            from_date,
            to_date,
            selected_depth,
        )
