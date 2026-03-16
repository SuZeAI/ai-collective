from __future__ import annotations

from backend.application.ports.repositories import ActivityFeedRepository
from backend.domain.models import ActivityFeedItem


class ActivityFeedService:
    def __init__(self, repo: ActivityFeedRepository):
        self._repo = repo

    def list_items(self) -> list[ActivityFeedItem]:
        return self._repo.list()

    def add_item(self, item: ActivityFeedItem) -> ActivityFeedItem:
        return self._repo.add(item)
