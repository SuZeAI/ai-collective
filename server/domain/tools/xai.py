from __future__ import annotations

import asyncio
import json
import re
from typing import Any, Dict, List, Optional
from urllib import error, request

from langchain.tools import tool

from server.domain.tools.base import BaseToolkit
from server.api.settings import settings

XAI_RESPONSES_URL = "https://api.x.ai/v1/responses"

DEPTH_CONFIG: dict[str, tuple[int, int]] = {
    "quick": (8, 12),
    "default": (20, 30),
    "deep": (40, 60),
}

X_SEARCH_PROMPT = """You have access to real-time X (Twitter) data. Search for posts about: {topic}

Focus on posts from {from_date} to {to_date}. Find {min_items}-{max_items} high-quality, relevant posts.

IMPORTANT: Return ONLY valid JSON in this exact format, no other text:
{{
  "items": [
    {{
      "text": "Post text content (truncated if long)",
      "url": "https://x.com/user/status/...",
      "author_handle": "username",
      "date": "YYYY-MM-DD or null if unknown",
      "engagement": {{
        "likes": 100,
        "reposts": 25,
        "replies": 15,
        "quotes": 5
      }},
      "why_relevant": "Brief explanation of relevance",
      "relevance": 0.85
    }}
  ]
}}

Rules:
- relevance is 0.0 to 1.0 (1.0 = highly relevant)
- date must be YYYY-MM-DD format or null
- engagement can be null if unknown
- Include diverse voices/accounts if applicable
- Prefer posts with substantive content, not just links"""


class XAIAPIError(RuntimeError):
    pass


def _request_json(
    url: str,
    payload: Dict[str, Any],
    *,
    api_key: str,
    timeout: int,
) -> Dict[str, Any]:
    req = request.Request(
        url=url,
        method="POST",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )

    try:
        with request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except error.HTTPError as exc:
        message = f"xAI API HTTP {exc.code}"
        try:
            body = exc.read().decode("utf-8", errors="replace")
            if body:
                message = f"{message}: {body[:300]}"
        except Exception:
            pass
        raise XAIAPIError(message) from exc
    except (error.URLError, TimeoutError, ValueError) as exc:
        raise XAIAPIError(str(exc)) from exc


def search_x(
    *,
    api_key: str,
    model: str,
    topic: str,
    from_date: str,
    to_date: str,
    depth: str = "default",
) -> Dict[str, Any]:
    min_items, max_items = DEPTH_CONFIG.get(depth, DEPTH_CONFIG["default"])
    timeout = 90 if depth == "quick" else 120 if depth == "default" else 180

    payload = {
        "model": model,
        "tools": [{"type": "x_search", "from_date": from_date, "to_date": to_date}],
        "input": [
            {
                "role": "user",
                "content": X_SEARCH_PROMPT.format(
                    topic=topic,
                    from_date=from_date,
                    to_date=to_date,
                    min_items=min_items,
                    max_items=max_items,
                ),
            }
        ],
    }

    return _request_json(XAI_RESPONSES_URL, payload, api_key=api_key, timeout=timeout)


def _parse_engagement(raw: Any) -> Optional[Dict[str, Optional[int]]]:
    if not isinstance(raw, dict):
        return None

    def _to_int_or_none(value: Any) -> Optional[int]:
        if value is None:
            return None
        text = str(value).strip()
        if text == "":
            return None
        try:
            return int(float(text))
        except (TypeError, ValueError):
            return None

    return {
        "likes": _to_int_or_none(raw.get("likes")),
        "reposts": _to_int_or_none(raw.get("reposts")),
        "replies": _to_int_or_none(raw.get("replies")),
        "quotes": _to_int_or_none(raw.get("quotes")),
    }


def parse_x_response(response: Dict[str, Any]) -> List[Dict[str, Any]]:
    if "error" in response and response["error"]:
        return []

    output_text = ""
    output = response.get("output")
    if isinstance(output, str):
        output_text = output
    elif isinstance(output, list):
        for row in output:
            if isinstance(row, dict) and row.get("type") == "message":
                content = row.get("content", [])
                if isinstance(content, list):
                    for chunk in content:
                        if isinstance(chunk, dict) and chunk.get("type") == "output_text":
                            output_text = str(chunk.get("text", ""))
                            break
            elif isinstance(row, dict) and "text" in row:
                output_text = str(row.get("text", ""))
            elif isinstance(row, str):
                output_text = row

            if output_text:
                break

    if not output_text and isinstance(response.get("choices"), list):
        for choice in response["choices"]:
            if isinstance(choice, dict) and isinstance(choice.get("message"), dict):
                output_text = str(choice["message"].get("content", ""))
                if output_text:
                    break

    if not output_text:
        return []

    json_match = re.search(r'\{[\s\S]*"items"[\s\S]*\}', output_text)
    if not json_match:
        return []

    try:
        payload = json.loads(json_match.group())
    except json.JSONDecodeError:
        return []

    raw_items = payload.get("items", [])
    if not isinstance(raw_items, list):
        return []

    clean_items: List[Dict[str, Any]] = []
    for idx, item in enumerate(raw_items):
        if not isinstance(item, dict):
            continue

        url = str(item.get("url", "")).strip()
        if not url:
            continue

        text = str(item.get("text", "")).strip()[:500]
        author_handle = str(item.get("author_handle", "")).strip().lstrip("@")
        why_relevant = str(item.get("why_relevant", "")).strip()
        date_value = item.get("date")

        try:
            relevance = min(1.0, max(0.0, float(item.get("relevance", 0.5))))
        except (TypeError, ValueError):
            relevance = 0.5

        if date_value and not re.match(r"^\d{4}-\d{2}-\d{2}$", str(date_value)):
            date_value = None

        clean_items.append(
            {
                "id": f"X{idx + 1}",
                "text": text,
                "url": url,
                "author_handle": author_handle,
                "date": date_value,
                "engagement": _parse_engagement(item.get("engagement")),
                "why_relevant": why_relevant,
                "relevance": relevance,
            }
        )

    return clean_items


class XAIToolkit(BaseToolkit):
    """xAI-powered X (Twitter) search toolkit."""

    name: str = "xai"

    def __init__(self, api_key: Optional[str] = None, model: str = "grok-4-fast", **kwargs: Any):
        super().__init__(**kwargs)
        self.api_key = api_key
        self.model = model or settings.tools.xai.xai_model

    @tool(parse_docstring=True)
    async def xai_x_search(
        self,
        topic: str,
        from_date: str,
        to_date: str,
        depth: str = "default",
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Search X (Twitter) via xAI and return normalized items.

        Args:
            topic: Search query in natural language.
            from_date: Start date in YYYY-MM-DD format.
            to_date: End date in YYYY-MM-DD format.
            depth: Search depth, one of quick, default, deep.
            model: Optional xAI model override.
        """
        if not self.api_key:
            raise ValueError("Missing XAI API key. Configure api_key in tool config.")

        selected_model = model or self.model or "grok-4-fast"
        raw = await asyncio.to_thread(
            search_x,
            api_key=self.api_key,
            model=selected_model,
            topic=topic,
            from_date=from_date,
            to_date=to_date,
            depth=depth,
        )

        return {"items": parse_x_response(raw)}
