from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING

from server.api.deps._core import _mongo_db, _store
from server.api.settings import settings

if TYPE_CHECKING:
    from server.app.service.document_library_service import DocumentLibraryService


@lru_cache
def _library_document_store():
    if settings.storage_backend == "mongo":
        from server.infra.repositories.mongo_repositories.library_documents import (
            MongoLibraryDocumentRepository,
        )
        return MongoLibraryDocumentRepository(_mongo_db())
    from server.infra.repositories.json_files.library_documents import (
        JsonLibraryDocumentRepository,
    )
    return JsonLibraryDocumentRepository(_store("library_documents.json"))


def get_document_library_service() -> "DocumentLibraryService":
    from server.app.service.document_library_service import DocumentLibraryService

    return DocumentLibraryService(_library_document_store())
