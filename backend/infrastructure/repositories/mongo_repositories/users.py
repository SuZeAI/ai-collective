from __future__ import annotations

from typing import Any

import pymongo

from backend.domain.models import User


class MongoUserRepository:
    def __init__(self, db: pymongo.database.Database) -> None:
        self._col = db["users"]
        self._col.create_index("id", unique=True, background=True)
        self._col.create_index("email", unique=True, sparse=True, background=True)

    def _doc_to_user(self, item: dict[str, Any]) -> User:
        return User(
            id=str(item["id"]),
            name=str(item.get("name", "")),
            email=str(item.get("email", "")),
            hashed_password=str(item.get("hashed_password", "")),
            role=str(item.get("role", "user")),
            joined_at=str(item.get("joined_at", "")),
            avatar=str(item.get("avatar", "")),
            provider=str(item.get("provider", "local")),
            provider_id=str(item.get("provider_id", "")),
        )

    def _user_to_doc(self, u: User) -> dict[str, Any]:
        return {
            "id": u.id,
            "_id": u.id,
            "name": u.name,
            "email": u.email.strip().lower(),
            "hashed_password": u.hashed_password,
            "role": u.role,
            "joined_at": u.joined_at,
            "avatar": u.avatar,
            "provider": u.provider,
            "provider_id": u.provider_id,
        }

    def find_by_id(self, user_id: str) -> User | None:
        doc = self._col.find_one({"id": user_id})
        return self._doc_to_user(doc) if doc else None

    def find_by_email(self, email: str) -> User | None:
        doc = self._col.find_one({"email": email.strip().lower()})
        return self._doc_to_user(doc) if doc else None

    def find_by_provider_id(self, provider: str, provider_id: str) -> User | None:
        doc = self._col.find_one({"provider": provider, "provider_id": provider_id})
        return self._doc_to_user(doc) if doc else None

    def save(self, user: User) -> User:
        self._col.replace_one({"id": user.id}, self._user_to_doc(user), upsert=True)
        return user
