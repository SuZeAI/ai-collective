"""Google Gemini toolkits (image, text-to-speech, video, grounded generation).

These wrap the Gemini Developer API (``https://generativelanguage.googleapis.com``)
which has request/response shapes that differ from the OpenAI-compatible tools, so
each capability gets its own toolkit. Authentication uses the ``x-goog-api-key``
header; supply your key via the skill ``api_key`` config or the ``GEMINI_API_KEY`` /
``GOOGLE_API_KEY`` environment variable.

  - GeminiImageToolkit    -> Imagen ``:predict`` (text -> image)
  - GeminiTTSToolkit      -> Gemini TTS ``:generateContent`` (text -> speech, PCM wrapped to WAV)
  - GeminiVideoToolkit    -> Veo ``:predictLongRunning`` (text/image -> video, async + poll)
  - GeminiGenerateToolkit -> Gemini ``:generateContent`` (text, optional Google Search grounding)
"""

from __future__ import annotations

import asyncio
import base64
import io
import os
import time
import wave
from typing import Any, Dict, List, Optional

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit
from backend.domain.tools._messaging_http import request_json

DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_IMAGE_MODEL = "imagen-3.0-generate-002"
DEFAULT_TTS_MODEL = "gemini-2.5-flash-preview-tts"
DEFAULT_TTS_VOICE = "Kore"
DEFAULT_VIDEO_MODEL = "veo-3.0-generate-preview"
DEFAULT_TEXT_MODEL = "gemini-2.0-flash"


def _resolve_key(explicit: Optional[str]) -> str:
    key = (explicit or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
    if not key:
        raise ValueError(
            "Gemini API key required. Set GEMINI_API_KEY / GOOGLE_API_KEY or configure api_key on the skill."
        )
    return key


def _headers(key: str) -> Dict[str, str]:
    return {"x-goog-api-key": key, "Content-Type": "application/json"}


def _model_url(base_url: str, model: str, action: str) -> str:
    return f"{base_url.rstrip('/')}/models/{model}:{action}"


def _pcm_to_wav(pcm: bytes, sample_rate: int, channels: int = 1, sample_width: int = 2) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)
    return buf.getvalue()


def _rate_from_mime(mime: str) -> int:
    # e.g. "audio/L16;codec=pcm;rate=24000"
    for part in (mime or "").split(";"):
        part = part.strip().lower()
        if part.startswith("rate="):
            try:
                return int(part.split("=", 1)[1])
            except ValueError:
                pass
    return 24000


class GeminiImageToolkit(BaseToolkit):
    """Generate images with Google Imagen via the Gemini API."""

    name: str = "gemini_image"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = DEFAULT_IMAGE_MODEL,
        base_url: str = DEFAULT_BASE_URL,
        aspect_ratio: str = "1:1",
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY", "")
        self.model = (model or DEFAULT_IMAGE_MODEL).strip() or DEFAULT_IMAGE_MODEL
        self.base_url = (base_url or DEFAULT_BASE_URL).strip() or DEFAULT_BASE_URL
        self.aspect_ratio = (aspect_ratio or "1:1").strip() or "1:1"

    @tool(parse_docstring=True)
    async def gemini_generate_image(
        self,
        prompt: str,
        n: int = 1,
        aspect_ratio: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate images from a text prompt using Google Imagen.

        Args:
            prompt: Description of the image to create.
            n: Number of images to generate (1-4).
            aspect_ratio: One of 1:1, 9:16, 16:9, 3:4, 4:3. Defaults to the skill config.
            model: Optional Imagen model override (e.g. imagen-3.0-generate-002).
            api_key: Optional API key override.
        """
        key = _resolve_key(api_key or self.api_key)
        selected_model = (model or self.model or DEFAULT_IMAGE_MODEL).strip() or DEFAULT_IMAGE_MODEL
        selected_ratio = (aspect_ratio or self.aspect_ratio or "1:1").strip() or "1:1"
        try:
            count = max(1, min(int(n), 4))
        except (TypeError, ValueError):
            count = 1

        payload = {
            "instances": [{"prompt": prompt}],
            "parameters": {"sampleCount": count, "aspectRatio": selected_ratio},
        }
        url = _model_url(self.base_url, selected_model, "predict")
        response = await asyncio.to_thread(
            request_json, "POST", url, service="Gemini Image",
            json_body=payload, headers=_headers(key), timeout=120,
        )

        images: List[Dict[str, Any]] = []
        for idx, pred in enumerate(response.get("predictions", []) or []):
            if not isinstance(pred, dict):
                continue
            b64 = pred.get("bytesBase64Encoded") or pred.get("b64_json")
            if not b64:
                continue
            images.append({
                "id": f"img_{idx + 1}",
                "b64_json": b64,
                "mime_type": pred.get("mimeType", "image/png"),
            })
        return {"model": selected_model, "aspect_ratio": selected_ratio, "count": len(images), "images": images}


class GeminiTTSToolkit(BaseToolkit):
    """Synthesize speech with Gemini TTS (returns WAV audio as base64)."""

    name: str = "gemini_tts"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = DEFAULT_TTS_MODEL,
        base_url: str = DEFAULT_BASE_URL,
        voice: str = DEFAULT_TTS_VOICE,
        output_dir: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY", "")
        self.model = (model or DEFAULT_TTS_MODEL).strip() or DEFAULT_TTS_MODEL
        self.base_url = (base_url or DEFAULT_BASE_URL).strip() or DEFAULT_BASE_URL
        self.voice = (voice or DEFAULT_TTS_VOICE).strip() or DEFAULT_TTS_VOICE
        self.output_dir = (output_dir or os.getenv("TTS_OUTPUT_DIR") or "").strip()

    @tool(parse_docstring=True)
    async def gemini_synthesize_speech(
        self,
        text: str,
        voice: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Convert text to spoken audio (WAV) using Gemini TTS.

        Args:
            text: The narration/voiceover text to speak.
            voice: Prebuilt voice name (e.g. Kore, Puck, Charon, Aoede). Defaults to the skill config.
            model: Optional model override (e.g. gemini-2.5-flash-preview-tts).
            api_key: Optional API key override.
        """
        key = _resolve_key(api_key or self.api_key)
        selected_model = (model or self.model or DEFAULT_TTS_MODEL).strip() or DEFAULT_TTS_MODEL
        selected_voice = (voice or self.voice or DEFAULT_TTS_VOICE).strip() or DEFAULT_TTS_VOICE

        payload = {
            "contents": [{"parts": [{"text": text}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": selected_voice}}},
            },
        }
        url = _model_url(self.base_url, selected_model, "generateContent")
        response = await asyncio.to_thread(
            request_json, "POST", url, service="Gemini TTS",
            json_body=payload, headers=_headers(key), timeout=120,
        )

        inline = None
        try:
            for part in response["candidates"][0]["content"]["parts"]:
                if isinstance(part, dict) and ("inlineData" in part or "inline_data" in part):
                    inline = part.get("inlineData") or part.get("inline_data")
                    break
        except (KeyError, IndexError, TypeError):
            inline = None

        if not inline or not inline.get("data"):
            raise RuntimeError("Gemini TTS returned no audio data.")

        mime = inline.get("mimeType") or inline.get("mime_type") or "audio/L16;rate=24000"
        pcm = base64.b64decode(inline["data"])
        wav = _pcm_to_wav(pcm, _rate_from_mime(mime))

        saved_path: Optional[str] = None
        if self.output_dir:
            try:
                os.makedirs(self.output_dir, exist_ok=True)
                import uuid
                saved_path = os.path.join(self.output_dir, f"gemini_tts_{uuid.uuid4().hex}.wav")
                with open(saved_path, "wb") as fh:
                    fh.write(wav)
            except OSError:
                saved_path = None

        return {
            "model": selected_model,
            "voice": selected_voice,
            "format": "wav",
            "bytes": len(wav),
            "audio_base64": base64.b64encode(wav).decode("ascii"),
            "saved_path": saved_path,
        }


class GeminiVideoToolkit(BaseToolkit):
    """Generate video with Google Veo via the Gemini API (async create + poll)."""

    name: str = "gemini_video"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = DEFAULT_VIDEO_MODEL,
        base_url: str = DEFAULT_BASE_URL,
        poll_interval_seconds: int = 10,
        max_wait_seconds: int = 300,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY", "")
        self.model = (model or DEFAULT_VIDEO_MODEL).strip() or DEFAULT_VIDEO_MODEL
        self.base_url = (base_url or DEFAULT_BASE_URL).strip() or DEFAULT_BASE_URL
        self.poll_interval_seconds = max(1, int(poll_interval_seconds or 10))
        self.max_wait_seconds = max(10, int(max_wait_seconds or 300))

    @staticmethod
    def _extract_video_uri(response: Dict[str, Any]) -> Optional[str]:
        resp = response.get("response", response)
        gvr = resp.get("generateVideoResponse") if isinstance(resp, dict) else None
        if isinstance(gvr, dict):
            for sample in gvr.get("generatedSamples", []) or []:
                uri = (sample.get("video") or {}).get("uri") if isinstance(sample, dict) else None
                if uri:
                    return uri
        for pred in resp.get("predictions", []) if isinstance(resp, dict) else []:
            if isinstance(pred, dict):
                uri = pred.get("uri") or (pred.get("video") or {}).get("uri")
                if uri:
                    return uri
        return None

    def _run(self, payload: Dict[str, Any], key: str) -> Dict[str, Any]:
        create_url = _model_url(self.base_url, self.model, "predictLongRunning")
        created = request_json("POST", create_url, service="Gemini Video",
                               json_body=payload, headers=_headers(key), timeout=120)
        op_name = created.get("name")
        if not op_name:
            uri = self._extract_video_uri(created)
            if uri:
                return {"status": "succeeded", "video_uri": uri}
            return {"status": "submitted", "raw_response": created,
                    "note": "No operation name or video URI returned."}

        poll_url = f"{self.base_url.rstrip('/')}/{op_name}"
        deadline = time.time() + self.max_wait_seconds
        last: Dict[str, Any] = {}
        while time.time() < deadline:
            last = request_json("GET", poll_url, service="Gemini Video", headers=_headers(key), timeout=60)
            if last.get("done"):
                if last.get("error"):
                    return {"status": "failed", "operation": op_name, "error": last["error"]}
                uri = self._extract_video_uri(last)
                return {"status": "succeeded", "operation": op_name, "video_uri": uri,
                        **({} if uri else {"raw_response": last, "note": "Done but no URI found."})}
            time.sleep(self.poll_interval_seconds)
        return {"status": "timeout", "operation": op_name, "last_response": last}

    @tool(parse_docstring=True)
    async def gemini_generate_video(
        self,
        prompt: str,
        aspect_ratio: str = "16:9",
        negative_prompt: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Render a video from a text prompt using Google Veo, returning the video URI.

        Args:
            prompt: Description of the video scene/action to generate.
            aspect_ratio: 16:9 or 9:16 (provider-dependent).
            negative_prompt: Optional things to avoid in the video.
            model: Optional Veo model override (e.g. veo-3.0-generate-preview).
            api_key: Optional API key override.
        """
        key = _resolve_key(api_key or self.api_key)
        if model:
            self.model = model.strip() or self.model
        params: Dict[str, Any] = {"aspectRatio": aspect_ratio}
        if negative_prompt:
            params["negativePrompt"] = negative_prompt
        payload = {"instances": [{"prompt": prompt}], "parameters": params}
        result = await asyncio.to_thread(self._run, payload, key)
        result.setdefault("model", self.model)
        result["note_download"] = "The video_uri requires your Gemini API key to download."
        return result


class GeminiGenerateToolkit(BaseToolkit):
    """Generate text with Gemini, optionally grounded with Google Search."""

    name: str = "gemini_generate"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = DEFAULT_TEXT_MODEL,
        base_url: str = DEFAULT_BASE_URL,
        enable_search: bool = False,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY", "")
        self.model = (model or DEFAULT_TEXT_MODEL).strip() or DEFAULT_TEXT_MODEL
        self.base_url = (base_url or DEFAULT_BASE_URL).strip() or DEFAULT_BASE_URL
        self.enable_search = str(enable_search).strip().lower() in ("true", "1", "yes") if isinstance(enable_search, str) else bool(enable_search)

    @tool(parse_docstring=True)
    async def gemini_generate_text(
        self,
        prompt: str,
        use_google_search: Optional[bool] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate a text response with Gemini, optionally grounded by live Google Search.

        Args:
            prompt: The instruction or question for Gemini.
            use_google_search: If true, ground the answer with Google Search (overrides skill default).
            model: Optional model override (e.g. gemini-2.0-flash, gemini-2.5-pro).
            api_key: Optional API key override.
        """
        key = _resolve_key(api_key or self.api_key)
        selected_model = (model or self.model or DEFAULT_TEXT_MODEL).strip() or DEFAULT_TEXT_MODEL
        grounded = self.enable_search if use_google_search is None else bool(use_google_search)

        payload: Dict[str, Any] = {"contents": [{"parts": [{"text": prompt}]}]}
        if grounded:
            payload["tools"] = [{"google_search": {}}]

        url = _model_url(self.base_url, selected_model, "generateContent")
        response = await asyncio.to_thread(
            request_json, "POST", url, service="Gemini Generate",
            json_body=payload, headers=_headers(key), timeout=90,
        )

        text_parts: List[str] = []
        sources: List[Dict[str, Any]] = []
        try:
            cand = response["candidates"][0]
            for part in cand.get("content", {}).get("parts", []) or []:
                if isinstance(part, dict) and part.get("text"):
                    text_parts.append(part["text"])
            grounding = cand.get("groundingMetadata") or {}
            for chunk in grounding.get("groundingChunks", []) or []:
                web = chunk.get("web") if isinstance(chunk, dict) else None
                if web and web.get("uri"):
                    sources.append({"title": web.get("title", ""), "uri": web["uri"]})
        except (KeyError, IndexError, TypeError):
            pass

        return {
            "model": selected_model,
            "grounded": grounded,
            "text": "\n".join(text_parts).strip(),
            "sources": sources,
        }
