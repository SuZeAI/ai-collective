from __future__ import annotations

from typing import Any

import pymongo

from server.domain.models import ActivityFeedItem


_MAX_FEED_ITEMS = 200


class MongoActivityFeedRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["activity_feed"]
        self._col.create_index("id", unique=True, background=True)
        # `_id` is our own `id` (a random UUID hex, see _item_to_doc) — sorting
        # by it is not chronological. Sort/prune by `time` instead, with `_id`
        # only as a tie-break for determinism.
        self._col.create_index([("time", pymongo.DESCENDING), ("_id", pymongo.DESCENDING)], background=True)

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
        # This backs a "recent activity" feed, not an audit trail — bound the
        # query instead of pulling the whole (unboundedly growing) collection
        # into memory on every request.
        docs = self._col.find().sort([("time", -1), ("_id", -1)]).limit(_MAX_FEED_ITEMS)
        return [self._doc_to_item(doc) for doc in docs]

    def add(self, item: ActivityFeedItem) -> ActivityFeedItem:
        self._col.replace_one({"id": item.id}, self._item_to_doc(item), upsert=True)
        self._prune()
        return item

    def _prune(self) -> None:
        """Delete everything past the newest _MAX_FEED_ITEMS (by time, `_id` tie-break)
        so the collection itself stays bounded, not just capped at read time.

        `border` is the (_MAX_FEED_ITEMS + 1)-th newest doc — the first one that
        should NOT survive — so deletion must include it, not just docs older
        than it (an exclusive `$lt`-only bound would off-by-one and leave 201)."""
        border = next(
            self._col.find({}, {"_id": 1, "time": 1})
            .sort([("time", -1), ("_id", -1)])
            .skip(_MAX_FEED_ITEMS)
            .limit(1),
            None,
        )
        if border is None:
            return
        self._col.delete_many(
            {
                "$or": [
                    {"time": {"$lt": border["time"]}},
                    {"time": border["time"], "_id": {"$lte": border["_id"]}},
                ]
            }
        )
