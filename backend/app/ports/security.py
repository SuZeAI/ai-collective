from __future__ import annotations

from typing import Protocol


class PasswordHasher(Protocol):
    """Hashes and verifies user passwords. Keeps UserService independent of
    the concrete hashing library and the api layer."""

    def hash(self, plain: str) -> str: ...

    def verify(self, plain: str, hashed: str) -> bool: ...
