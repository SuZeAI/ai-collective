from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from server.app.ports.repositories import ActivityFeedRepository
from server.domain.models import ActivityFeedItem


def format_response_action(content: str) -> str:
    collapsed = " ".join(content.split())
    snippet = collapsed[:80] + ("..." if len(collapsed) > 80 else "")
    return f'responded: "{snippet}"' if snippet else "responded"


class ActivityFeedService:
    def __init__(self, repo: ActivityFeedRepository):
        self._repo = repo

    def list_items(self) -> list[ActivityFeedItem]:
        return self._repo.list()

    def add_item(self, item: ActivityFeedItem) -> ActivityFeedItem:
        return self._repo.add(item)

    def log(self, staff_id: str, action: str) -> ActivityFeedItem:
        # Fixed-width UTC timestamp (always includes microseconds) so that
        # lexicographic sort on `time` in the repositories matches chronological
        # order — datetime.isoformat() drops the fractional part when it's zero.
        item = ActivityFeedItem(
            id=f"activity_{uuid4().hex}",
            staff_id=staff_id,
            action=action,
            time=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        )
        return self._repo.add(item)
