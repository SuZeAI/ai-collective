"""Guardrails for the centralized configuration layer.

``config.yml`` is a nested, lowercase-key file; every leaf must be backed by a
typed field somewhere in the nested ``Settings`` schema, and the ``$VAR`` /
``${VAR}`` env-reference expansion must keep working. These tests fail loudly if
config.yml and settings.py drift apart.
"""

from __future__ import annotations

import os

import yaml
from pydantic import AliasChoices

from backend.api.config_loader import (
    apply_config_yaml,
    build_section_registry,
    config_file_path,
    expand_env,
)
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


def _raw_config() -> dict:
    return yaml.safe_load(config_file_path().read_text(encoding="utf-8")) or {}


def _unresolved_keys() -> list[str]:
    """Every (section, leaf) in config.yml the loader registry cannot map.

    Walks the raw nested YAML (incl. registered subsections like ``llm.failover``)
    so a misspelled lowercase key — which the lenient loader would silently drop —
    is caught here instead.
    """
    raw = _raw_config()
    registry, subsections = build_section_registry()
    unresolved: list[str] = []
    for section, body in raw.items():
        if section == "config_version" or not isinstance(body, dict):
            continue
        if section == "secrets":
            # secrets keys map straight to their UPPER env name; validity is
            # asserted by test_applied_keys_are_known_aliases.
            continue
        alias_map = registry.get(section, {})
        sub_map = subsections.get(section, {})
        for key, value in body.items():
            if key in sub_map and isinstance(value, dict):
                for sub_key in value:
                    if str(sub_key).lower() not in sub_map[key]:
                        unresolved.append(f"{section}.{key}.{sub_key}")
            elif str(key).lower() not in alias_map:
                unresolved.append(f"{section}.{key}")
    return unresolved


def test_every_config_key_resolves_to_a_settings_field():
    unresolved = _unresolved_keys()
    assert not unresolved, (
        "config.yml declares keys with no matching pydantic field in settings.py: "
        f"{unresolved}"
    )


def test_applied_keys_are_known_aliases():
    applied = set(apply_config_yaml().keys())
    aliases = _settings_env_aliases()
    missing = sorted(applied - aliases)
    assert not missing, f"loader produced env keys with no settings field: {missing}"


def test_env_reference_expansion():
    os.environ["CFG_TEST_VAR"] = "hello"
    try:
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


def test_failover_subsection_maps():
    # `llm.failover.*` is nested under `llm:` in config.yml but maps to the
    # FailoverSettings env aliases.
    applied = apply_config_yaml()
    assert applied.get("LLM_FAILOVER_STRATEGY") == "rotate"

    from backend.api.settings import settings

    assert settings.llm_failover.strategy == "rotate"
