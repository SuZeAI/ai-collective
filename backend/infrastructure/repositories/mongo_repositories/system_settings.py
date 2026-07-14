from __future__ import annotations

import pymongo


class MongoSystemSettingsRepository:
    _DOC_ID = "singleton"

    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["system_settings"]

    def get_active_model(self) -> str | None:
        doc = self._col.find_one({"_id": self._DOC_ID})
        value = doc.get("active_model") if doc else None
        return str(value) if value else None

    def set_active_model(self, name: str) -> None:
        self._col.update_one(
            {"_id": self._DOC_ID},
            {"$set": {"active_model": name}},
            upsert=True,
        )
