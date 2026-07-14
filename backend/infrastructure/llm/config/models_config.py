"""Load and cache the ``models:`` list from config.yml (model-driven LLM config).

Reads the same ``config.yml`` the rest of the app uses (path resolved via
``config_loader.config_file_path``), extracts the top-level ``models:`` list,
resolves ``$VAR`` env references, and validates each entry into a
:class:`ModelConfig`.

``$VAR`` resolution is lenient: a missing env var becomes an empty string rather
than raising, so a model whose API key is unset simply ends up empty (a builder
can treat it as disabled) instead of breaking startup. Secrets live in ``.env``
and reach ``os.environ`` before this loads.

The *active* model — which entry drives the app-wide default provider — is
resolved with this priority:

1. ``LLM_ACTIVE_MODEL`` env var (ops-level override).
2. A persisted runtime override, set via the Settings UI (see
   ``backend.api.deps._llm_provider`` — that layer owns the DB-backed
   override; this module only knows about config.yml + the env).
3. The first ``models:`` entry with ``enabled: true`` (deploy-time default).
4. The first entry overall, if none are marked enabled.

This module is consumed by ``backend.infrastructure.llm.factory`` (via the
resolved :class:`ModelConfig` passed in by the caller) and by
``backend.api.deps`` for the Settings/admin model-list and switch endpoints.
"""

from __future__ import annotations

import os
from typing import Any

import yaml

from backend.api.config_loader import config_file_path
from backend.infrastructure.llm.config.model_config import ModelConfig
from backend.log import get_logger

_models: list[ModelConfig] | None = None
_active_model: str | None = None


def _resolve_env(value: Any) -> Any:
    """Recursively resolve ``$VAR`` references (missing -> empty string)."""
    if isinstance(value, str):
        if value.startswith("$") and not value.startswith("${"):
            return os.getenv(value[1:], "")
        return value
    if isinstance(value, dict):
        return {k: _resolve_env(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_resolve_env(v) for v in value]
    return value


def _load() -> tuple[list[ModelConfig], str | None]:
    path = config_file_path()
    models: list[ModelConfig] = []
    active: str | None = None
    if not path.exists():
        return models, active
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except Exception:  # noqa: BLE001 — never block startup on a bad config.yml
        get_logger().warning("Could not parse %s for models config", path, exc_info=True)
        return models, active
    if not isinstance(raw, dict):
        return models, active

    raw_models = _resolve_env(raw.get("models") or [])
    for entry in raw_models:
        if not isinstance(entry, dict):
            continue
        try:
            models.append(ModelConfig.model_validate(entry))
        except Exception:  # noqa: BLE001 — skip a malformed entry, keep the rest
            get_logger().warning("Skipping invalid model entry: %s", entry.get("name"), exc_info=True)

    # Active model: env override wins, then the first `enabled: true` entry.
    active = os.getenv("LLM_ACTIVE_MODEL") or None
    if active is None:
        active = next((m.name for m in models if m.enabled), None)
    return models, active


def get_models_config() -> list[ModelConfig]:
    """Return the cached models list (loading on first access)."""
    global _models, _active_model
    if _models is None:
        _models, _active_model = _load()
    return _models


def get_enabled_models() -> list[ModelConfig]:
    """The subset of ``models:`` entries selectable as the active model."""
    return [m for m in get_models_config() if m.enabled]


def get_active_model_name() -> str | None:
    """Name of the config-level active model: env override, the first
    ``enabled: true`` entry, or the first entry overall as a last resort.

    Does NOT consider the DB-persisted Settings-UI override — that layer
    lives in ``backend.api.deps``, which checks it first and falls back here.
    """
    models = get_models_config()
    if _active_model:
        return _active_model
    return models[0].name if models else None


def get_model_config(name: str | None = None) -> ModelConfig | None:
    """Look up a model by name; ``None`` selects the active/default model."""
    models = get_models_config()
    target = name or get_active_model_name()
    if not target:
        return None
    return next((m for m in models if m.name == target), None)


def reload_models_config() -> list[ModelConfig]:
    """Force a reload from disk."""
    global _models, _active_model
    _models, _active_model = _load()
    return _models


def reset_models_config() -> None:
    """Clear the cache (next access reloads). Useful for tests."""
    global _models, _active_model
    _models = None
    _active_model = None
