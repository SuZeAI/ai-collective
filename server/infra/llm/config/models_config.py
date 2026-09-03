"""Lookups over the ``models:`` list (``settings.models``, loaded and validated
once by ``backend.api.settings`` — this module does not parse config.yml
itself, it only queries the already-loaded registry).

The *active* model — which entry drives the app-wide default provider — is
resolved with this priority:

1. A persisted runtime override, set via the Settings UI (see
   ``backend.api.deps._llm_provider`` — that layer owns the DB-backed
   override; this module only knows about the config-level resolution below).
2. The first ``models:`` entry with ``enabled: true`` (deploy-time default).
3. The first entry overall, if none are marked enabled.

This module is consumed by ``backend.infrastructure.llm.factory`` (via the
resolved :class:`ModelConfig` passed in by the caller) and by
``backend.api.deps`` for the Settings/admin model-list and switch endpoints.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from server.api.settings import ModelConfig


def get_models_config() -> list[ModelConfig]:
    """The ``models:`` list, as loaded into ``settings.models``."""
    from server.api.settings import settings

    return settings.models


def get_enabled_models() -> list[ModelConfig]:
    """The subset of ``models:`` entries selectable as the active model."""
    return [m for m in get_models_config() if m.enabled]


def get_active_model_name() -> str | None:
    """Name of the config-level active model: the first ``enabled: true``
    entry, or the first entry overall as a last resort.

    Does NOT consider the DB-persisted Settings-UI override — that layer
    lives in ``backend.api.deps``, which checks it first and falls back here.
    """
    models = get_models_config()
    active = next((m.name for m in models if m.enabled), None)
    if active:
        return active
    return models[0].name if models else None


def get_model_config(name: str | None = None) -> ModelConfig | None:
    """Look up a model by name; ``None`` selects the active/default model."""
    models = get_models_config()
    target = name or get_active_model_name()
    if not target:
        return None
    return next((m for m in models if m.name == target), None)


def _normalize(name: str | None) -> str:
    return (name or "").strip().lower().replace("-", "_")


def find_model_for_provider(provider: str, capability: str | None = None) -> ModelConfig | None:
    """First ``models:`` entry for ``provider`` with a non-empty ``api_key``.

    ``provider`` matches against each entry's ``provider_name`` (falling back
    to ``name``), case/dash-insensitively. When ``capability`` is given (e.g.
    ``"supports_embedding"``), only entries with that flag set are considered
    — this is how gemini.py/image_generation.py/text_to_speech.py/embeddings.py
    and ``factory.build_default_llm_provider`` pick a fallback key; this
    registry is the only source of provider API keys. Prefers an
    ``enabled: true`` entry, else the first match.
    """
    target = _normalize(provider)
    candidates = [
        m
        for m in get_models_config()
        if _normalize(m.provider_name or m.name) == target
        and (getattr(m, "api_key", None) or "").strip()
        and (capability is None or getattr(m, capability, False))
    ]
    if not candidates:
        return None
    enabled = [m for m in candidates if m.enabled]
    return (enabled or candidates)[0]
