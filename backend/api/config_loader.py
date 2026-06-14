"""Non-secret configuration layer (``config.yml``).

The app's configuration is split into two committed sources plus the live OS
environment, layered low → high priority:

    code defaults  <  config.yml  <  .env  <  OS environment

- ``config.yml`` holds **non-secret** operational config (modes, timeouts,
  ports, URLs, budgets). It is committed to git and safe to read.
- ``.env`` holds **secrets** (API keys, JWT secret, DB/router credentials).
- Real OS environment variables override everything.

This module loads ``config.yml`` and writes each leaf into ``os.environ`` with
``setdefault`` — so it only fills gaps, never clobbering a value already set by
``.env`` or the shell. Because the values land in ``os.environ`` they reach
*both* the pydantic ``Settings`` object *and* the handful of modules that read
``os.getenv`` directly (LLM rotation, MCP timeouts, …).

``config.yml`` is a **nested, lowercase-key** file (DeerFlow-style): each
top-level section maps to one ``Settings`` sub-model, and each lowercase leaf key
equals that sub-model's field python-name. The loader maps every leaf to its
canonical UPPER-CASE env-var name (the field's ``validation_alias``) using the
schema itself as the single source of truth, then ``setdefault``-s it into
``os.environ``. ``config_version`` and any unknown keys are ignored.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

# backend/api/config_loader.py -> project root is two parents up from backend/.
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
    return PROJECT_ROOT / "config.yml"


def _canonical_alias(field_info: Any, field_name: str) -> str:
    """The UPPER-CASE env-var name a Settings field reads from."""
    from pydantic import AliasChoices

    alias = field_info.validation_alias
    if isinstance(alias, AliasChoices):
        for choice in alias.choices:
            if isinstance(choice, str):
                return choice.upper()
    elif isinstance(alias, str):
        return alias.upper()
    return field_name.upper()


def build_section_registry() -> tuple[dict[str, dict[str, str]], dict[str, dict[str, dict[str, str]]]]:
    """Build the YAML-section → env-alias mapping from the Settings schema.

    Returns ``(registry, subsections)`` where ``registry[section][leaf_lower]``
    is the canonical UPPER env-var name, and ``subsections[section][sub]`` is the
    alias map for a nested subsection (e.g. ``llm.failover.*``).

    Imported lazily to avoid a circular import: ``settings.py`` imports this
    module at definition time, while this function only needs the (already
    defined) ``Settings`` class at call time.
    """
    from backend.api.settings import Settings

    registry: dict[str, dict[str, str]] = {}
    for section_name, finfo in Settings.model_fields.items():
        sub = finfo.annotation
        if not hasattr(sub, "model_fields"):
            continue
        registry[section_name] = {
            fname.lower(): _canonical_alias(sfi, fname)
            for fname, sfi in sub.model_fields.items()
        }

    # Subsections nested inside another section in the YAML, e.g. `llm.failover.*`
    # maps to the FailoverSettings (`llm_failover`) section's aliases.
    subsections: dict[str, dict[str, dict[str, str]]] = {}
    if "llm_failover" in registry:
        subsections.setdefault("llm", {})["failover"] = registry["llm_failover"]
    return registry, subsections


def _emit_leaf(alias_map: dict[str, str], key: str, value: Any, flat: dict[str, str]) -> None:
    if value is None:
        return
    env_name = alias_map.get(str(key).lower())
    if env_name is None:
        return  # unknown key -> ignored (the guardrail test catches real drift)
    if isinstance(value, bool):
        flat[env_name] = "true" if value else "false"
    else:
        flat[env_name] = expand_env(str(value))


def map_config(raw: dict[str, Any]) -> dict[str, str]:
    """Map a parsed nested config.yml dict to ``{UPPER_ENV_NAME: str}``."""
    registry, subsections = build_section_registry()
    flat: dict[str, str] = {}
    for section, body in raw.items():
        if section == "config_version" or not isinstance(body, dict):
            continue
        if section == "secrets":
            # Centralized secrets block: lowercase keys map straight to the
            # UPPER-CASE env var of the same name (no owning sub-model).
            secret_map = {str(k).lower(): str(k).upper() for k in body}
            for key, value in body.items():
                _emit_leaf(secret_map, key, value, flat)
            continue
        alias_map = registry.get(section, {})
        sub_map = subsections.get(section, {})
        for key, value in body.items():
            if key in sub_map and isinstance(value, dict):
                for sub_key, sub_value in value.items():
                    _emit_leaf(sub_map[key], sub_key, sub_value, flat)
            else:
                _emit_leaf(alias_map, key, value, flat)
    return flat


def apply_config_yaml() -> dict[str, str]:
    """Load config.yml and ``setdefault`` each leaf into ``os.environ``.

    Returns the flat mapping that was applied (useful for diagnostics/tests).
    Missing file or parse errors are swallowed — config.yml is an optional
    convenience layer; code defaults still apply when it is absent or broken.
    """
    path = config_file_path()
    if not path.exists():
        return {}
    try:
        import yaml

        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        if not isinstance(raw, dict):
            return {}
        flat = map_config(raw)
        for key, value in flat.items():
            os.environ.setdefault(key, value)
        return flat
    except Exception:  # noqa: BLE001 - never block startup on a bad config.yml
        return {}
