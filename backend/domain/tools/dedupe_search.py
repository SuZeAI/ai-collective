from __future__ import annotations

from typing import Any, Dict, List
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from langchain.tools import tool
from pydantic import BaseModel, Field

from backend.domain.tools.base import BaseToolkit


TRACKING_QUERY_PREFIXES = (
    "utm_",
    "fbclid",
    "gclid",
    "igshid",
    "mc_",
)


class DedupeSearchResult(BaseModel):
    total_input: int
    total_output: int
    removed_count: int
    deduped_items: list[Dict[str, Any]] = Field(default_factory=list)


def _clean_text(value: str) -> str:
    return " ".join((value or "").strip().lower().split())


def _canonicalize_url(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        return ""

    try:
        parts = urlsplit(raw)
    except Exception:
        return raw.lower().rstrip("/")

    scheme = (parts.scheme or "https").lower()
    netloc = (parts.netloc or "").lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]

    path = parts.path.rstrip("/")

    query_pairs = parse_qsl(parts.query, keep_blank_values=False)
    filtered_query = [
        (k, v)
        for k, v in query_pairs
        if not any(k.lower().startswith(prefix) for prefix in TRACKING_QUERY_PREFIXES)
    ]
    filtered_query.sort(key=lambda kv: (kv[0], kv[1]))
    query = urlencode(filtered_query, doseq=True)

    return urlunsplit((scheme, netloc, path, query, ""))


def _canonical_item_key(item: Dict[str, Any]) -> str:
    url = _canonicalize_url(str(item.get("url", "")))
    if url:
        return f"url:{url}"

    title = _clean_text(str(item.get("title", "")))
    snippet = _clean_text(str(item.get("snippet", item.get("description", ""))))
    if title or snippet:
        return f"text:{title}|{snippet}"

    return ""


class DedupeSearchToolkit(BaseToolkit):
    """Toolkit for deduplicating generic search results."""

    name: str = "dedupe_search"

    @tool(parse_docstring=True)
    async def dedupe_search_items(
        self,
        items: List[Dict[str, Any]],
    ) -> DedupeSearchResult:
        """Remove duplicate entries from search results.

        Dedupe strategy priority:
        1. Canonicalized URL
        2. Normalized title + snippet text when URL is missing

        Args:
            items: List of search result objects. Typical fields: title, url, snippet.
        """
        seen: set[str] = set()
        deduped: list[Dict[str, Any]] = []

        for item in items:
            if not isinstance(item, dict):
                continue

            key = _canonical_item_key(item)
            if key and key in seen:
                continue

            if key:
                seen.add(key)
            deduped.append(item)

        total_input = len(items)
        total_output = len(deduped)
        return DedupeSearchResult(
            total_input=total_input,
            total_output=total_output,
            removed_count=max(0, total_input - total_output),
            deduped_items=deduped,
        )