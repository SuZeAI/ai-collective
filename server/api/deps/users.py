from __future__ import annotations

from functools import lru_cache

from server.api.deps._core import _mongo_db, _store
from server.api.settings import settings
from server.app.service.user_service import UserService
from server.infra.repositories.json_files import JsonUserRepository
from server.infra.repositories.mongo_repositories import MongoUserRepository
from server.infra.security import BcryptPasswordHasher
from server.share.log import get_logger


@lru_cache
def _user_store():
    if settings.storage_backend == "mongo":
        return MongoUserRepository(_mongo_db())
    return JsonUserRepository(_store("users.json"))


@lru_cache
def _password_hasher() -> BcryptPasswordHasher:
    return BcryptPasswordHasher()


def get_user_service() -> UserService:
    return UserService(_user_store(), _password_hasher())


def seed_admin_user() -> None:
    """Create/sync the bootstrap admin account from env on startup.

    Reads ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME straight from the
    environment and writes the account into the configured users store (the
    Mongo `users` collection, or users.json). Idempotent and resilient — a
    failure here is logged but never blocks the app from starting.
    """
    if not settings.admin.auto_seed:
        return

    email = (settings.admin.email or "").strip()
    password = settings.admin.password or ""
    name = (settings.admin.name or "Administrator").strip()

    if not email or not password:
        get_logger().info(
            "Admin auto-seed skipped: set ADMIN_EMAIL and ADMIN_PASSWORD in .env to enable it"
        )
        return

    try:
        user, action = get_user_service().ensure_admin(email=email, password=password, name=name)
        if action == "unchanged":
            get_logger().info(f"Admin account already in sync: {user.email}")
        else:
            get_logger().info(f"Admin account {action} from env: {user.email} (id={user.id})")
    except Exception as exc:  # never block startup on a seeding error
        get_logger().error(f"Admin auto-seed failed: {exc}")
