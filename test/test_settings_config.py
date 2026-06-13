"""Guardrails for the centralized configuration layer.

Every key in ``config.yml`` must be backed by a typed field somewhere in the
nested ``Settings`` schema, and the ``${VAR}`` env-reference expansion must keep
working. These tests fail loudly if config.yml and settings.py drift apart.
"""

from __future__ import annotations

import os

import yaml
from pydantic import AliasChoices

from backend.api.config_loader import _flatten, config_file_path, expand_env
from backend.api.settings import Settings


def _settings_env_aliases() -> set[str]:
    """Collect every canonical env-var name the nested Settings schema accepts."""
    names: set[str] = set()
    for _, finfo in Settings.model_fields.items():
        sub = finfo.annotation
        if not hasattr(sub, "model_fields"):
            continue
        for field_name, sub_info in sub.model_fields.items():
            alias = sub_info.validation_alias
            if isinstance(alias, AliasChoices):
                names.update(c.upper() for c in alias.choices if isinstance(c, str))
            elif isinstance(alias, str):
                names.add(alias.upper())
            else:
                names.add(field_name.upper())
    return names


def _config_leaf_keys() -> set[str]:
    raw = yaml.safe_load(config_file_path().read_text(encoding="utf-8")) or {}
    return set(_flatten(raw).keys())


def test_every_config_key_has_a_settings_field():
    config_keys = _config_leaf_keys()
    aliases = _settings_env_aliases()
    missing = sorted(config_keys - aliases)
    assert not missing, (
        "config.yml declares keys with no matching pydantic field in settings.py: "
        f"{missing}"
    )


def test_env_reference_expansion():
    os.environ["CFG_TEST_VAR"] = "hello"
    try:
        assert expand_env("${CFG_TEST_VAR}") == "hello"
        assert expand_env("prefix-${CFG_TEST_VAR}-suffix") == "prefix-hello-suffix"
        assert expand_env("${CFG_MISSING_XYZ:-fallback}") == "fallback"
        assert expand_env("${CFG_MISSING_XYZ}") == ""
    finally:
        del os.environ["CFG_TEST_VAR"]


def test_os_environment_overrides_config_default():
    # An OS env var wins over the code/config default (highest layer).
    os.environ["SUBAGENT_MAX_CONCURRENT"] = "9"
    try:
        from backend.api.settings import AgentSettings

        assert AgentSettings().subagent_max_concurrent == 9
    finally:
        del os.environ["SUBAGENT_MAX_CONCURRENT"]


def test_nested_and_flat_access_agree():
    from backend.api.settings import settings

    assert settings.llm_provider == settings.llm.provider
    assert settings.jwt_secret_key == settings.auth.jwt_secret_key
    assert settings.subagent_max_concurrent == settings.agent.subagent_max_concurrent
    assert settings.google_api_keys() == settings.llm_keys.google_api_keys()
