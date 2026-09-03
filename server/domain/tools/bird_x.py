from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import signal
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from langchain.tools import tool

from server.domain.tools.base import BaseToolkit
from server.api.settings import settings

DEPTH_CONFIG: dict[str, int] = {
    "quick": 12,
    "default": 30,
    "deep": 60,
}


def _default_bird_search_mjs() -> Path:
    return (
        Path(__file__).resolve().parents[3]
        / "context"
        / "tools"
        / "last30days-skill"
        / "scripts"
        / "lib"
        / "vendor"
        / "bird-search"
        / "bird-search.mjs"
    )


def _tokenize(text: str) -> set[str]:
    return {w for w in re.sub(r"[^\w\s]", " ", (text or "").lower()).split() if len(w) > 1}


def _compute_relevance(query: str, text: str) -> float:
    query_tokens = _tokenize(query)
    text_tokens = _tokenize(text)
    if not query_tokens:
        return 0.7

    overlap = len(query_tokens & text_tokens)
    return round(min(1.0, max(0.0, overlap / len(query_tokens))), 2)


def _extract_core_subject(topic: str) -> str:
    text = (topic or "").lower().strip().rstrip("?!.")
    if not text:
        return ""

    prefixes = [
        "what are the best",
        "what is the best",
        "what are the latest",
        "what are people saying about",
        "what do people think about",
        "how do i use",
        "how to use",
        "how to",
        "what are",
        "what is",
        "tips for",
        "best practices for",
    ]
    for prefix in prefixes:
        if text.startswith(prefix + " "):
            text = text[len(prefix):].strip()

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
        "tips",
    }
    words = [w for w in text.split() if w not in noise]
    core = " ".join(words) if words else text
    # X search is mostly keyword-based; keep it concise.
    return " ".join(core.split()[:5]).strip()


def _subprocess_env(auth_token: str, ct0: str) -> Dict[str, str]:
    env = os.environ.copy()
    if auth_token:
        env["AUTH_TOKEN"] = auth_token
    if ct0:
        env["CT0"] = ct0
    if auth_token and ct0:
        env.setdefault("BIRD_DISABLE_BROWSER_COOKIES", "1")
    return env


def _run_bird_search(
    *,
    bird_search_mjs: Path,
    query: str,
    count: int,
    timeout: int,
    auth_token: str,
    ct0: str,
) -> Dict[str, Any]:
    cmd = ["node", str(bird_search_mjs), query, "--count", str(count), "--json"]
    preexec = os.setsid if hasattr(os, "setsid") else None

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            preexec_fn=preexec,
            env=_subprocess_env(auth_token, ct0),
        )
        try:
            stdout, stderr = proc.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            except (ProcessLookupError, PermissionError, OSError):
                proc.kill()
            proc.wait(timeout=5)
            return {"error": f"Search timed out after {timeout}s", "items": []}

        if proc.returncode != 0:
            return {"error": (stderr or "Bird search failed").strip(), "items": []}

        output = (stdout or "").strip()
        if not output:
            return {"items": []}
        return json.loads(output)

    except json.JSONDecodeError as exc:
        return {"error": f"Invalid JSON response: {exc}", "items": []}
    except FileNotFoundError:
        return {"error": "Node.js is not installed or not in PATH", "items": []}
    except Exception as exc:
        return {"error": str(exc), "items": []}


def parse_bird_response(response: Dict[str, Any], query: str = "") -> List[Dict[str, Any]]:
    if response.get("error"):
        return []

    raw_items = response if isinstance(response, list) else response.get("items", response.get("tweets", []))
    if not isinstance(raw_items, list):
        return []

    items: List[Dict[str, Any]] = []
    for i, tweet in enumerate(raw_items):
        if not isinstance(tweet, dict):
            continue

        url = str(tweet.get("permanent_url") or tweet.get("url") or "").strip()
        if not url and tweet.get("id"):
            author = tweet.get("author", {}) or tweet.get("user", {})
            if isinstance(author, dict):
                screen_name = str(author.get("username") or author.get("screen_name") or "")
                if screen_name:
                    url = f"https://x.com/{screen_name}/status/{tweet['id']}"
        if not url:
            continue

        created_at = tweet.get("createdAt") or tweet.get("created_at")
        date_value: Optional[str] = None
        if isinstance(created_at, str) and created_at.strip():
            try:
                if len(created_at) > 10 and created_at[10] == "T":
                    dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                else:
                    dt = datetime.strptime(created_at, "%a %b %d %H:%M:%S %z %Y")
                date_value = dt.strftime("%Y-%m-%d")
            except (ValueError, TypeError):
                date_value = None

        author = tweet.get("author", {}) or tweet.get("user", {})
        if not isinstance(author, dict):
            author = {}
        author_handle = str(author.get("username") or author.get("screen_name") or tweet.get("author_handle") or "")

        engagement = {
            "likes": tweet.get("likeCount") or tweet.get("like_count") or tweet.get("favorite_count"),
            "reposts": tweet.get("retweetCount") or tweet.get("retweet_count"),
            "replies": tweet.get("replyCount") or tweet.get("reply_count"),
            "quotes": tweet.get("quoteCount") or tweet.get("quote_count"),
        }
        for key in engagement:
            if engagement[key] is None:
                continue
            try:
                engagement[key] = int(engagement[key])
            except (TypeError, ValueError):
                engagement[key] = None

        text = str(tweet.get("text", tweet.get("full_text", ""))).strip()
        items.append(
            {
                "id": f"X{i + 1}",
                "text": text[:500],
                "url": url,
                "author_handle": author_handle.lstrip("@"),
                "date": date_value,
                "engagement": engagement if any(v is not None for v in engagement.values()) else None,
                "why_relevant": "",
                "relevance": _compute_relevance(query, text) if query else 0.7,
            }
        )

    return items


def search_x(
    *,
    topic: str,
    from_date: str,
    to_date: str,
    depth: str,
    auth_token: str,
    ct0: str,
    bird_search_mjs: Path,
) -> Dict[str, Any]:
    del to_date

    if not bird_search_mjs.exists():
        return {"error": f"bird-search.mjs not found at {bird_search_mjs}", "items": []}
    if shutil.which("node") is None:
        return {"error": "Node.js is required for bird_x_search", "items": []}

    count = DEPTH_CONFIG.get(depth, DEPTH_CONFIG["default"])
    timeout = 30 if depth == "quick" else 45 if depth == "default" else 60
    core_topic = _extract_core_subject(topic)

    query = f"{core_topic} since:{from_date}"
    response = _run_bird_search(
        bird_search_mjs=bird_search_mjs,
        query=query,
        count=count,
        timeout=timeout,
        auth_token=auth_token,
        ct0=ct0,
    )

    items = parse_bird_response(response, query=core_topic)
    if not items and len(core_topic.split()) > 2:
        shorter = " ".join(core_topic.split()[:2])
        retry_query = f"{shorter} since:{from_date}"
        response = _run_bird_search(
            bird_search_mjs=bird_search_mjs,
            query=retry_query,
            count=count,
            timeout=timeout,
            auth_token=auth_token,
            ct0=ct0,
        )

    return response


class BirdXToolkit(BaseToolkit):
    """X/Twitter search toolkit via vendored Bird GraphQL client."""

    name: str = "bird_x"

    def __init__(
        self,
        auth_token: Optional[str] = None,
        ct0: Optional[str] = None,
        bird_search_mjs: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.auth_token = (auth_token or "").strip()
        self.ct0 = (ct0 or "").strip()
        configured_path = (bird_search_mjs or settings.tools.bird.bird_search_mjs).strip()
        self.bird_search_mjs = Path(configured_path) if configured_path else _default_bird_search_mjs()

    @tool(parse_docstring=True)
    async def bird_x_search(
        self,
        topic: str,
        from_date: str,
        to_date: str,
        depth: str = "default",
        auth_token: Optional[str] = None,
        ct0: Optional[str] = None,
        bird_search_mjs: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Search X (Twitter) via Bird GraphQL and return normalized items.

        Args:
            topic: Search query in natural language.
            from_date: Start date in YYYY-MM-DD format.
            to_date: End date in YYYY-MM-DD format.
            depth: Search depth, one of quick, default, deep.
            auth_token: Optional X AUTH_TOKEN cookie override.
            ct0: Optional X CT0 cookie override.
            bird_search_mjs: Optional path override to bird-search.mjs.
        """
        selected_auth_token = (auth_token or self.auth_token or "").strip()
        selected_ct0 = (ct0 or self.ct0 or "").strip()
        selected_path = (
            Path(bird_search_mjs).expanduser().resolve()
            if (bird_search_mjs or "").strip()
            else self.bird_search_mjs
        )

        raw = await asyncio.to_thread(
            search_x,
            topic=topic,
            from_date=from_date,
            to_date=to_date,
            depth=depth,
            auth_token=selected_auth_token,
            ct0=selected_ct0,
            bird_search_mjs=selected_path,
        )

        result: Dict[str, Any] = {"items": parse_bird_response(raw, query=_extract_core_subject(topic))}
        if raw.get("error"):
            result["error"] = raw["error"]
        return result