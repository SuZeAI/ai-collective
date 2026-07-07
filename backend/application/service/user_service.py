from __future__ import annotations

import dataclasses
import uuid
from datetime import datetime, timezone

from backend.application.ports.repositories import UserRepository
from backend.application.ports.security import PasswordHasher
from backend.domain.errors import NotFoundError, ValidationError
from backend.domain.models import User


class UserService:
    def __init__(self, repo: UserRepository, hasher: PasswordHasher) -> None:
        self._repo = repo
        self._hasher = hasher

    def find_by_id(self, user_id: str) -> User:
        user = self._repo.find_by_id(user_id)
        if not user:
            raise NotFoundError(f"User '{user_id}' not found")
        return user

    def find_by_email(self, email: str) -> User | None:
        return self._repo.find_by_email(email)

    def register(self, name: str, email: str, password: str) -> User:
        if self._repo.find_by_email(email):
            raise ValidationError("A user with this email already exists")
        user = User(
            id=str(uuid.uuid4()),
            name=name.strip(),
            email=email.strip().lower(),
            hashed_password=self._hasher.hash(password),
            role="user",
            joined_at=datetime.now(timezone.utc).isoformat(),
        )
        return self._repo.save(user)

    def authenticate(self, email: str, password: str) -> User:
        user = self._repo.find_by_email(email)
        if not user or not self._hasher.verify(password, user.hashed_password):
            raise ValidationError("Invalid email or password")
        return user

    def update_profile(self, user_id: str, *, name: str | None = None, email: str | None = None, avatar: str | None = None) -> User:
        user = self.find_by_id(user_id)
        if email and email.strip().lower() != user.email:
            existing = self._repo.find_by_email(email)
            if existing and existing.id != user_id:
                raise ValidationError("Email is already in use")
        updated = dataclasses.replace(
            user,
            name=(name.strip() if name else user.name),
            email=(email.strip().lower() if email else user.email),
            avatar=(avatar if avatar is not None else user.avatar),
        )
        return self._repo.save(updated)

    def find_or_create_by_oauth(
        self,
        *,
        provider: str,
        provider_id: str,
        email: str,
        name: str,
        avatar: str = "",
    ) -> User:
        """Return an existing OAuth user or create one if they don't exist yet.

        Lookup order:
        1. Match by (provider, provider_id) — the stable link between logins.
        2. Match by email — link an existing local account to the OAuth provider.
        3. Create a new user account.
        """
        user = self._repo.find_by_provider_id(provider, provider_id)
        if user:
            return user

        user = self._repo.find_by_email(email)
        if user:
            # Link the OAuth provider to the existing account
            linked = User(
                id=user.id,
                name=user.name,
                email=user.email,
                hashed_password=user.hashed_password,
                role=user.role,
                joined_at=user.joined_at,
                avatar=user.avatar or avatar,
                provider=provider,
                provider_id=provider_id,
            )
            return self._repo.save(linked)

        new_user = User(
            id=str(uuid.uuid4()),
            name=name.strip() or email.split("@")[0],
            email=email.strip().lower(),
            hashed_password="",
            role="user",
            joined_at=datetime.now(timezone.utc).isoformat(),
            avatar=avatar,
            provider=provider,
            provider_id=provider_id,
        )
        return self._repo.save(new_user)

    def ensure_admin(self, *, email: str, password: str, name: str = "Administrator") -> tuple[User, str]:
        """Idempotently create or sync the bootstrap admin from env config.

        Env is the source of truth: the account is forced to the ``admin`` role
        and its password is reset whenever it no longer matches the configured
        value. Returns ``(user, action)`` where action is one of
        ``"created"`` | ``"updated"`` | ``"unchanged"`` so callers can log it.
        """
        email = email.strip().lower()
        name = name.strip() or "Administrator"
        existing = self._repo.find_by_email(email)

        if not existing:
            user = User(
                id=str(uuid.uuid4()),
                name=name,
                email=email,
                hashed_password=self._hasher.hash(password),
                role="admin",
                joined_at=datetime.now(timezone.utc).isoformat(),
            )
            return self._repo.save(user), "created"

        password_matches = bool(existing.hashed_password) and self._hasher.verify(
            password, existing.hashed_password
        )
        if existing.role == "admin" and existing.name == name and password_matches:
            return existing, "unchanged"

        updated = dataclasses.replace(
            existing,
            role="admin",
            name=name,
            hashed_password=existing.hashed_password if password_matches else self._hasher.hash(password),
        )
        return self._repo.save(updated), "updated"

    def change_password(self, user_id: str, current_password: str, new_password: str) -> None:
        user = self.find_by_id(user_id)
        if not self._hasher.verify(current_password, user.hashed_password):
            raise ValidationError("Current password is incorrect")
        updated = dataclasses.replace(user, hashed_password=self._hasher.hash(new_password))
        self._repo.save(updated)
