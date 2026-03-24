from __future__ import annotations

from typing import Any, Optional

from langchain.tools import tool
from pydantic import BaseModel, Field

from backend.domain.tools.base import BaseToolkit

from langchain_community.tools import DuckDuckGoSearchResults 
from langchain_community.utilities import DuckDuckGoSearchAPIWrapper 

class WebSearchItem(BaseModel):
    title: str
    url: str
    snippet: str


class WebSearchResult(BaseModel):
    engine: str = "duckduckgo"
    query: str
    total: int
    results: list[WebSearchItem] = Field(default_factory=list)


class WebSearchToolkit(BaseToolkit):
    """Web search toolkit using DuckDuckGo."""

    name: str = "websearch"

    @tool(parse_docstring=True)
    async def websearch_duckduckgo(
        self,
        query: str,
        max_results: int = 5,
        region: str = "wt-wt",
        safesearch: str = "moderate",
        timelimit: Optional[str] = None,
        backend: str = "text",
    ) -> WebSearchResult:
        """Search the web with DuckDuckGo and return structured results.

        Args:
            query: Search keywords in natural language.
            max_results: Maximum number of results to return.
            region: Region code, for example wt-wt, us-en, vn-vi.
            safesearch: Safe search level, one of off, moderate, strict.
            timelimit: Optional freshness filter, one of d, w, m, y.
            backend: Search backend, for example text or news.
        """
        if DuckDuckGoSearchResults is None or DuckDuckGoSearchAPIWrapper is None:
            raise RuntimeError(
                "langchain-community is not installed. Install 'langchain-community' and 'duckduckgo-search' to use websearch_duckduckgo."
            )

        capped_results = max(1, min(max_results, 20))
        wrapper = DuckDuckGoSearchAPIWrapper(
            region=region,
            safesearch=safesearch,
            time=timelimit,
            max_results=capped_results,
        )
        search = DuckDuckGoSearchResults(
            api_wrapper=wrapper,
            output_format="list",
            backend=backend,
        )

        rows: list[dict[str, Any]] = search.invoke(query)

        parsed = [
            WebSearchItem(
                title=(item.get("title") or "").strip(),
                url=(item.get("link") or item.get("href") or "").strip(),
                snippet=(item.get("body") or "").strip(),
            )
            for item in rows
        ]

        return WebSearchResult(query=query, total=len(parsed), results=parsed)