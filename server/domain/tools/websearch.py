from __future__ import annotations

from typing import Any, Optional

from langchain.tools import tool
from pydantic import BaseModel, Field

from server.domain.tools.base import BaseToolkit

from langchain_community.tools import DuckDuckGoSearchRun
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
    def __init__(self, provider: str = "duckduckgo", region: str = "wt-wt", safesearch: str = "moderate", **kwargs: Any):
        super().__init__(**kwargs)
        self.provider = provider
        self.region = region
        self.safesearch = safesearch

    @tool(parse_docstring=True)
    async def websearch_duckduckgo_run(
        self,
        query: str,
        region: str = "wt-wt",
        safesearch: str = "moderate",
        timelimit: Optional[str] = None,
    ) -> str:
        """Search the web with DuckDuckGo and return a plain text result.

        Args:
            query: Search keywords in natural language.
            region: Region code, for example wt-wt, us-en, vn-vi.
            safesearch: Safe search level, one of off, moderate, strict.
            timelimit: Optional freshness filter, one of d, w, m, y.
        """
        if DuckDuckGoSearchRun is None or DuckDuckGoSearchAPIWrapper is None:
            raise RuntimeError(
                "langchain-community is not installed. Install 'langchain-community' and 'duckduckgo-search' to use websearch_duckduckgo_run."
            )

        wrapper = DuckDuckGoSearchAPIWrapper(
            region=region,
            safesearch=safesearch,
            time=timelimit,
        )
        search = DuckDuckGoSearchRun(api_wrapper=wrapper)
        return search.invoke(query)
