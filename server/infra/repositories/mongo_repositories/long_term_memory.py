from __future__ import annotations

from typing import Any

import pymongo

from server.domain.memory.long_term_memory import MemoryRecord, MemoryScope


class MongoLongTermMemoryRepository:
    """One document per memory record in the ``long_term_memory`` collection."""

    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["long_term_memory"]
        self._col.create_index("id", unique=True, background=True)
        self._col.create_index(
            [("workspace_id", 1), ("owner_id", 1), ("agent_id", 1)], background=True
        )

    def _to_doc(self, record: MemoryRecord) -> dict[str, Any]:
        return {"_id": record.id, **record.to_dict()}

    def get(self, record_id: str) -> MemoryRecord | None:
        doc = self._col.find_one({"id": record_id})
        return MemoryRecord.from_dict(doc) if doc else None

    def upsert(self, record: MemoryRecord) -> MemoryRecord:
        self._col.replace_one({"id": record.id}, self._to_doc(record), upsert=True)
        return record

    def delete(self, record_id: str) -> None:
        self._col.delete_one({"id": record_id})

    def query_scope(self, scope: MemoryScope) -> list[MemoryRecord]:
        scope = scope.normalized()
        # A record matches when, on each dimension, it is broad (None) or equal
        # to the query value. Broad queries (None) impose no constraint there.
        clauses: list[dict[str, Any]] = []
        for field_name, value in (
            ("workspace_id", scope.company_id),
            ("owner_id", scope.owner_id),
            ("agent_id", scope.staff_id),
        ):
            if value is not None:
                clauses.append({"$or": [{field_name: None}, {field_name: value}]})
        query = {"$and": clauses} if clauses else {}
        return [MemoryRecord.from_dict(doc) for doc in self._col.find(query)]
