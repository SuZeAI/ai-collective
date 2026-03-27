from __future__ import annotations

from typing import Any, Dict, Optional

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit

REDDIT_MESSAGES = [
    "Diving into Reddit threads...",
    "Scanning subreddits for gold...",
    "Reading what Redditors are saying...",
    "Exploring the front page of the internet...",
]

X_MESSAGES = [
    "Checking what X is buzzing about...",
    "Reading the timeline...",
    "Finding the hot takes...",
    "Scanning tweets and threads...",
]

YOUTUBE_MESSAGES = [
    "Searching YouTube for videos...",
    "Finding relevant video content...",
    "Scanning YouTube channels...",
]

PROCESSING_MESSAGES = [
    "Crunching the data...",
    "Scoring and ranking...",
    "Finding patterns...",
    "Removing duplicates...",
]


def _is_truthy(value: Any) -> bool:
    return bool(value)


def _build_nux_message(diag: Optional[Dict[str, Any]] = None) -> str:
    if diag:
        reddit = "✓" if (_is_truthy(diag.get("openai")) or _is_truthy(diag.get("reddit_public"))) else "✗"
        x_source = "✓" if _is_truthy(diag.get("x_source")) else "✗"
        youtube = "✓" if _is_truthy(diag.get("youtube")) else "✗"
        web = "✓" if _is_truthy(diag.get("web_search_backend")) else "✗"
        status_line = f"Reddit {reddit}, X {x_source}, YouTube {youtube}, Web {web}"
    else:
        status_line = "YouTube ✓, Web ✓, Reddit ✗, X ✗"

    return (
        "I just researched that for you. Here's what I've got right now:\n\n"
        f"{status_line}\n\n"
        "You can unlock more sources with API keys or by signing in to Codex. "
        "More sources means better research, but it works fine as-is."
    )


class UIToolkit(BaseToolkit):
    """UI helper toolkit for /last30days style status text."""

    name: str = "ui"

    @tool(parse_docstring=True)
    async def ui_get_phase_messages(self, phase: str) -> list[str]:
        """Get canned status messages for a research phase.

        Args:
            phase: One of reddit, x, youtube, processing.
        """
        phase_key = (phase or "").strip().lower()
        mapping: Dict[str, list[str]] = {
            "reddit": REDDIT_MESSAGES,
            "x": X_MESSAGES,
            "youtube": YOUTUBE_MESSAGES,
            "processing": PROCESSING_MESSAGES,
        }
        return mapping.get(phase_key, [])

    @tool(parse_docstring=True)
    async def ui_build_nux_message(self, diag: Optional[Dict[str, Any]] = None) -> str:
        """Build onboarding text showing enabled and missing data sources.

        Args:
            diag: Optional diagnostics dict. Supported keys: openai, reddit_public,
                x_source, youtube, web_search_backend.
        """
        return _build_nux_message(diag)

    @tool(parse_docstring=True)
    async def ui_build_source_status(self, diag: Dict[str, Any]) -> str:
        """Build a plain-text source status summary from diagnostics.

        Args:
            diag: Diagnostics dict with source availability flags.
        """
        has_openai = _is_truthy(diag.get("openai"))
        has_reddit_public = _is_truthy(diag.get("reddit_public"))
        has_reddit = has_openai or has_reddit_public
        has_x = _is_truthy(diag.get("x_source"))
        has_youtube = _is_truthy(diag.get("youtube"))
        has_xiaohongshu = _is_truthy(diag.get("xiaohongshu"))
        has_web = _is_truthy(diag.get("web_search_backend"))

        lines = [
            "/last30days v2.1 - Source Status",
            f"Reddit: {'available' if has_reddit else 'missing'}",
            f"X/Twitter: {'available' if has_x else 'missing'}",
            f"YouTube: {'available' if has_youtube else 'missing'}",
            f"Xiaohongshu: {'available' if has_xiaohongshu else 'missing'}",
            f"Web: {'available' if has_web else 'fallback'}",
            "Config: ~/.config/last30days/.env",
        ]
        return "\n".join(lines)
