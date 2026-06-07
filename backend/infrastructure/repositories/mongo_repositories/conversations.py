from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pymongo

from backend.domain.models import Message
from backend.infrastructure.repositories._helpers import parse_iso_utc


class MongoConversationRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["conversations"]
        self._col.create_index("id", unique=True, background=True)
        self._col.create_index("taskId", background=True)

    def _doc_to_message(self, item: dict[str, Any]) -> Message:
        ts = str(item.get("timestamp") or "")
        dt = parse_iso_utc(ts) if ts else datetime.now(timezone.utc).replace(microsecond=0)
        return Message(
            id=str(item["id"]),
            agent_id=str(item.get("agentId", "")),
            content=str(item.get("content", "")),
            timestamp=dt,
            task_id=(str(item.get("taskId")) if item.get("taskId") is not None else None),
        )

    def _message_to_doc(self, m: Message) -> dict[str, Any]:
        return {
            "id": m.id,
            "_id": m.id,
            "agentId": m.agent_id,
            "content": m.content,
            "timestamp": m.timestamp.isoformat(),
            "taskId": m.task_id,
        }

    def list(self, task_id: str | None = None) -> list[Message]:
        query = {"taskId": task_id} if task_id is not None else {}
        return [self._doc_to_message(doc) for doc in self._col.find(query)]

    def add(self, message: Message) -> Message:
        self._col.replace_one({"id": message.id}, self._message_to_doc(message), upsert=True)
        return message

    def delete_by_task(self, task_id: str) -> None:
        self._col.delete_many({"taskId": task_id})
