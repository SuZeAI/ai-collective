from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, List, Optional
from urllib import error, request
from urllib.parse import urlparse

from langchain.tools import tool

from server.domain.tools.base import BaseToolkit

try:
    import requests as _requests
except ImportError:
    _requests = None

PARALLEL_SEARCH_ENDPOINT = "https://api.parallel.ai/v1beta/search"
DEFAULT_BETA_HEADER = "search-extract-2025-10-10"
DEPTH_MAX_RESULTS = {
    "quick": 8,
    "default": 15,
    "deep": 25,
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


class ParallelSearchAPIError(RuntimeError):
    pass


def _headers(api_key: str, beta_header: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "parallel-beta": beta_header,
        "Content-Type": "application/json",
        "User-Staff": "ai-collective/parallel-search-tool",
    }


def _request_json(
    payload: Dict[str, Any],
    *,
    api_key: str,
    beta_header: str,
    timeout: int = 30,
) -> Dict[str, Any]:
    if _requests is not None:
        try:
            resp = _requests.post(
                PARALLEL_SEARCH_ENDPOINT,
                json=payload,
                headers=_headers(api_key, beta_header),
                timeout=timeout,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            raise ParallelSearchAPIError(str(exc)) from exc

    req = request.Request(
        url=PARALLEL_SEARCH_ENDPOINT,
        method="POST",
        data=json.dumps(payload).encode("utf-8"),
        headers=_headers(api_key, beta_header),
    )
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except error.HTTPError as exc:
        message = f"Parallel API failed: HTTP {exc.code}"
        try:
            body = exc.read().decode("utf-8", errors="replace")
            if body:
                message = f"{message}: {body[:300]}"
        except Exception:
            pass
        raise ParallelSearchAPIError(message) from exc
    except (error.URLError, TimeoutError, ValueError) as exc:
        raise ParallelSearchAPIError(str(exc)) from exc


def search_web(
    *,
    topic: str,
    from_date: str,
    to_date: str,
    api_key: str,
    depth: str = "default",
    beta_header: str = DEFAULT_BETA_HEADER,
) -> List[Dict[str, Any]]:
    max_results = DEPTH_MAX_RESULTS.get(depth, DEPTH_MAX_RESULTS["default"])
    payload = {
        "objective": (
            f"Find recent blog posts, tutorials, news articles, and discussions "
            f"about {topic} from {from_date} to {to_date}. "
            f"Exclude reddit.com, x.com, and twitter.com."
        ),
        "max_results": max_results,
        "max_chars_per_result": 500,
    }

    response = _request_json(payload, api_key=api_key, beta_header=beta_header, timeout=30)
    return _normalize_results(response)


def _normalize_results(response: Dict[str, Any]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    results = response.get("results", [])
    if not isinstance(results, list):
        return items

    for idx, result in enumerate(results):
        if not isinstance(result, dict):
            continue

        url = str(result.get("url", "")).strip()
        if not url:
            continue

        try:
            domain = urlparse(url).netloc.lower()
            if domain in EXCLUDED_DOMAINS:
                continue
            if domain.startswith("www."):
                domain = domain[4:]
        except Exception:
            domain = ""

        title = str(result.get("title", "")).strip()
        snippet = str(
            result.get("excerpt", result.get("snippet", result.get("description", "")))
        ).strip()
        if not title and not snippet:
            continue

        raw_relevance = result.get("relevance_score", result.get("relevance", 0.6))
        try:
            relevance = min(1.0, max(0.0, float(raw_relevance)))
        except (TypeError, ValueError):
            relevance = 0.6

        date_value = result.get("published_date", result.get("date"))
        items.append(
            {
                "id": f"W{idx + 1}",
                "title": title[:200],
                "url": url,
                "source_domain": domain,
                "snippet": snippet[:500],
                "date": date_value,
                "date_confidence": "med" if date_value else "low",
                "relevance": relevance,
                "why_relevant": str(result.get("summary", "")).strip()[:200],
            }
        )

    return items


class ParallelSearchToolkit(BaseToolkit):
    """Web search toolkit powered by Parallel AI Search API."""

    name: str = "parallel_search"

    def __init__(
        self,
        api_key: Optional[str] = None,
        beta_header: str = DEFAULT_BETA_HEADER,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.api_key = api_key
        self.beta_header = beta_header or DEFAULT_BETA_HEADER

    @tool(parse_docstring=True)
    async def parallel_search_web(
        self,
        topic: str,
        from_date: str,
        to_date: str,
        depth: str = "default",
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Search web content via Parallel AI and return normalized items.

        Args:
            topic: Search query in natural language.
            from_date: Start date in YYYY-MM-DD format.
            to_date: End date in YYYY-MM-DD format.
            depth: Search depth, one of quick, default, deep.
            api_key: Optional Parallel API key override.
        """
        selected_api_key = (api_key or self.api_key or "").strip()
        if not selected_api_key:
            raise ValueError("Missing Parallel API key. Configure api_key in tool config.")

        selected_depth = (depth or "default").strip().lower()
        if selected_depth not in DEPTH_MAX_RESULTS:
            selected_depth = "default"

        items = await asyncio.to_thread(
            search_web,
            topic=topic,
            from_date=from_date,
            to_date=to_date,
            api_key=selected_api_key,
            depth=selected_depth,
            beta_header=self.beta_header,
        )
        return {"items": items}
