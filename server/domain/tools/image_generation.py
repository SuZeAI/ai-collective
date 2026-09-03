"""Image generation toolkit (text -> image).

Provider-agnostic but defaults to the OpenAI Images API contract
(``POST /v1/images/generations`` with a Bearer key, returning
``{"data": [{"url" | "b64_json": ...}]}``). Point ``endpoint``/``model`` at any
OpenAI-compatible image service (OpenAI, Azure OpenAI, OpenRouter, a self-hosted
gateway, etc.) and supply your own ``api_key``.

Used by content-production staff to create character art, scene visuals and
video thumbnails.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

from langchain.tools import tool

from server.domain.tools.base import BaseToolkit
from server.domain.tools._messaging_http import request_json
from server.infra.llm.config import find_model_for_provider

DEFAULT_ENDPOINT = "https://api.openai.com/v1/images/generations"
DEFAULT_MODEL = "gpt-image-1"
DEFAULT_SIZE = "1024x1024"


def _normalize_images(response: Dict[str, Any]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    data = response.get("data")
    if isinstance(data, list):
        for idx, item in enumerate(data):
            if not isinstance(item, dict):
                continue
            url = item.get("url")
            b64 = item.get("b64_json") or item.get("b64")
            if not url and not b64:
                continue
            entry: Dict[str, Any] = {"id": f"img_{idx + 1}"}
            if url:
                entry["url"] = url
            if b64:
                entry["b64_json"] = b64
            if item.get("revised_prompt"):
                entry["revised_prompt"] = item["revised_prompt"]
            items.append(entry)
    return items


class ImageGenerationToolkit(BaseToolkit):
    """Generate images from text prompts via an OpenAI-compatible image API."""

    name: str = "image_generation"

    def __init__(
        self,
        api_key: Optional[str] = None,
        endpoint: str = DEFAULT_ENDPOINT,
        model: str = DEFAULT_MODEL,
        size: str = DEFAULT_SIZE,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.api_key = api_key or ""
        self.endpoint = (endpoint or DEFAULT_ENDPOINT).strip() or DEFAULT_ENDPOINT
        self.model = (model or DEFAULT_MODEL).strip() or DEFAULT_MODEL
        self.size = (size or DEFAULT_SIZE).strip() or DEFAULT_SIZE

    def _key(self) -> str:
        key = (self.api_key or "").strip()
        if not key:
            entry = find_model_for_provider("openai", "supports_image_gen")
            key = (getattr(entry, "api_key", None) or "").split(",")[0].strip() if entry else ""
        if not key:
            raise ValueError(
                "Image generation API key required. Configure api_key on the skill, or enable "
                "an OpenAI model with `supports_image_gen: true` in the models: registry."
            )
        return key

    @tool(parse_docstring=True)
    async def image_generate(
        self,
        prompt: str,
        n: int = 1,
        size: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate one or more images from a text prompt.

        Args:
            prompt: Description of the image to create (subject, style, composition, mood).
            n: How many images to generate (1-4).
            size: Image size like 1024x1024, 1024x1536 or 1536x1024. Defaults to the skill config.
            model: Optional model override (e.g. gpt-image-1, dall-e-3).
            api_key: Optional API key override.
        """
        key = (api_key or self.api_key or "").strip() or self._key()
        selected_model = (model or self.model or DEFAULT_MODEL).strip() or DEFAULT_MODEL
        selected_size = (size or self.size or DEFAULT_SIZE).strip() or DEFAULT_SIZE
        try:
            count = max(1, min(int(n), 4))
        except (TypeError, ValueError):
            count = 1

        payload: Dict[str, Any] = {
            "model": selected_model,
            "prompt": prompt,
            "n": count,
            "size": selected_size,
        }
        headers = {"Authorization": f"Bearer {key}"}

        response = await asyncio.to_thread(
            request_json,
            "POST",
            self.endpoint,
            service="Image Generation",
            json_body=payload,
            headers=headers,
            timeout=120,
        )

        images = _normalize_images(response)
        return {
            "model": selected_model,
            "size": selected_size,
            "count": len(images),
            "images": images,
        }
