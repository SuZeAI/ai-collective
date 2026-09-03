from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import signal
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from langchain.tools import tool

from server.domain.tools.base import BaseToolkit

DEPTH_CONFIG = {
    "quick": 10,
    "default": 20,
    "deep": 40,
}

TRANSCRIPT_LIMITS = {
    "quick": 3,
    "default": 5,
    "deep": 8,
}

TRANSCRIPT_MAX_WORDS = 5000

_STOPWORDS = frozenset(
    {
        "the",
        "a",
        "an",
        "to",
        "for",
        "how",
        "is",
        "in",
        "of",
        "on",
        "and",
        "with",
        "from",
        "by",
        "at",
        "this",
        "that",
        "it",
        "my",
        "your",
        "i",
        "me",
        "we",
        "you",
        "what",
        "are",
        "do",
        "can",
        "its",
        "be",
        "or",
        "not",
        "no",
        "so",
        "if",
        "but",
        "about",
        "all",
        "just",
        "get",
        "has",
        "have",
        "was",
        "will",
    }
)

_YT_NOISE = frozenset(
    {
        "best",
        "top",
        "good",
        "great",
        "awesome",
        "killer",
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
        "prompt",
        "prompts",
        "prompting",
        "methods",
        "strategies",
        "approaches",
    }
)


def is_ytdlp_installed() -> bool:
    return shutil.which("yt-dlp") is not None


def _extract_core_subject(topic: str) -> str:
    words = topic.lower().strip().split()
    filtered = [w for w in words if w not in _YT_NOISE]
    return " ".join(filtered) if filtered else topic.lower().strip()


def _tokenize(text: str) -> Set[str]:
    words = re.sub(r"[^\w\s]", " ", text.lower()).split()
    return {w for w in words if w not in _STOPWORDS and len(w) > 1}


def _compute_relevance(query: str, text: str) -> float:
    q_tokens = _tokenize(query)
    t_tokens = _tokenize(text)
    if not q_tokens:
        return 0.5
    overlap = len(q_tokens & t_tokens)
    if overlap == 0:
        return 0.0
    coverage = overlap / len(q_tokens)
    return round(min(1.0, coverage), 2)


def _clean_vtt(vtt_text: str) -> str:
    text = re.sub(r"^WEBVTT.*?\n\n", "", vtt_text, flags=re.DOTALL)
    text = re.sub(
        r"\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}.*\n",
        "",
        text,
    )
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"^\d+\s*$", "", text, flags=re.MULTILINE)

    lines = text.strip().split("\n")
    seen: Set[str] = set()
    unique: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped and stripped not in seen:
            seen.add(stripped)
            unique.append(stripped)

    return re.sub(r"\s+", " ", " ".join(unique)).strip()


def extract_transcript_highlights(transcript: str, topic: str, limit: int = 5) -> List[str]:
    if not transcript:
        return []

    sentences = re.split(r"(?<=[.!?])\s+", transcript)

    filler = [
        r"^(hey |hi |what's up|welcome back|in today's video|don't forget to)",
        r"(subscribe|like and comment|hit the bell|check out the link|down below)",
        r"^(so |and |but |okay |alright |um |uh )",
        r"(thanks for watching|see you (next|in the)|bye)",
    ]

    topic_words = [w.lower() for w in topic.lower().split() if len(w) > 2]

    candidates: list[tuple[int, str]] = []
    for sent in sentences:
        sent = sent.strip()
        words = sent.split()
        if len(words) < 8 or len(words) > 50:
            continue
        if any(re.search(p, sent, re.IGNORECASE) for p in filler):
            continue

        score = 0
        if re.search(r"\d", sent):
            score += 2
        if re.search(r"[A-Z][a-z]+", sent):
            score += 1
        if "?" in sent:
            score += 1

        sent_lower = sent.lower()
        if any(w in sent_lower for w in topic_words):
            score += 2

        candidates.append((score, sent))

    candidates.sort(key=lambda x: -x[0])
    return [sent for _, sent in candidates[:limit]]


def search_youtube(topic: str, from_date: str, to_date: str, depth: str = "default") -> Dict[str, Any]:
    if not is_ytdlp_installed():
        return {"items": [], "error": "yt-dlp not installed"}

    count = DEPTH_CONFIG.get(depth, DEPTH_CONFIG["default"])
    core_topic = _extract_core_subject(topic)

    cmd = [
        "yt-dlp",
        "--ignore-config",
        "--no-cookies-from-browser",
        f"ytsearch{count}:{core_topic}",
        "--dump-json",
        "--no-warnings",
        "--no-download",
    ]

    preexec = os.setsid if hasattr(os, "setsid") else None

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            preexec_fn=preexec,
        )
        try:
            stdout, _stderr = proc.communicate(timeout=120)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            except (ProcessLookupError, PermissionError, OSError):
                proc.kill()
            proc.wait(timeout=5)
            return {"items": [], "error": "Search timed out"}
    except FileNotFoundError:
        return {"items": [], "error": "yt-dlp not found"}

    if not (stdout or "").strip():
        return {"items": []}

    items: list[dict[str, Any]] = []
    for line in stdout.strip().split("\n"):
        line = line.strip()
        if not line:
            continue
        try:
            video = json.loads(line)
        except json.JSONDecodeError:
            continue

        video_id = video.get("id", "")
        upload_date = video.get("upload_date", "")
        date_str: str | None = None
        if upload_date and len(upload_date) == 8:
            date_str = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}"

        items.append(
            {
                "video_id": video_id,
                "title": video.get("title", ""),
                "url": f"https://www.youtube.com/watch?v={video_id}",
                "channel_name": video.get("channel", video.get("uploader", "")),
                "date": date_str,
                "engagement": {
                    "views": video.get("view_count") or 0,
                    "likes": video.get("like_count") or 0,
                    "comments": video.get("comment_count") or 0,
                },
                "duration": video.get("duration"),
                "relevance": _compute_relevance(core_topic, video.get("title", "")),
                "why_relevant": f"YouTube: {video.get('title', core_topic)[:60]}",
            }
        )

    recent = [
        i
        for i in items
        if i["date"] and from_date <= i["date"] <= to_date
    ]
    if len(recent) >= 3:
        items = recent

    items.sort(key=lambda x: x["engagement"]["views"], reverse=True)
    return {"items": items}


def fetch_transcript(video_id: str, temp_dir: str) -> Optional[str]:
    cmd = [
        "yt-dlp",
        "--ignore-config",
        "--no-cookies-from-browser",
        "--write-auto-subs",
        "--sub-lang",
        "en",
        "--sub-format",
        "vtt",
        "--skip-download",
        "--no-warnings",
        "-o",
        f"{temp_dir}/%(id)s",
        f"https://www.youtube.com/watch?v={video_id}",
    ]

    preexec = os.setsid if hasattr(os, "setsid") else None

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            preexec_fn=preexec,
        )
        try:
            proc.communicate(timeout=30)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            except (ProcessLookupError, PermissionError, OSError):
                proc.kill()
            proc.wait(timeout=5)
            return None
    except FileNotFoundError:
        return None

    vtt_path = Path(temp_dir) / f"{video_id}.en.vtt"
    if not vtt_path.exists():
        for p in Path(temp_dir).glob(f"{video_id}*.vtt"):
            vtt_path = p
            break
        else:
            return None

    try:
        raw = vtt_path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None

    transcript = _clean_vtt(raw)
    words = transcript.split()
    if len(words) > TRANSCRIPT_MAX_WORDS:
        transcript = " ".join(words[:TRANSCRIPT_MAX_WORDS]) + "..."

    return transcript if transcript else None


def fetch_transcripts_parallel(video_ids: List[str], max_workers: int = 5) -> Dict[str, Optional[str]]:
    if not video_ids:
        return {}

    results: Dict[str, Optional[str]] = {}
    with tempfile.TemporaryDirectory() as temp_dir:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(fetch_transcript, vid, temp_dir): vid for vid in video_ids}
            for future in as_completed(futures):
                vid = futures[future]
                try:
                    results[vid] = future.result()
                except Exception:
                    results[vid] = None

    return results


def search_and_transcribe(topic: str, from_date: str, to_date: str, depth: str = "default") -> Dict[str, Any]:
    search_result = search_youtube(topic, from_date, to_date, depth)
    items = search_result.get("items", [])
    if not items:
        return search_result

    transcript_limit = TRANSCRIPT_LIMITS.get(depth, TRANSCRIPT_LIMITS["default"])
    top_ids = [item["video_id"] for item in items[:transcript_limit]]
    transcripts = fetch_transcripts_parallel(top_ids)

    core_topic = _extract_core_subject(topic)
    for item in items:
        vid = item["video_id"]
        transcript = transcripts.get(vid)
        item["transcript_snippet"] = transcript or ""
        item["transcript_highlights"] = extract_transcript_highlights(transcript or "", core_topic)

    return {"items": items}


class YouTubeToolkit(BaseToolkit):
    """YouTube search and transcript toolkit powered by yt-dlp."""

    name: str = "youtube"

    @tool(parse_docstring=True)
    async def youtube_search(self, topic: str, from_date: str, to_date: str, depth: str = "default") -> Dict[str, Any]:
        """Search YouTube videos by topic and return metadata.

        Args:
            topic: Search query in natural language.
            from_date: Start date in YYYY-MM-DD format.
            to_date: End date in YYYY-MM-DD format.
            depth: Search depth, one of quick, default, deep.
        """
        return await asyncio.to_thread(search_youtube, topic, from_date, to_date, depth)

    @tool(parse_docstring=True)
    async def youtube_search_and_transcribe(
        self,
        topic: str,
        from_date: str,
        to_date: str,
        depth: str = "default",
    ) -> Dict[str, Any]:
        """Search YouTube and attach transcripts for top results.

        Args:
            topic: Search query in natural language.
            from_date: Start date in YYYY-MM-DD format.
            to_date: End date in YYYY-MM-DD format.
            depth: Search depth, one of quick, default, deep.
        """
        return await asyncio.to_thread(search_and_transcribe, topic, from_date, to_date, depth)
