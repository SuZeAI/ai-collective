"""Text-to-speech (voiceover) toolkit.

Provider-agnostic but defaults to the OpenAI audio-speech contract
(``POST /v1/audio/speech`` with a Bearer key, returning raw audio bytes).
Point ``endpoint``/``model``/``voice`` at any OpenAI-compatible TTS service and
supply your own ``api_key``.

Returns the audio as base64 (so it can be passed downstream or stored by the
caller) and, when ``output_dir`` is configured, also writes the file to disk and
returns its path. Used by the Video Producer agent to generate voiceovers.
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import uuid
from typing import Any, Dict, Optional
from urllib import error, request

from langchain.tools import tool

from backend.domain.tools.base import BaseToolkit

DEFAULT_ENDPOINT = "https://api.openai.com/v1/audio/speech"
DEFAULT_MODEL = "gpt-4o-mini-tts"
DEFAULT_VOICE = "alloy"
DEFAULT_FORMAT = "mp3"


def _fetch_audio(
    endpoint: str,
    payload: Dict[str, Any],
    api_key: str,
    timeout: int = 120,
) -> bytes:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    req = request.Request(
        url=endpoint,
        method="POST",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
    )
    try:
        with request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Text-to-Speech API error {exc.code}: {body[:300]}") from exc
    except (error.URLError, TimeoutError) as exc:
        raise RuntimeError(f"Text-to-Speech request failed: {exc}") from exc


class TextToSpeechToolkit(BaseToolkit):
    """Synthesize speech audio from text via an OpenAI-compatible TTS API."""

    name: str = "text_to_speech"

    def __init__(
        self,
        api_key: Optional[str] = None,
        endpoint: str = DEFAULT_ENDPOINT,
        model: str = DEFAULT_MODEL,
        voice: str = DEFAULT_VOICE,
        audio_format: str = DEFAULT_FORMAT,
        output_dir: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.api_key = api_key or os.getenv("TTS_API_KEY") or os.getenv("OPENAI_API_KEY", "")
        self.endpoint = (endpoint or DEFAULT_ENDPOINT).strip() or DEFAULT_ENDPOINT
        self.model = (model or DEFAULT_MODEL).strip() or DEFAULT_MODEL
        self.voice = (voice or DEFAULT_VOICE).strip() or DEFAULT_VOICE
        self.audio_format = (audio_format or DEFAULT_FORMAT).strip() or DEFAULT_FORMAT
        self.output_dir = (output_dir or os.getenv("TTS_OUTPUT_DIR") or "").strip()

    def _key(self) -> str:
        key = (self.api_key or "").strip()
        if not key:
            raise ValueError(
                "Text-to-speech API key required. Set TTS_API_KEY / OPENAI_API_KEY "
                "or configure api_key on the skill."
            )
        return key

    @tool(parse_docstring=True)
    async def tts_synthesize(
        self,
        text: str,
        voice: Optional[str] = None,
        audio_format: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Convert text into spoken audio and return it as base64 (and a file path if storage is configured).

        Args:
            text: The script/voiceover text to speak.
            voice: Voice name (e.g. alloy, verse, coral). Defaults to the skill config.
            audio_format: Output format like mp3, wav or opus. Defaults to the skill config.
            model: Optional model override.
            api_key: Optional API key override.
        """
        key = (api_key or self.api_key or "").strip() or self._key()
        selected_voice = (voice or self.voice or DEFAULT_VOICE).strip() or DEFAULT_VOICE
        selected_format = (audio_format or self.audio_format or DEFAULT_FORMAT).strip() or DEFAULT_FORMAT
        selected_model = (model or self.model or DEFAULT_MODEL).strip() or DEFAULT_MODEL

        payload: Dict[str, Any] = {
            "model": selected_model,
            "voice": selected_voice,
            "input": text,
            "response_format": selected_format,
        }

        audio = await asyncio.to_thread(_fetch_audio, self.endpoint, payload, key)

        saved_path: Optional[str] = None
        if self.output_dir:
            try:
                os.makedirs(self.output_dir, exist_ok=True)
                saved_path = os.path.join(self.output_dir, f"tts_{uuid.uuid4().hex}.{selected_format}")
                with open(saved_path, "wb") as fh:
                    fh.write(audio)
            except OSError:
                saved_path = None

        return {
            "model": selected_model,
            "voice": selected_voice,
            "format": selected_format,
            "bytes": len(audio),
            "audio_base64": base64.b64encode(audio).decode("ascii"),
            "saved_path": saved_path,
        }
