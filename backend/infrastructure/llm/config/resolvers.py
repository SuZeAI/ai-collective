"""Dynamic ``"module:ClassName"`` resolution for model-driven config.

Lets ``config.yml`` name a LangChain chat-model class declaratively
(``use: langchain_openai:ChatOpenAI``) and have a builder import it at runtime —
so adding a provider is a config edit, not a code change.
"""

from __future__ import annotations

from importlib import import_module
from typing import TypeVar

T = TypeVar("T")

# Friendly install hints for the common provider integrations.
_MODULE_TO_PACKAGE_HINTS = {
    "langchain_google_genai": "langchain-google-genai",
    "langchain_anthropic": "langchain-anthropic",
    "langchain_openai": "langchain-openai",
    "langchain_deepseek": "langchain-deepseek",
    "langchain_ollama": "langchain-ollama",
}


def _missing_dependency_hint(module_path: str, err: ImportError) -> str:
    module_root = module_path.split(".", 1)[0]
    missing = getattr(err, "name", None) or module_root
    package = _MODULE_TO_PACKAGE_HINTS.get(module_root)
    if package is None:
        package = _MODULE_TO_PACKAGE_HINTS.get(missing, missing.replace("_", "-"))
    return f"Missing dependency '{missing}'. Install it with `uv add {package}` (or `pip install {package}`)."


def resolve_variable(variable_path: str, expected_type: type | tuple[type, ...] | None = None):
    """Resolve ``"module.path:attribute"`` to the attribute object."""
    try:
        module_path, variable_name = variable_path.rsplit(":", 1)
    except ValueError as err:
        raise ImportError(
            f"{variable_path!r} is not a variable path. Expected 'module.path:Name'."
        ) from err

    try:
        module = import_module(module_path)
    except ImportError as err:
        module_root = module_path.split(".", 1)[0]
        if isinstance(err, ModuleNotFoundError) or getattr(err, "name", None) == module_root:
            raise ImportError(
                f"Could not import module {module_path}. {_missing_dependency_hint(module_path, err)}"
            ) from err
        raise ImportError(f"Error importing module {module_path}: {err}") from err

    try:
        variable = getattr(module, variable_name)
    except AttributeError as err:
        raise ImportError(f"Module {module_path} has no attribute {variable_name!r}") from err

    if expected_type is not None and not isinstance(variable, expected_type):
        type_name = (
            expected_type.__name__
            if isinstance(expected_type, type)
            else " or ".join(t.__name__ for t in expected_type)
        )
        raise ValueError(f"{variable_path} is not a {type_name}, got {type(variable).__name__}")

    return variable


def resolve_class(class_path: str, base_class: type[T] | None = None) -> type[T]:
    """Resolve ``"module:ClassName"`` to the class object.

    Args:
        class_path: e.g. ``"langchain_openai:ChatOpenAI"``.
        base_class: when given, the resolved class must be a subclass of it.
    """
    cls = resolve_variable(class_path, expected_type=type)
    if base_class is not None and not issubclass(cls, base_class):
        raise ValueError(f"{class_path} is not a subclass of {base_class.__name__}")
    return cls
