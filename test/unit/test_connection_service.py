from __future__ import annotations

from datetime import datetime, timezone

import pytest

from server.app.service.connection_service import ConnectionService
from server.domain.errors import NotFoundError
from server.domain.models import Connection
from server.infra.repositories.json_files.connections import JsonConnectionRepository
from server.infra.repositories.json_store import JsonFileStore


def _make_service(tmp_path) -> ConnectionService:
    store = JsonFileStore(tmp_path / "connections.json")
    repo = JsonConnectionRepository(store)
    return ConnectionService(repo)


def _connection(**overrides) -> Connection:
    defaults = dict(
        id="conn-1",
        platform="telegram",
        name="My Telegram Bot",
        config={"token": "abc"},
        created_at=datetime.now(timezone.utc),
    )
    defaults.update(overrides)
    return Connection(**defaults)


def test_upsert_then_get_roundtrips_connection(tmp_path):
    service = _make_service(tmp_path)
    saved = service.upsert_connection(_connection())

    fetched = service.get_connection(saved.id)

    assert fetched.id == "conn-1"
    assert fetched.platform == "telegram"
    assert fetched.kind == "outbound"  # dataclass default when not set


def test_get_connection_raises_not_found_for_unknown_id(tmp_path):
    service = _make_service(tmp_path)

    with pytest.raises(NotFoundError):
        service.get_connection("does-not-exist")


def test_delete_connection_removes_it(tmp_path):
    service = _make_service(tmp_path)
    service.upsert_connection(_connection())

    service.delete_connection("conn-1")

    with pytest.raises(NotFoundError):
        service.get_connection("conn-1")


def test_delete_unknown_connection_is_a_no_op(tmp_path):
    service = _make_service(tmp_path)

    service.delete_connection("does-not-exist")  # must not raise


def test_list_connections_returns_all_when_no_filters(tmp_path):
    service = _make_service(tmp_path)
    service.upsert_connection(_connection(id="a", company_id="co-1", kind="outbound"))
    service.upsert_connection(_connection(id="b", company_id="co-2", kind="inbound_webhook"))

    items = service.list_connections()

    assert {c.id for c in items} == {"a", "b"}


def test_list_connections_filters_by_company_id(tmp_path):
    service = _make_service(tmp_path)
    service.upsert_connection(_connection(id="a", company_id="co-1"))
    service.upsert_connection(_connection(id="b", company_id="co-2"))

    items = service.list_connections(company_id="co-1")

    assert [c.id for c in items] == ["a"]


def test_list_connections_filters_by_global_company_id_empty_string(tmp_path):
    service = _make_service(tmp_path)
    service.upsert_connection(_connection(id="global", company_id=""))
    service.upsert_connection(_connection(id="scoped", company_id="co-1"))

    items = service.list_connections(company_id="")

    assert [c.id for c in items] == ["global"]


def test_list_connections_filters_by_kind_inbound_webhook(tmp_path):
    service = _make_service(tmp_path)
    service.upsert_connection(_connection(id="hook", kind="inbound_webhook"))
    service.upsert_connection(_connection(id="out", kind="outbound"))

    items = service.list_connections(kind="inbound_webhook")

    assert [c.id for c in items] == ["hook"]


def test_list_connections_combines_company_and_kind_filters(tmp_path):
    service = _make_service(tmp_path)
    service.upsert_connection(_connection(id="match", company_id="co-1", kind="inbound_webhook"))
    service.upsert_connection(_connection(id="wrong-kind", company_id="co-1", kind="outbound"))
    service.upsert_connection(_connection(id="wrong-company", company_id="co-2", kind="inbound_webhook"))

    items = service.list_connections(company_id="co-1", kind="inbound_webhook")

    assert [c.id for c in items] == ["match"]


def test_upsert_persists_routing_fields_for_inbound_webhook(tmp_path):
    service = _make_service(tmp_path)
    saved = service.upsert_connection(
        _connection(
            id="hook",
            kind="inbound_webhook",
            routing_department_id="dept-1",
            routing_staff_ids=["staff-a", "staff-b"],
        )
    )

    fetched = service.get_connection(saved.id)

    assert fetched.routing_department_id == "dept-1"
    assert fetched.routing_staff_ids == ["staff-a", "staff-b"]


def test_upsert_overwrites_existing_connection_with_same_id(tmp_path):
    service = _make_service(tmp_path)
    service.upsert_connection(_connection(name="Original Name"))

    service.upsert_connection(_connection(name="Updated Name"))

    fetched = service.get_connection("conn-1")
    assert fetched.name == "Updated Name"


def test_state_persists_across_service_instances_sharing_the_store(tmp_path):
    """Characterizes that the repo is backed by the JSON file, not just in-memory state."""
    first_service = _make_service(tmp_path)
    first_service.upsert_connection(_connection())

    second_service = _make_service(tmp_path)
    fetched = second_service.get_connection("conn-1")

    assert fetched.id == "conn-1"
