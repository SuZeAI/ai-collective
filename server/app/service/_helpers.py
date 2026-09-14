from __future__ import annotations

from typing import Callable, TypeVar

from server.domain.errors import NotFoundError

T = TypeVar("T")


def get_or_raise(getter: Callable[[str], "T | None"], entity_name: str, entity_id: str) -> T:
    """Fetch *entity_id* via *getter*, or raise NotFoundError(f"{entity_name} '{id}' not found")."""
    item = getter(entity_id)
    if not item:
        raise NotFoundError(f"{entity_name} '{entity_id}' not found")
    return item
