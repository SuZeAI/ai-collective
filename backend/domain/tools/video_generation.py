"""Video generation toolkit (text/image -> video).

Most video-generation providers are asynchronous: you submit a job, then poll a
status endpoint until the rendered video URL is ready. This toolkit implements
that generic create-then-poll flow and parses the common response shapes
defensively, so it can be pointed at most providers (Replicate-style, Runway,
Pika, Kling gateways, a self-hosted service, ...) by setting ``create_endpoint``,
``status_endpoint`` and ``api_key``.

If a provider returns the finished URL synchronously on creation, polling is
skipped. Used by the Video Producer agent to render short-form clips.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, Optional

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit
from backend.domain.tools._messaging_http import request_json
from backend.api.settings import settings

DEFAULT_MODEL = "video-gen-1"
DONE_STATES = {"succeeded", "success", "completed", "complete", "done", "finished", "ready"}
FAILED_STATES = {"failed", "error", "canceled", "cancelled"}
_URL_KEYS = ("video_url", "videoUrl", "url", "output_url", "result_url", "download_url")
_ID_KEYS = ("id", "job_id", "jobId", "request_id", "requestId", "task_id", "taskId", "prediction_id")
_STATUS_KEYS = ("status", "state", "phase")


def _find_video_url(obj: Any) -> Optional[str]:
    """Recursively search a JSON structure for a plausible video URL."""
    if isinstance(obj, str):
        s = obj.strip()
        if s.startswith("http") and any(s.lower().split("?")[0].endswith(ext) for ext in (".mp4", ".mov", ".webm", ".m4v")):
            return s
        return None
    if isinstance(obj, dict):
        for key in _URL_KEYS:
            val = obj.get(key)
            if isinstance(val, str) and val.startswith("http"):
                return val
        for val in obj.values():
            found = _find_video_url(val)
            if found:
                return found
        return None
    if isinstance(obj, list):
        for item in obj:
            found = _find_video_url(item)
            if found:
                return found
    return None


def _first(obj: Dict[str, Any], keys: tuple) -> Optional[str]:
    for key in keys:
        val = obj.get(key)
        if isinstance(val, (str, int)) and str(val).strip():
            return str(val)
    return None


def _status_of(obj: Dict[str, Any]) -> Optional[str]:
    raw = _first(obj, _STATUS_KEYS)
    return raw.strip().lower() if raw else None


class VideoGenerationToolkit(BaseToolkit):
    """Generate short videos from a prompt via a generic async (create + poll) video API."""

    name: str = "video_generation"

    def __init__(
        self,
        api_key: Optional[str] = None,
        create_endpoint: Optional[str] = None,
        status_endpoint: Optional[str] = None,
        model: str = DEFAULT_MODEL,
        poll_interval_seconds: int = 5,
        max_wait_seconds: int = 300,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.api_key = api_key or settings.tools.video_gen_api_key
        self.create_endpoint = (create_endpoint or settings.tools.video_gen_create_endpoint or "").strip()
        # status_endpoint may contain a {id} placeholder, e.g. https://api.x/v1/jobs/{id}
        self.status_endpoint = (status_endpoint or settings.tools.video_gen_status_endpoint or "").strip()
        self.model = (model or DEFAULT_MODEL).strip() or DEFAULT_MODEL
        self.poll_interval_seconds = max(1, int(poll_interval_seconds or 5))
        self.max_wait_seconds = max(10, int(max_wait_seconds or 300))

    def _headers(self, key: str) -> Dict[str, str]:
        return {"Authorization": f"Bearer {key}"}

    def _require(self) -> str:
        key = (self.api_key or "").strip()
        if not key:
            raise ValueError(
                "Video generation API key required. Set VIDEO_GEN_API_KEY or configure api_key on the skill."
            )
        if not self.create_endpoint:
            raise ValueError(
                "Video generation create_endpoint required. Configure create_endpoint on the skill "
                "(your provider's job-creation URL)."
            )
        return key

    def _poll(self, job_id: str, key: str, deadline: float) -> Dict[str, Any]:
        if not self.status_endpoint:
            return {"status": "submitted", "job_id": job_id, "note": "No status_endpoint configured; cannot poll."}
        url = self.status_endpoint.replace("{id}", job_id)
        last: Dict[str, Any] = {}
        while time.time() < deadline:
            last = request_json("GET", url, service="Video Generation", headers=self._headers(key), timeout=60)
            video_url = _find_video_url(last)
            status = _status_of(last)
            if video_url and (status is None or status in DONE_STATES):
                return {"status": status or "succeeded", "job_id": job_id, "video_url": video_url}
            if status in FAILED_STATES:
                return {"status": status, "job_id": job_id, "error": last.get("error") or "Provider reported failure."}
            time.sleep(self.poll_interval_seconds)
        return {"status": "timeout", "job_id": job_id, "last_response": last}

    def _run_job(self, payload: Dict[str, Any], key: str) -> Dict[str, Any]:
        created = request_json(
            "POST",
            self.create_endpoint,
            service="Video Generation",
            json_body=payload,
            headers=self._headers(key),
            timeout=120,
        )
        # Provider returned the finished URL synchronously.
        immediate = _find_video_url(created)
        status = _status_of(created)
        if immediate and (status is None or status in DONE_STATES):
            return {"status": status or "succeeded", "video_url": immediate}

        job_id = _first(created, _ID_KEYS)
        if not job_id:
            return {"status": status or "submitted", "raw_response": created,
                    "note": "Could not locate a job id or video URL in the create response."}

        deadline = time.time() + self.max_wait_seconds
        return self._poll(job_id, key, deadline)

    @tool(parse_docstring=True)
    async def video_generate(
        self,
        prompt: str,
        duration_seconds: Optional[int] = None,
        aspect_ratio: str = "9:16",
        image_url: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Render a short video from a text prompt (optionally animating a source image) and return its URL.

        Args:
            prompt: Description of the video scene/action to generate.
            duration_seconds: Desired clip length in seconds (provider-dependent).
            aspect_ratio: Frame aspect ratio, e.g. 9:16 (vertical), 1:1, 16:9.
            image_url: Optional source image URL for image-to-video providers.
            model: Optional model override.
            api_key: Optional API key override.
        """
        key = (api_key or self.api_key or "").strip() or self._require()
        if not self.create_endpoint:
            self._require()

        payload: Dict[str, Any] = {
            "model": (model or self.model or DEFAULT_MODEL).strip() or DEFAULT_MODEL,
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
        }
        if duration_seconds:
            payload["duration"] = int(duration_seconds)
        if image_url:
            payload["image_url"] = image_url

        result = await asyncio.to_thread(self._run_job, payload, key)
        result.setdefault("model", payload["model"])
        return result
