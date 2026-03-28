from __future__ import annotations

import asyncio
import json
import os
import re
from typing import Any, Dict, List, Optional
from urllib import error, request
from urllib.parse import urlparse

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit

try:
    import requests as _requests
except ImportError:
    _requests = None

OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "perplexity/sonar-pro"
DEPTH_MAX_TOKENS = {
    "quick": 1024,
    "default": 2048,
    "deep": 4096,
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


class OpenRouterSearchAPIError(RuntimeError):
    pass


def _headers(api_key: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://github.com/mvanhorn/last30days-openclaw",
        "X-Title": "last30days",
        "Content-Type": "application/json",
        "User-Agent": "ai-collective/openrouter-search-tool",
    }


def _request_json(
    payload: Dict[str, Any],
    *,
    api_key: str,
    timeout: int = 30,
) -> Dict[str, Any]:
    if _requests is not None:
        try:
            resp = _requests.post(
                OPENROUTER_ENDPOINT,
                json=payload,
                headers=_headers(api_key),
                timeout=timeout,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            raise OpenRouterSearchAPIError(str(exc)) from exc

    req = request.Request(
        url=OPENROUTER_ENDPOINT,
        method="POST",
        data=json.dumps(payload).encode("utf-8"),
        headers=_headers(api_key),
    )
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except error.HTTPError as exc:
        message = f"OpenRouter API failed: HTTP {exc.code}"
        try:
            body = exc.read().decode("utf-8", errors="replace")
            if body:
                message = f"{message}: {body[:300]}"
        except Exception:
            pass
        raise OpenRouterSearchAPIError(message) from exc
    except (error.URLError, TimeoutError, ValueError) as exc:
        raise OpenRouterSearchAPIError(str(exc)) from exc


def search_web(
    *,
    topic: str,
    from_date: str,
    to_date: str,
    api_key: str,
    depth: str = "default",
    model: str = DEFAULT_MODEL,
) -> List[Dict[str, Any]]:
    max_tokens = DEPTH_MAX_TOKENS.get(depth, DEPTH_MAX_TOKENS["default"])

    prompt = (
        f"Find recent blog posts, news articles, tutorials, and discussions "
        f"about {topic} published between {from_date} and {to_date}. "
        f"Exclude results from reddit.com, x.com, and twitter.com. "
        f"For each result, provide the title, URL, publication date, "
        f"and a brief summary of why it's relevant."
    )

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
    }

    response = _request_json(payload, api_key=api_key, timeout=30)
    return _normalize_results(response)


def _normalize_results(response: Dict[str, Any]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []

    search_results = response.get("search_results", [])
    if isinstance(search_results, list) and search_results:
        items = _parse_search_results(search_results)

    if not items:
        citations = response.get("citations", [])
        content = _get_content(response)
        if isinstance(citations, list) and citations:
            items = _parse_citations(citations, content)

    return items


def _parse_search_results(results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []

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
        if not title:
            continue

        date_value = result.get("date")
        snippet = str(result.get("snippet", result.get("description", ""))).strip()

        items.append(
            {
                "id": f"W{idx + 1}",
                "title": title[:200],
                "url": url,
                "source_domain": domain,
                "snippet": snippet[:500],
                "date": date_value,
                "date_confidence": "med" if date_value else "low",
                "relevance": 0.7,
                "why_relevant": "",
            }
        )

    return items


def _parse_citations(citations: List[str], content: str) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []

    for idx, url in enumerate(citations):
        if not isinstance(url, str) or not url:
            continue

        try:
            domain = urlparse(url).netloc.lower()
            if domain in EXCLUDED_DOMAINS:
                continue
            if domain.startswith("www."):
                domain = domain[4:]
        except Exception:
            domain = ""

        title = _extract_title_for_citation(content, idx + 1) or domain

        items.append(
            {
                "id": f"W{idx + 1}",
                "title": title[:200],
                "url": url,
                "source_domain": domain,
                "snippet": "",
                "date": None,
                "date_confidence": "low",
                "relevance": 0.6,
                "why_relevant": "",
            }
        )

    return items


def _get_content(response: Dict[str, Any]) -> str:
    try:
        return str(response["choices"][0]["message"]["content"])
    except (KeyError, IndexError, TypeError):
        return ""


def _extract_title_for_citation(content: str, index: int) -> Optional[str]:
    if not content:
        return None

    pattern = rf"\[{index}\][)\s]*([^\[\n]{{5,80}})"
    match = re.search(pattern, content)
    if not match:
        return None

    title = match.group(1).strip().rstrip(".")
    title = re.sub(r"[*_`]", "", title)
    return title if len(title) > 3 else None


class OpenRouterSearchToolkit(BaseToolkit):
    """Web search toolkit powered by OpenRouter Perplexity Sonar Pro."""

    name: str = "openrouter_search"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = DEFAULT_MODEL,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY", "")
        self.model = model or DEFAULT_MODEL

    @tool(parse_docstring=True)
    async def openrouter_search_web(
        self,
        topic: str,
        from_date: str,
        to_date: str,
        depth: str = "default",
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Search web content via OpenRouter Sonar Pro and return normalized items.

        Args:
            topic: Search query in natural language.
            from_date: Start date in YYYY-MM-DD format.
            to_date: End date in YYYY-MM-DD format.
            depth: Search depth, one of quick, default, deep.
            api_key: Optional OpenRouter API key override.
            model: Optional model override, default is perplexity/sonar-pro.
        """
        selected_api_key = (api_key or self.api_key or "").strip()
        if not selected_api_key:
            raise ValueError(
                "Missing OpenRouter API key. Set OPENROUTER_API_KEY or pass api_key in tool config."
            )

        selected_depth = (depth or "default").strip().lower()
        if selected_depth not in DEPTH_MAX_TOKENS:
            selected_depth = "default"

        selected_model = (model or self.model or DEFAULT_MODEL).strip() or DEFAULT_MODEL

        items = await asyncio.to_thread(
            search_web,
            topic=topic,
            from_date=from_date,
            to_date=to_date,
            api_key=selected_api_key,
            depth=selected_depth,
            model=selected_model,
        )

        return {"items": items}
