"""Configuration file loading (``config.yml``).

``config.yml`` is the single source of truth for app config: a nested,
lowercase-key file (DeerFlow-style) where each top-level section maps 1:1 onto
a ``Settings`` sub-model and each leaf key equals that sub-model's field name.
``load_config()`` parses it, deep-merges an optional ``CONFIG_OVERRIDE_FILE``
on top (used by the test suite to swap a handful of ops knobs without
duplicating the whole file), and expands ``${VAR}`` / ``$VAR`` references from
the OS environment — the only place env vars still reach the app, and only for
secret values a leaf references inline (e.g. ``auth.jwt_secret_key:
${JWT_SECRET_KEY}``). The resulting dict is passed straight into
``Settings(**raw)`` (see ``server/api/settings.py``).

``models:`` and ``middleware:`` are ordinary ``Settings`` fields too
(``Settings.models: list[ModelConfig]``, ``Settings.middleware: dict``) —
nothing outside this module parses config.yml itself;
``server/infra/llm/config`` and
``server/infra/llm/middleware/config.py`` only query
``settings.models`` / ``settings.middleware``.
"""

from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from typing import Any

# server/api/config_loader.py -> project root is two parents up from server/.
PROJECT_ROOT = Path(__file__).resolve().parents[2]

# ${VAR} and ${VAR:-default} references inside yaml string values.
_ENV_REF_BRACED = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}")
# Bare $VAR references (no braces, no default). Run AFTER the braced form so the
# leftover text contains no ``${`` for this matcher to clip.
_ENV_REF_BARE = re.compile(r"\$([A-Za-z_][A-Za-z0-9_]*)")


def expand_env(value: Any) -> Any:
    """Recursively expand ``${VAR}`` / ``${VAR:-default}`` and bare ``$VAR``.

    Resolved from the live environment (``.env`` is already loaded by the time
    this runs). An unset var with no default expands to an empty string.
    Non-string values pass through; lists/dicts are expanded element-wise.
    """
    if isinstance(value, str):
        def _resolve(var: str) -> str | None:
            # Try the name as written, then its UPPER-CASE form — config.yml may
            # reference secrets with lowercase names (e.g. ${jwt_secret_key})
            # while .env declares them UPPER-CASE by convention (JWT_SECRET_KEY).
            resolved = os.getenv(var)
            if resolved is None and var != var.upper():
                resolved = os.getenv(var.upper())
            return resolved

        def braced(match: re.Match[str]) -> str:
            var, default = match.group(1), match.group(2)
            resolved = _resolve(var)
            if resolved is not None:
                return resolved
            return default if default is not None else ""

        out = _ENV_REF_BRACED.sub(braced, value)
        return _ENV_REF_BARE.sub(lambda m: _resolve(m.group(1)) or "", out)
    if isinstance(value, list):
        return [expand_env(v) for v in value]
    if isinstance(value, dict):
        return {k: expand_env(v) for k, v in value.items()}
    return value


def config_file_path() -> Path:
    """Resolve the config.yml path (override with the CONFIG_FILE env var)."""
    override = os.getenv("CONFIG_FILE")
    if override:
        p = Path(override)
        return p if p.is_absolute() else PROJECT_ROOT / p
    return PROJECT_ROOT / ".config" / "config.yml"


def config_override_file_path() -> Path | None:
    """Optional second yaml file deep-merged over config.yml (CONFIG_OVERRIDE_FILE).

    Lets the test suite override a handful of ops knobs (storage/task-queue/
    lock/sandbox/admin/auth) without duplicating the whole file.
    """
    override = os.getenv("CONFIG_OVERRIDE_FILE")
    if not override:
        return None
    p = Path(override)
    return p if p.is_absolute() else PROJECT_ROOT / p


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _read_yaml(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    import yaml

    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return raw if isinstance(raw, dict) else {}


def load_config() -> dict[str, Any]:
    """Load config.yml (deep-merged with CONFIG_OVERRIDE_FILE, if set), expand
    ``${VAR}``/``$VAR`` references, and return the nested dict ready to pass
    into ``Settings(**raw)``.

    Missing file or parse errors are swallowed — config.yml is required for a
    real deployment, but code defaults still apply when it is absent or broken
    (e.g. a bad merge), so a mistake here never blocks startup.
    """
    try:
        raw = _read_yaml(config_file_path())
        override_path = config_override_file_path()
        if override_path is not None:
            raw = _deep_merge(raw, _read_yaml(override_path))
        return expand_env(raw)
    except Exception:  # noqa: BLE001 - never block startup on a bad config.yml
        logging.getLogger(__name__).exception(
            "Failed to load config.yml — falling back to code defaults for all settings"
        )
        return {}
