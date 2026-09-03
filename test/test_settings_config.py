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

from server.api.config_loader import config_file_path, expand_env, load_config
from server.api.settings import Settings, StaffSettings


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
        if section == "config_version":
            continue
        if not isinstance(body, dict):
            continue
        if section not in Settings.model_fields:
            unresolved.append(section)
            continue
        sub_model = Settings.model_fields[section].annotation
        if isinstance(sub_model, type) and issubclass(sub_model, BaseModel):
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


def test_models_and_middleware_load_into_settings():
    raw = {
        "models": [{"name": "gemini", "model": "gemini-3-flash-preview", "enabled": True}],
        "middleware": {"loop_detection": {"enabled": True, "max_repeats": 5}},
    }
    s = Settings(**raw)
    assert s.models[0].name == "gemini"
    assert s.middleware["loop_detection"]["max_repeats"] == 5


def test_os_environment_no_longer_overrides_settings(monkeypatch):
    # Regular (non-secret) settings are config.yml-only now — an OS env var
    # with the field's legacy UPPER_CASE name has no effect.
    monkeypatch.setenv("SUBAGENT_MAX_CONCURRENT", "9")
    assert StaffSettings().subagent_max_concurrent == 3


def test_nested_and_flat_access_agree():
    from server.api.settings import settings

    assert settings.jwt_secret_key == settings.auth.jwt_secret_key
    assert settings.subagent_max_concurrent == settings.staff.subagent_max_concurrent
