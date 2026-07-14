"""Declarative, model-driven LLM configuration (DeerFlow-style).

Follows the ``context/config.example.yaml`` pattern: chat LLMs are declared as a
``models:`` list in ``config.yml``. Each entry names the LangChain chat-model
class via ``use: module:ClassName`` (informational — provider selection
actually goes through ``provider_name`` + the 7 built-in provider classes, see
``factory._normalize_provider``) and carries its own ``enabled``/``failover``.
The active model is the first ``enabled: true`` entry, overridable via
``LLM_ACTIVE_MODEL`` or the Settings UI (persisted DB override, resolved in
``backend.api.deps``).

``backend.infrastructure.llm.factory.build_default_llm_provider`` consumes the
resolved active :class:`ModelConfig` to pick provider/model/base_url/failover.

Public API:
    * ``ModelConfig`` / ``FailoverEntry`` — one model entry + its rotation policy.
    * ``resolve_class`` — turn ``"module:ClassName"`` into a class.
    * ``get_models_config`` / ``get_model_config`` / ``get_enabled_models`` — load + look up entries.
"""

from backend.infrastructure.llm.config.model_config import FailoverEntry, ModelConfig
from backend.infrastructure.llm.config.models_config import (
    get_active_model_name,
    get_enabled_models,
    get_model_config,
    get_models_config,
    reload_models_config,
    reset_models_config,
)
from backend.infrastructure.llm.config.resolvers import resolve_class, resolve_variable

__all__ = [
    "ModelConfig",
    "FailoverEntry",
    "resolve_class",
    "resolve_variable",
    "get_models_config",
    "get_model_config",
    "get_enabled_models",
    "get_active_model_name",
    "reload_models_config",
    "reset_models_config",
]
