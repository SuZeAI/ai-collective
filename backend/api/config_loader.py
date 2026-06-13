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

YAML sections (``app:``, ``llm:`` …) are organizational only — they are
flattened away. The leaf keys must be the canonical UPPER-CASE env var names.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

# backend/api/config_loader.py -> project root is two parents up from backend/.
PROJECT_ROOT = Path(__file__).resolve().parents[2]

# Matches ${VAR} and ${VAR:-default} references inside yaml string values.
_ENV_REF = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}")


def expand_env(value: Any) -> Any:
    """Recursively expand ``${VAR}`` / ``${VAR:-default}`` references.

    Resolved from the live environment (``.env`` is already loaded by the time
    this runs). An unset var with no default expands to an empty string.
    Non-string values pass through; lists/dicts are expanded element-wise.
    """
    if isinstance(value, str):
        def repl(match: re.Match[str]) -> str:
            var, default = match.group(1), match.group(2)
            resolved = os.getenv(var)
            if resolved is not None:
                return resolved
            return default if default is not None else ""

        return _ENV_REF.sub(repl, value)
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


def _flatten(raw: dict[str, Any]) -> dict[str, str]:
    """Flatten one level of nested sections into UPPER_CASE -> str pairs.

    ``{"llm": {"LLM_MODEL": "x"}, "SEED_DEFAULT_DATA": true}`` becomes
    ``{"LLM_MODEL": "x", "SEED_DEFAULT_DATA": "true"}``. Nested dict values are
    treated as sections; scalars at the top level are kept as-is.
    """
    flat: dict[str, str] = {}

    def _put(key: str, value: Any) -> None:
        if value is None:
            return
        if isinstance(value, bool):
            flat[key.upper()] = "true" if value else "false"
        else:
            # Expand ${VAR} / ${VAR:-default} references against the environment.
            flat[key.upper()] = expand_env(str(value))

    for key, value in raw.items():
        if isinstance(value, dict):
            for sub_key, sub_value in value.items():
                _put(str(sub_key), sub_value)
        else:
            _put(str(key), value)
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
        flat = _flatten(raw)
        for key, value in flat.items():
            os.environ.setdefault(key, value)
        return flat
    except Exception:  # noqa: BLE001 - never block startup on a bad config.yml
        return {}
