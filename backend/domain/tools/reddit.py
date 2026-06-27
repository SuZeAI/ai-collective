from __future__ import annotations

import asyncio
import json
import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib import error, parse, request

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit
from backend.api.settings import settings

try:
    import requests as _requests
except ImportError:
    _requests = None

SCRAPECREATORS_BASE = "https://api.scrapecreators.com/v1/reddit"

DEPTH_CONFIG = {
    "quick": {
        "global_searches": 1,
        "subreddit_searches": 2,
        "comment_enrichments": 3,
        "timeframe": "week",
    },
    "default": {
        "global_searches": 2,
        "subreddit_searches": 3,
        "comment_enrichments": 5,
        "timeframe": "month",
    },
    "deep": {
        "global_searches": 3,
        "subreddit_searches": 5,
        "comment_enrichments": 8,
        "timeframe": "month",
    },
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
        "hottest",
        "popular",
        "practices",
        "features",
        "tips",
        "recommendations",
        "advice",
        "prompt",
        "prompts",
        "prompting",
        "methods",
        "strategies",
        "approaches",
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
        "guide",
        "tutorial",
        "using",
    }
)

UTILITY_SUBS = frozenset(
    {
        "namethatsong",
        "findthatsong",
        "tipofmytongue",
        "whatisthissong",
        "helpmefind",
        "whatisthisthing",
        "whatsthissong",
        "findareddit",
        "subredditdrama",
    }
)


class RedditAPIError(RuntimeError):
    pass


def _sc_headers(token: str) -> Dict[str, str]:
    return {
        "x-api-key": token,
        "Content-Type": "application/json",
        "User-Staff": "ai-collective/reddit-tool",
    }


def _extract_core_subject(topic: str) -> str:
    text = (topic or "").lower().strip().rstrip("?!.")
    if not text:
        return ""
    words = [w for w in text.split() if w not in NOISE_WORDS]
    return " ".join(words) if words else text


def _tokenize(text: str) -> set[str]:
    return {w for w in re.sub(r"[^\w\s]", " ", (text or "").lower()).split() if len(w) > 1}


def _token_overlap_relevance(query: str, text: str) -> float:
    q = _tokenize(query)
    t = _tokenize(text)
    if not q:
        return 0.5
    overlap = len(q & t)
    return round(min(1.0, max(0.0, overlap / len(q))), 2)


def _detect_query_type(topic: str) -> str:
    text = (topic or "").lower()
    if any(k in text for k in ("worth it", "review", "thoughts", "vs", "better")):
        return "opinion"
    if any(k in text for k in ("how", "setup", "fix", "install", "use")):
        return "how_to"
    if any(k in text for k in ("best", "top", "buy", "tool", "app", "software")):
        return "product"
    return "general"


def _compute_post_relevance(query: str, title: str, selftext: str) -> float:
    title_score = _token_overlap_relevance(query, title)
    if not selftext.strip():
        return title_score
    body_score = _token_overlap_relevance(query, selftext)
    support_score = max(title_score, body_score)
    return round(0.75 * title_score + 0.25 * support_score, 2)


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
            raise RedditAPIError(str(exc)) from exc

    query = parse.urlencode(params or {})
    req_url = f"{url}?{query}" if query else url
    req = request.Request(url=req_url, method="GET", headers=_sc_headers(token))
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except error.HTTPError as exc:
        message = f"Reddit API failed: HTTP {exc.code}"
        try:
            body = exc.read().decode("utf-8", errors="replace")
            if body:
                message = f"{message}: {body[:200]}"
        except Exception:
            pass
        raise RedditAPIError(message) from exc
    except (error.URLError, TimeoutError, ValueError) as exc:
        raise RedditAPIError(str(exc)) from exc


def _parse_date(created_utc: Any) -> Optional[str]:
    if not created_utc:
        return None
    try:
        dt = datetime.fromtimestamp(float(created_utc), tz=timezone.utc)
        return dt.strftime("%Y-%m-%d")
    except (ValueError, TypeError, OSError):
        return None


def _expand_reddit_queries(topic: str, depth: str) -> List[str]:
    core = _extract_core_subject(topic)
    queries = [core] if core else [topic.strip()]

    original_clean = topic.strip().rstrip("?!.")
    if core and core.lower() != original_clean.lower() and len(original_clean.split()) <= 8:
        queries.append(original_clean)

    qtype = _detect_query_type(topic)
    if depth in ("default", "deep") and qtype in ("product", "opinion"):
        queries.append(f"{core} worth it OR thoughts OR review")
    if depth == "deep" and qtype in ("product", "opinion", "how_to"):
        queries.append(f"{core} issues OR problems OR bug OR broken")

    unique_queries: List[str] = []
    seen: set[str] = set()
    for q in queries:
        clean_q = q.strip()
        if clean_q and clean_q not in seen:
            seen.add(clean_q)
            unique_queries.append(clean_q)
    return unique_queries


def _discover_subreddits(
    results: List[Dict[str, Any]],
    topic: str,
    max_subs: int,
) -> List[str]:
    core = _extract_core_subject(topic)
    core_words = set(core.lower().split()) if core else set()

    scores = Counter()
    for post in results:
        sub = str(post.get("subreddit", "")).strip()
        if not sub:
            continue

        base = 1.0
        sub_lower = sub.lower()
        if core_words and any(w in sub_lower for w in core_words if len(w) > 2):
            base += 2.0
        if sub_lower in UTILITY_SUBS:
            base *= 0.3

        ups = post.get("ups") or post.get("score", 0)
        try:
            if int(ups) > 100:
                base += 0.5
        except (ValueError, TypeError):
            pass

        scores[sub] += base

    return [sub for sub, _ in scores.most_common(max_subs)]


def _normalize_post(post: Dict[str, Any], idx: int, source_label: str, query: str) -> Dict[str, Any]:
    permalink = str(post.get("permalink", "") or "")
    url = f"https://www.reddit.com{permalink}" if permalink else str(post.get("url", "") or "")
    if url and "reddit.com" not in url:
        url = ""

    title = str(post.get("title", "")).strip()
    selftext = str(post.get("selftext", ""))

    relevance = _compute_post_relevance(query, title, selftext) if query else 0.7

    return {
        "id": f"R{idx}",
        "reddit_id": post.get("id", ""),
        "title": title,
        "url": url,
        "subreddit": str(post.get("subreddit", "")).strip(),
        "date": _parse_date(post.get("created_utc")),
        "engagement": {
            "score": post.get("ups") or post.get("score", 0),
            "num_comments": post.get("num_comments", 0),
            "upvote_ratio": post.get("upvote_ratio"),
        },
        "relevance": relevance,
        "why_relevant": f"Reddit {source_label} search",
        "selftext": selftext[:500],
    }


def _global_search(query: str, token: str, sort: str, timeframe: str) -> List[Dict[str, Any]]:
    data = _request_json(
        f"{SCRAPECREATORS_BASE}/search",
        token=token,
        params={"query": query, "sort": sort, "timeframe": timeframe},
        timeout=30,
    )
    posts = data.get("posts", data.get("data", []))
    return posts if isinstance(posts, list) else []


def _subreddit_search(subreddit: str, query: str, token: str, sort: str, timeframe: str) -> List[Dict[str, Any]]:
    data = _request_json(
        f"{SCRAPECREATORS_BASE}/subreddit/search",
        token=token,
        params={"subreddit": subreddit, "query": query, "sort": sort, "timeframe": timeframe},
        timeout=30,
    )
    posts = data.get("posts", data.get("data", []))
    return posts if isinstance(posts, list) else []


def _fetch_post_comments(url: str, token: str) -> List[Dict[str, Any]]:
    data = _request_json(
        f"{SCRAPECREATORS_BASE}/post/comments",
        token=token,
        params={"url": url},
        timeout=30,
    )
    comments = data.get("comments", data.get("data", []))
    return comments if isinstance(comments, list) else []


def _dedupe_posts(posts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen_ids = set()
    seen_urls = set()
    unique = []
    for post in posts:
        rid = post.get("reddit_id", "")
        url = post.get("url", "")
        if rid and rid in seen_ids:
            continue
        if url and url in seen_urls:
            continue
        if rid:
            seen_ids.add(rid)
        if url:
            seen_urls.add(url)
        unique.append(post)
    return unique


def search_reddit(topic: str, from_date: str, to_date: str, *, token: str, depth: str = "default") -> Dict[str, Any]:
    config = DEPTH_CONFIG.get(depth, DEPTH_CONFIG["default"])
    timeframe = config["timeframe"]

    queries = _expand_reddit_queries(topic, depth)
    all_raw_posts: List[Dict[str, Any]] = []

    for i, query in enumerate(queries[: config["global_searches"]]):
        sort = "relevance" if i == 0 else "top"
        try:
            posts = _global_search(query, token, sort=sort, timeframe=timeframe)
            all_raw_posts.extend(posts)
        except RedditAPIError:
            continue

    core = _extract_core_subject(topic)
    all_items = [_normalize_post(post, i + 1, "global", query=core) for i, post in enumerate(all_raw_posts)]

    discovered_subs = _discover_subreddits(all_raw_posts, topic=topic, max_subs=config["subreddit_searches"])
    for sub in discovered_subs[: config["subreddit_searches"]]:
        try:
            sub_posts = _subreddit_search(sub, core or topic, token, sort="relevance", timeframe=timeframe)
        except RedditAPIError:
            continue
        for j, post in enumerate(sub_posts):
            all_items.append(_normalize_post(post, len(all_items) + j + 1, f"r/{sub}", query=core or topic))

    all_items = _dedupe_posts(all_items)

    in_range = []
    for item in all_items:
        date = item.get("date")
        if date is None or (from_date <= date <= to_date):
            in_range.append(item)
    if in_range:
        all_items = in_range

    all_items.sort(key=lambda x: int(x.get("engagement", {}).get("score", 0) or 0), reverse=True)
    for i, item in enumerate(all_items):
        item["id"] = f"R{i+1}"

    return {"items": all_items}


def enrich_with_comments(items: List[Dict[str, Any]], token: str, depth: str = "default") -> List[Dict[str, Any]]:
    config = DEPTH_CONFIG.get(depth, DEPTH_CONFIG["default"])
    max_comments = config["comment_enrichments"]
    top_items = items[:max_comments]

    for item in top_items:
        url = item.get("url", "")
        if not url:
            continue

        try:
            raw_comments = _fetch_post_comments(url, token)
        except RedditAPIError:
            continue
        if not raw_comments:
            continue

        top_comments = []
        insights = []
        for ci, comment in enumerate(raw_comments[:10]):
            body = str(comment.get("body", "") or "")
            if not body or body in ("[deleted]", "[removed]"):
                continue

            score = comment.get("ups") or comment.get("score", 0)
            author = str(comment.get("author", "[deleted]"))
            permalink = str(comment.get("permalink", "") or "")
            comment_url = f"https://reddit.com{permalink}" if permalink else ""

            max_excerpt = 400 if ci == 0 else 300
            top_comments.append(
                {
                    "score": score,
                    "date": _parse_date(comment.get("created_utc")),
                    "author": author,
                    "excerpt": body[:max_excerpt],
                    "url": comment_url,
                }
            )

            if len(body) >= 30 and author not in ("[deleted]", "[removed]", "AutoModerator"):
                insight = body[:150]
                if len(body) > 150:
                    cut = max(insight.rfind("."), insight.rfind("!"), insight.rfind("?"))
                    insight = insight[: cut + 1] if cut > 50 else insight.rstrip() + "..."
                insights.append(insight)

        top_comments.sort(key=lambda c: int(c.get("score", 0) or 0), reverse=True)
        item["top_comments"] = top_comments[:10]
        item["comment_insights"] = insights[:10]

    return items


def search_and_enrich(
    topic: str,
    from_date: str,
    to_date: str,
    *,
    token: str,
    depth: str = "default",
) -> Dict[str, Any]:
    result = search_reddit(topic, from_date, to_date, token=token, depth=depth)
    items = result.get("items", [])
    if items:
        result["items"] = enrich_with_comments(items, token, depth)
    return result


def parse_reddit_response(response: Dict[str, Any]) -> List[Dict[str, Any]]:
    items = response.get("items", [])
    return items if isinstance(items, list) else []


class RedditToolkit(BaseToolkit):
    """Reddit search toolkit via ScrapeCreators API."""

    name: str = "reddit"

    def __init__(self, token: Optional[str] = None, **kwargs: Any):
        super().__init__(**kwargs)
        self.token = token or settings.tools.scrapecreators_api_key

    @tool(parse_docstring=True)
    async def reddit_search(
        self,
        topic: str,
        from_date: str,
        to_date: str,
        depth: str = "default",
        token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Search Reddit posts by topic and return normalized items.

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
            search_and_enrich,
            topic,
            from_date,
            to_date,
            token=selected_token,
            depth=depth,
        )
        return {"items": parse_reddit_response(raw)}
