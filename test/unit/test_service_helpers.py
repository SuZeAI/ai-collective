from __future__ import annotations

import pytest

from server.app.service._helpers import get_or_raise
from server.domain.errors import NotFoundError


def test_get_or_raise_returns_item_when_found():
    assert get_or_raise(lambda id_: {"id": id_}, "Widget", "w1") == {"id": "w1"}


def test_get_or_raise_raises_not_found_with_entity_name_and_id():
    with pytest.raises(NotFoundError, match="Widget 'missing' not found"):
        get_or_raise(lambda id_: None, "Widget", "missing")
