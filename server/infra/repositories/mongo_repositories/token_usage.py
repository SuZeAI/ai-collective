from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pymongo

from server.domain.models import TokenUsageRecord


def _parse_timestamp(value: Any) -> datetime:
    try:
        ts = datetime.fromisoformat(str(value))
        return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
    except Exception:
        return datetime.now(timezone.utc)


class MongoTokenUsageRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["token_usage"]
        self._col.create_index("timestamp", background=True)
        self._col.create_index("user_id", background=True)

    def _doc_to_record(self, item: dict[str, Any]) -> TokenUsageRecord:
        return TokenUsageRecord(
            id=str(item["id"]),
            provider=str(item.get("provider", "")),
            model=str(item.get("model", "")),
            input_tokens=int(item.get("input_tokens", 0)),
            output_tokens=int(item.get("output_tokens", 0)),
            total_tokens=int(item.get("total_tokens", 0)),
            user_id=str(item.get("user_id", "system")),
            timestamp=_parse_timestamp(item.get("timestamp")),
            staff_name=str(item.get("agent_name", "")),
            department_id=str(item.get("department_id", "")),
            cache_read_tokens=int(item.get("cache_read_tokens", 0) or 0),
            cache_creation_tokens=int(item.get("cache_creation_tokens", 0) or 0),
        )

    def add(self, record: TokenUsageRecord) -> TokenUsageRecord:
        self._col.insert_one(
            {
                "_id": record.id,
                "id": record.id,
                "provider": record.provider,
                "model": record.model,
                "input_tokens": record.input_tokens,
                "output_tokens": record.output_tokens,
                "total_tokens": record.total_tokens,
                "user_id": record.user_id,
                # ISO strings sort lexicographically == chronologically (UTC)
                "timestamp": record.timestamp.isoformat(),
                "agent_name": record.staff_name,
                "department_id": record.department_id,
                "cache_read_tokens": record.cache_read_tokens,
                "cache_creation_tokens": record.cache_creation_tokens,
            }
        )
        return record

    def list(self, since: datetime | None = None) -> list[TokenUsageRecord]:
        query: dict[str, Any] = {}
        if since is not None:
            cutoff = since if since.tzinfo else since.replace(tzinfo=timezone.utc)
            query["timestamp"] = {"$gte": cutoff.isoformat()}
        return [self._doc_to_record(doc) for doc in self._col.find(query)]
