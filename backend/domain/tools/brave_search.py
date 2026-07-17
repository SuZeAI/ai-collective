from __future__ import annotations

import asyncio
import html
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode, urlparse

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit
from backend.domain.tools.http import request

ENDPOINT = "https://api.search.brave.com/res/v1/web/search"
LLM_CONTEXT_ENDPOINT = "https://api.search.brave.com/res/v1/llm/context"

DEPTH_RESULT_COUNT = {
    "quick": 8,
    "default": 15,
    "deep": 25,
}
DEPTH_LLM_COUNT = {
    "quick": 5,
    "default": 20,
    "deep": 50,
}
DEPTH_LLM_MAX_TOKENS = {
    "quick": 2048,
    "default": 8192,
    "deep": 16384,
}
FRESHNESS_MAP = {
    1: "pd",
    7: "pw",
    31: "pm",
}
EXCLUDED_DOMAINS = {
    "reddit.com",
    "www.reddit.com",
    "old.reddit.com",
    "twitter.com",
    "www.twitter.com",
    "x.com",
    "www.x.com",
}


def _days_between(from_date: str, to_date: str) -> int:
    try:
        start = datetime.strptime(from_date, "%Y-%m-%d")
        end = datetime.strptime(to_date, "%Y-%m-%d")
        return max(1, (end - start).days)
    except (TypeError, ValueError):
        return 30


def _brave_freshness(days: Optional[int]) -> Optional[str]:
    if days is None:
        return None

    code = next((value for threshold, value in sorted(FRESHNESS_MAP.items()) if days <= threshold), None)
    if code:
        return code

    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days)).strftime("%Y-%m-%d")
    end = now.strftime("%Y-%m-%d")
    return f"{start}to{end}"


def _clean_html(text: str) -> str:
    return html.unescape(re.sub(r"<[^>]*>", "", text))


def _parse_brave_date(age: Optional[str], page_age: Optional[str]) -> Optional[str]:
    text = age or page_age
    if not text:
        return None

    normalized = text.lower().strip()
    now = datetime.now()

    if re.search(r"\d+\s*hours?\s*ago", normalized):
        return now.strftime("%Y-%m-%d")

    match = re.search(r"(\d+)\s*days?\s*ago", normalized)
    if match:
        days = int(match.group(1))
        if days <= 60:
            return (now - timedelta(days=days)).strftime("%Y-%m-%d")

    match = re.search(r"(\d+)\s*weeks?\s*ago", normalized)
    if match:
        weeks = int(match.group(1))
        return (now - timedelta(weeks=weeks)).strftime("%Y-%m-%d")

    match = re.search(r"(\d{4}-\d{2}-\d{2})", text)
    if match:
        return match.group(1)

    return None


def _normalize_domain(url: str) -> str:
    try:
        domain = urlparse(url).netloc.lower()
        return domain[4:] if domain.startswith("www.") else domain
    except Exception:
        return ""


def _normalize_results(response: Dict[str, Any]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    raw_results = response.get("news", {}).get("results", []) + response.get("web", {}).get("results", [])

    for idx, result in enumerate(raw_results):
        if not isinstance(result, dict):
            continue

        url = str(result.get("url", "")).strip()
        if not url:
            continue

        domain = _normalize_domain(url)
        if domain in EXCLUDED_DOMAINS:
            continue

        title = _clean_html(str(result.get("title", "")).strip())
        snippet = _clean_html(str(result.get("description", "")).strip())
        if not title and not snippet:
            continue

        date_value = _parse_brave_date(result.get("age"), result.get("page_age"))
        items.append(
            {
                "id": f"W{idx + 1}",
                "title": title[:200],
                "url": url,
                "source_domain": domain,
                "snippet": snippet[:500],
                "date": date_value,
                "date_confidence": "med" if date_value else "low",
                "relevance": 0.6,
                "why_relevant": "",
            }
        )

    return items


def _normalize_llm_context(response: Dict[str, Any]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    grounding = response.get("grounding", {})
    sources = response.get("sources", {})

    for idx, result in enumerate(grounding.get("generic", [])):
        if not isinstance(result, dict):
            continue

        url = str(result.get("url", "")).strip()
        if not url:
            continue

        domain = _normalize_domain(url)
        if domain in EXCLUDED_DOMAINS:
            continue

        title = str(result.get("title", "")).strip()
        snippets = result.get("snippets", [])
        snippet = "\n".join(str(item).strip() for item in snippets if item)
        if not title and not snippet:
            continue

        source_meta = sources.get(url, {})
        age_list = source_meta.get("age") or []
        date_value = None
        for age in age_list:
            date_value = _parse_brave_date(age, None)
            if date_value:
                break

        items.append(
            {
                "id": f"W{idx + 1}",
                "title": title[:200],
                "url": url,
                "source_domain": str(source_meta.get("hostname") or domain),
                "snippet": snippet[:1500],
                "date": date_value,
                "date_confidence": "med" if date_value else "low",
                "relevance": 0.7,
                "why_relevant": "",
            }
        )

    return items


def search_web(
    *,
    topic: str,
    from_date: str,
    to_date: str,
    api_key: str,
    depth: str = "default",
    use_llm_context: bool = False,
) -> List[Dict[str, Any]]:
    days = _days_between(from_date, to_date)
    freshness = _brave_freshness(days)

    if use_llm_context:
        params: Dict[str, Any] = {
            "q": topic,
            "count": DEPTH_LLM_COUNT.get(depth, DEPTH_LLM_COUNT["default"]),
            "maximum_number_of_tokens": DEPTH_LLM_MAX_TOKENS.get(depth, DEPTH_LLM_MAX_TOKENS["default"]),
            "context_threshold_mode": "balanced",
        }
        endpoint = LLM_CONTEXT_ENDPOINT
    else:
        params = {
            "q": topic,
            "result_filter": "web,news",
            "count": DEPTH_RESULT_COUNT.get(depth, DEPTH_RESULT_COUNT["default"]),
            "safesearch": "strict",
            "text_decorations": 0,
            "spellcheck": 0,
        }
        endpoint = ENDPOINT

    if freshness:
        params["freshness"] = freshness

    response = request(
        "GET",
        f"{endpoint}?{urlencode(params)}",
        headers={"X-Subscription-Token": api_key},
        timeout=30 if use_llm_context else 15,
    )
    return _normalize_llm_context(response) if use_llm_context else _normalize_results(response)


class BraveSearchToolkit(BaseToolkit):
    """Web search toolkit powered by Brave Search API."""

    name: str = "brave_search"

    def __init__(
        self,
        api_key: Optional[str] = None,
        use_llm_context: bool = False,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.api_key = api_key
        self.use_llm_context = use_llm_context

    @tool(parse_docstring=True)
    async def brave_search_web(
        self,
        topic: str,
        from_date: str,
        to_date: str,
        depth: str = "default",
        api_key: Optional[str] = None,
        use_llm_context: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """Search web content via Brave Search and return normalized items.

        Args:
            topic: Search query in natural language.
            from_date: Start date in YYYY-MM-DD format.
            to_date: End date in YYYY-MM-DD format.
            depth: Search depth, one of quick, default, deep.
            api_key: Optional Brave Search API key override.
            use_llm_context: Use Brave's LLM context endpoint for richer snippets.
        """
        selected_api_key = (api_key or self.api_key or "").strip()
        if not selected_api_key:
            raise ValueError("Missing Brave Search API key. Configure api_key in tool config.")

        selected_depth = (depth or "default").strip().lower()
        if selected_depth not in DEPTH_RESULT_COUNT:
            selected_depth = "default"

        items = await asyncio.to_thread(
            search_web,
            topic=topic,
            from_date=from_date,
            to_date=to_date,
            api_key=selected_api_key,
            depth=selected_depth,
            use_llm_context=self.use_llm_context if use_llm_context is None else use_llm_context,
        )
        return {"items": items}
