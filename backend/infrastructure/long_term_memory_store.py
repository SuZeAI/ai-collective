"""Process-wide accessor for long-term memory.

Mirrors ``working_memory_store``: it lazily builds the right repository for the
configured ``STORAGE_BACKEND`` (mongo → ``MongoLongTermMemoryRepository``, else
file JSON), wraps it in a ``LongTermMemoryService``, and exposes thin,
never-raising helpers the agent runtime and middleware call directly (no DI).

Everything degrades gracefully: when ``LONG_TERM_MEMORY_ENABLED`` is false the
helpers are no-ops, and any persistence/embedding failure is logged, never
raised — losing a memory must not break a run.
"""

from __future__ import annotations

import contextlib
import contextvars
import threading
from pathlib import Path

from backend.api.settings import settings
from backend.application.service.long_term_memory_service import LongTermMemoryService
from backend.domain.memory.long_term_memory import MemoryRecord, MemoryScope
from backend.log import get_logger

logger = get_logger(__name__)

_lock = threading.RLock()
_service: LongTermMemoryService | None = None

# The scope of the currently-running agent graph. Set once per run (in the
# run-stream / chat endpoint) so the LTM middleware and run-end consolidation
# can read it without threading a scope argument through every topology — the
# same pattern as ``current_usage_user`` in usage_tracker.
current_memory_scope: contextvars.ContextVar[MemoryScope | None] = contextvars.ContextVar(
    "current_memory_scope", default=None
)


@contextlib.contextmanager
def run_scope(scope: MemoryScope | None):
    """Bind ``scope`` as the current run scope for the duration of the block."""
    token = current_memory_scope.set(scope)
    try:
        yield
    finally:
        current_memory_scope.reset(token)


def get_current_scope() -> MemoryScope | None:
    return current_memory_scope.get()


def _build_repo():
    if settings.storage_backend == "mongo":
        try:
            import pymongo

            from backend.infrastructure.repositories.mongo_repositories.long_term_memory import (
                MongoLongTermMemoryRepository,
            )

            client = pymongo.MongoClient(settings.mongo_uri)
            db = client[settings.mongo_db]
            logger.info("Long-term memory persistence: MongoDB (collection=long_term_memory)")
            return MongoLongTermMemoryRepository(db)
        except Exception:  # noqa: BLE001 — degrade to files
            logger.exception("Failed to init Mongo LTM repo; falling back to files")

    from backend.infrastructure.repositories.json_long_term_memory import (
        JsonLongTermMemoryRepository,
    )
    from backend.infrastructure.repositories.json_store import JsonFileStore

    base = settings.storage_dir or "storage"
    store = JsonFileStore(Path(base) / "long_term_memory.json")
    logger.info("Long-term memory persistence: JSON file")
    return JsonLongTermMemoryRepository(store)


def _get_service() -> LongTermMemoryService | None:
    global _service
    if not settings.long_term_memory.enabled:
        return None
    with _lock:
        if _service is None:
            from backend.infrastructure.llm.embeddings import get_embedding_provider

            cfg = settings.long_term_memory
            # An ANN index only helps when embeddings are on (it needs vectors).
            vector_store = None
            provider = get_embedding_provider()
            if provider is not None:
                from backend.infrastructure.vector_store import create_vector_store

                vector_store = create_vector_store(dim=provider.dim)
            _service = LongTermMemoryService(
                _build_repo(),
                embedding_provider_getter=get_embedding_provider,
                vector_store=vector_store,
                recall_top_k=cfg.recall_top_k,
                min_importance=cfg.min_importance,
                dedupe_threshold=cfg.dedupe_threshold,
                digest_chars=cfg.digest_chars,
            )
        return _service


def get_service() -> LongTermMemoryService | None:
    """Expose the service for the API / DI layer (None when disabled)."""
    return _get_service()


async def recall_digest(scope: MemoryScope, query: str) -> str:
    service = _get_service()
    if service is None:
        return ""
    try:
        return await service.recall_digest(scope, query)
    except Exception:  # noqa: BLE001
        logger.exception("LTM recall_digest failed")
        return ""


async def remember(
    scope: MemoryScope,
    content: str,
    *,
    kind: str = "fact",
    importance: float = 0.5,
    source_conversation_id: str | None = None,
) -> MemoryRecord | None:
    service = _get_service()
    if service is None:
        return None
    try:
        return await service.remember(
            scope,
            content,
            kind=kind,
            importance=importance,
            source_conversation_id=source_conversation_id,
        )
    except Exception:  # noqa: BLE001
        logger.exception("LTM remember failed")
        return None


async def consolidate(*, conversation_id: str, scope: MemoryScope) -> int:
    service = _get_service()
    if service is None or not settings.long_term_memory.consolidate_on_run_end:
        return 0
    try:
        return await service.consolidate(conversation_id=conversation_id, scope=scope)
    except Exception:  # noqa: BLE001
        logger.exception("LTM consolidate failed")
        return 0


def reset_for_tests() -> None:
    global _service
    with _lock:
        _service = None
