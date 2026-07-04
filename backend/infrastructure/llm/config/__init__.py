"""Declarative, model-driven LLM configuration (DeerFlow-style).

Follows the ``context/config.example.yaml`` pattern: chat LLMs are declared as a
``models:`` list in ``config.yml``. Each entry names the LangChain chat-model
class to use via ``use: module:ClassName`` (resolved at runtime) and passes the
rest of its keys straight through to that class. The active model is selected by
``llm.active_model``.

These modules are standalone config loaders — they do not modify or replace the
existing LLM factory/provider wiring.

Public API:
    * ``ModelConfig`` — one model entry.
    * ``resolve_class`` — turn ``"module:ClassName"`` into a class.
    * ``get_models_config`` / ``get_model_config`` — load + look up entries.
"""

from backend.infrastructure.llm.config.model_config import ModelConfig
from backend.infrastructure.llm.config.models_config import (
    get_active_model_name,
    get_model_config,
    get_models_config,
    reload_models_config,
    reset_models_config,
)
from backend.infrastructure.llm.config.resolvers import resolve_class, resolve_variable

__all__ = [
    "ModelConfig",
    "resolve_class",
    "resolve_variable",
    "get_models_config",
    "get_model_config",
    "get_active_model_name",
    "reload_models_config",
    "reset_models_config",
]
