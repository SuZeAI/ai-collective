from __future__ import annotations

import bcrypt

from server.log import get_logger

logger = get_logger(__name__)


class BcryptPasswordHasher:
    """Default ``PasswordHasher`` adapter, backed by bcrypt."""

    def hash(self, plain: str) -> str:
        return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

    def verify(self, plain: str, hashed: str) -> bool:
        try:
            return bcrypt.checkpw(plain.encode(), hashed.encode())
        except Exception as exc:
            # An empty/malformed stored hash (e.g. OAuth-only accounts) is expected;
            # log at debug so genuine encoding bugs are still diagnosable.
            logger.debug("verify_password failed to check hash: %s", exc)
            return False
