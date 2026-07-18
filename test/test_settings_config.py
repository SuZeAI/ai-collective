"""Guardrails for the centralized configuration layer.

``config.yml`` is a nested, lowercase-key file whose section/leaf names must
equal a ``Settings`` field name exactly (no env-var aliasing anymore); the
``$VAR`` / ``${VAR}`` env-reference expansion and the ``CONFIG_OVERRIDE_FILE``
deep-merge must keep working. These tests fail loudly if config.yml and
settings.py drift apart.
"""

from __future__ import annotations

import yaml
from pydantic import BaseModel

from backend.api.config_loader import config_file_path, expand_env, load_config
from backend.api.settings import LLMKeysSettings, Settings, StaffSettings

# Sections consumed by dedicated, standalone loaders (not the pydantic Settings
# tree) — `models:` by infrastructure/llm/config, `middleware:` by
# infrastructure/llm/middleware/config. Their schema is validated by those
# loaders, so they are intentionally exempt here.
_LOADER_MANAGED_SECTIONS = {"models", "middleware"}


def _raw_config() -> dict:
    return yaml.safe_load(config_file_path().read_text(encoding="utf-8")) or {}


def _unresolved_keys(model: type[BaseModel], body: dict, path: str) -> list[str]:
    unresolved: list[str] = []
    fields = model.model_fields
    for key, value in body.items():
        if key not in fields:
            unresolved.append(f"{path}.{key}")
            continue
        sub_model = fields[key].annotation
        if isinstance(value, dict) and isinstance(sub_model, type) and issubclass(sub_model, BaseModel):
            unresolved.extend(_unresolved_keys(sub_model, value, f"{path}.{key}"))
    return unresolved


def test_every_config_key_resolves_to_a_settings_field():
    raw = _raw_config()
    unresolved: list[str] = []
    for section, body in raw.items():
        if section == "config_version" or section in _LOADER_MANAGED_SECTIONS:
            continue
        if not isinstance(body, dict):
            continue
        if section not in Settings.model_fields:
            unresolved.append(section)
            continue
        sub_model = Settings.model_fields[section].annotation
        unresolved.extend(_unresolved_keys(sub_model, body, section))
    assert not unresolved, (
        f"config.yml declares keys with no matching field in settings.py: {unresolved}"
    )


def test_env_reference_expansion(monkeypatch):
    monkeypatch.setenv("CFG_TEST_VAR", "hello")
    # braced form
    assert expand_env("${CFG_TEST_VAR}") == "hello"
    assert expand_env("prefix-${CFG_TEST_VAR}-suffix") == "prefix-hello-suffix"
    assert expand_env("${CFG_MISSING_XYZ:-fallback}") == "fallback"
    assert expand_env("${CFG_MISSING_XYZ}") == ""
    # bare $VAR form
    assert expand_env("$CFG_TEST_VAR") == "hello"
    assert expand_env("a/$CFG_TEST_VAR/b") == "a/hello/b"
    assert expand_env("$CFG_MISSING_XYZ") == ""
    # mixed
    assert expand_env("${CFG_TEST_VAR}-$CFG_TEST_VAR") == "hello-hello"


def test_secret_var_expands_into_settings(tmp_path, monkeypatch):
    monkeypatch.setenv("CFG_TEST_SECRET", "shh")
    cfg = tmp_path / "config.yml"
    cfg.write_text("auth:\n  jwt_secret_key: ${CFG_TEST_SECRET}\n")
    monkeypatch.setenv("CONFIG_FILE", str(cfg))
    monkeypatch.delenv("CONFIG_OVERRIDE_FILE", raising=False)
    raw = load_config()
    assert Settings(**raw).auth.jwt_secret_key == "shh"


def test_config_override_file_deep_merges(tmp_path, monkeypatch):
    base = tmp_path / "base.yml"
    override = tmp_path / "override.yml"
    base.write_text("app:\n  environment: production\n  api_prefix: /api/v1\nstorage:\n  backend: mongo\n")
    override.write_text("app:\n  environment: development\nstorage:\n  backend: json\n")
    monkeypatch.setenv("CONFIG_FILE", str(base))
    monkeypatch.setenv("CONFIG_OVERRIDE_FILE", str(override))
    raw = load_config()
    assert raw["app"]["environment"] == "development"  # override wins
    assert raw["app"]["api_prefix"] == "/api/v1"  # base key untouched by the merge survives
    assert raw["storage"]["backend"] == "json"


def test_llm_failover_nests_under_llm():
    raw = {"llm": {"failover": {"strategy": "rotate", "key_cooldown_seconds": 30}}}
    s = Settings(**raw)
    assert s.llm.failover.strategy == "rotate"
    assert s.llm.failover.key_cooldown_seconds == 30


def test_os_environment_no_longer_overrides_settings(monkeypatch):
    # Regular (non-secret) settings are config.yml-only now — an OS env var
    # with the field's legacy UPPER_CASE name has no effect.
    monkeypatch.setenv("SUBAGENT_MAX_CONCURRENT", "9")
    assert StaffSettings().subagent_max_concurrent == 3


def test_llm_keys_are_still_env_backed(monkeypatch):
    # LLMKeysSettings has no config.yml section — it's secrets-only and stays
    # sourced from the OS environment (.env), same as before.
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key-123")
    assert LLMKeysSettings().google_api_key == "test-key-123"


def test_nested_and_flat_access_agree():
    from backend.api.settings import settings

    assert settings.llm_provider == settings.llm.provider
    assert settings.jwt_secret_key == settings.auth.jwt_secret_key
    assert settings.subagent_max_concurrent == settings.staff.subagent_max_concurrent
    assert settings.google_api_keys() == settings.llm_keys.google_api_keys()
