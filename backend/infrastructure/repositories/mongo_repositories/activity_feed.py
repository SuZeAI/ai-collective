from __future__ import annotations

from typing import Any

import pymongo

from backend.domain.models import ActivityFeedItem


class MongoActivityFeedRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["activity_feed"]
        self._col.create_index("id", unique=True, background=True)

    def _doc_to_item(self, item: dict[str, Any]) -> ActivityFeedItem:
        return ActivityFeedItem(
            id=str(item["id"]),
            staff_id=str(item.get("agentId", "")),
            action=str(item.get("action", "")),
            time=str(item.get("time", "")),
        )

    def _item_to_doc(self, i: ActivityFeedItem) -> dict[str, Any]:
        return {
            "id": i.id,
            "_id": i.id,
            "agentId": i.staff_id,
            "action": i.action,
            "time": i.time,
        }

    def list(self) -> list[ActivityFeedItem]:
        return [self._doc_to_item(doc) for doc in self._col.find().sort("_id", -1)]

    def add(self, item: ActivityFeedItem) -> ActivityFeedItem:
        self._col.replace_one({"id": item.id}, self._item_to_doc(item), upsert=True)
        return item
