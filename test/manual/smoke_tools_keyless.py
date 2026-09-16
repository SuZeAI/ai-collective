"""
Direct (no LLM, no HTTP server) smoke test for the built-in tool toolkits that
need no per-tool API key: websearch (DuckDuckGo), hackernews, polymarket,
youtube, xiaohongshu, http. Calls each toolkit's real network-hitting method
straight from Python to confirm parsing + the external API still work, ahead
of the more expensive LLM-in-the-loop tool-calling checks.

Usage: python3 test/manual/smoke_tools_keyless.py
"""
import asyncio
import traceback


async def run(label, coro):
    print(f"\n=== {label} ===")
    try:
        result = await coro
        text = str(result)
        print("OK:", text[:400])
    except Exception:
        print("FAILED:")
        traceback.print_exc()


async def main():
    from server.domain.tools.websearch import WebSearchToolkit
    from server.domain.tools.hackernews import HackerNewsToolkit
    from server.domain.tools.polymarket import PolymarketToolkit
    from server.domain.tools.youtube import YouTubeToolkit
    from server.domain.tools.xiaohongshu import XiaohongshuToolkit
    from server.domain.tools.http import HTTPToolkit

    ws = WebSearchToolkit()
    await run("websearch (duckduckgo)", ws.websearch_duckduckgo_run.coroutine(ws, query="AI Collective LangGraph"))

    hn = HackerNewsToolkit()
    await run("hackernews", hn.hackernews_search.coroutine(hn, topic="LangGraph agents", from_date="2026-01-01", to_date="2026-09-16", depth="quick"))

    pm = PolymarketToolkit()
    await run("polymarket", pm.polymarket_search.coroutine(pm, topic="US election", from_date="2026-01-01", to_date="2026-09-16", depth="quick"))

    yt = YouTubeToolkit()
    await run("youtube", yt.youtube_search.coroutine(yt, topic="LangGraph tutorial", from_date="2026-01-01", to_date="2026-09-16", depth="quick"))

    xhs = XiaohongshuToolkit()
    await run(
        "xiaohongshu (expected to fail: no base_url configured, not truly keyless)",
        xhs.xiaohongshu_search.coroutine(xhs, topic="AI agent", from_date="2026-01-01", to_date="2026-09-16", depth="quick"),
    )

    http_tk = HTTPToolkit()
    await run("http_get", http_tk.http_get.coroutine(http_tk, url="https://httpbin.org/get"))


if __name__ == "__main__":
    asyncio.run(main())
