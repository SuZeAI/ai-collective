from __future__ import annotations

from server.app.service.activity_feed_service import ActivityFeedService
from server.domain.models import ActivityFeedItem
from server.infra.repositories.json_files.activity_feed import JsonActivityFeedRepository
from server.infra.repositories.json_store import JsonFileStore


def _make_service(tmp_path):
    store = JsonFileStore(tmp_path / "activity_feed.json")
    repo = JsonActivityFeedRepository(store)
    return ActivityFeedService(repo)


def test_list_items_empty_when_no_file_exists(tmp_path):
    service = _make_service(tmp_path)

    assert service.list_items() == []


def test_add_item_returns_the_item_unchanged(tmp_path):
    service = _make_service(tmp_path)
    item = ActivityFeedItem(id="1", staff_id="staff-1", action="did something", time="2026-01-01T00:00:00Z")

    result = service.add_item(item)

    assert result == item


def test_add_item_prepends_so_newest_is_first(tmp_path):
    service = _make_service(tmp_path)
    first = ActivityFeedItem(id="1", staff_id="staff-1", action="first", time="2026-01-01T00:00:00Z")
    second = ActivityFeedItem(id="2", staff_id="staff-1", action="second", time="2026-01-01T00:01:00Z")

    service.add_item(first)
    service.add_item(second)

    items = service.list_items()
    assert [i.id for i in items] == ["2", "1"]


def test_list_items_does_not_reread_disk_if_add_was_never_called_on_this_instance(tmp_path):
    """The in-memory cache is only populated at construction time and refreshed
    by add(); list() itself never re-reads the file, so a write made by another
    repo instance pointed at the same file is invisible until this instance's
    own add() runs."""
    store_path = tmp_path / "activity_feed.json"
    store_a = JsonFileStore(store_path)
    repo_a = JsonActivityFeedRepository(store_a)
    service_a = ActivityFeedService(repo_a)

    store_b = JsonFileStore(store_path)
    repo_b = JsonActivityFeedRepository(store_b)
    service_b = ActivityFeedService(repo_b)

    service_b.add_item(ActivityFeedItem(id="1", staff_id="staff-1", action="from b", time="2026-01-01T00:00:00Z"))

    assert service_a.list_items() == []
    assert [i.id for i in service_b.list_items()] == ["1"]


def test_add_item_caps_the_feed_so_it_does_not_grow_unbounded(tmp_path):
    service = _make_service(tmp_path)
    for i in range(210):
        service.add_item(ActivityFeedItem(id=str(i), staff_id="staff-1", action="did stuff", time=f"2026-01-01T00:00:{i:03d}Z"))

    items = service.list_items()

    assert len(items) == 200
    # Newest (highest i, prepended last) stays; oldest ones fall off.
    assert items[0].id == "209"
    assert "0" not in [i.id for i in items]


def test_add_item_survives_malformed_entries_already_on_disk(tmp_path):
    store = JsonFileStore(tmp_path / "activity_feed.json")
    store.write([{"id": "bad", "action": "kept-because-parseable"}, {"not": "an item at all"}])
    repo = JsonActivityFeedRepository(store)
    service = ActivityFeedService(repo)

    service.add_item(ActivityFeedItem(id="new", staff_id="s", action="added", time="2026-01-01T00:00:00Z"))

    ids = [i.id for i in service.list_items()]
    assert "new" in ids
    assert "bad" in ids
