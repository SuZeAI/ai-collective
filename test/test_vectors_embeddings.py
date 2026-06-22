"""Tests for shared vector helpers and the pluggable embedding backend.

No pytest-asyncio in this repo, so async paths are driven via ``asyncio.run()``.
"""

from __future__ import annotations

import asyncio

from backend.domain.memory.vectors import (
    cosine,
    cosine_dense,
    lexical_overlap,
    text_vector,
    tokenize,
)
from backend.infrastructure.llm.embeddings import (
    HashingEmbeddingProvider,
    get_embedding_provider,
)


def test_tokenize_drops_short_and_stopwords():
    toks = tokenize("The quick brown fox and a dog")
    assert "the" not in toks and "and" not in toks
    assert "quick" in toks and "brown" in toks


def test_cosine_dense_identical_and_orthogonal():
    assert abs(cosine_dense([1.0, 0.0, 1.0], [1.0, 0.0, 1.0]) - 1.0) < 1e-9
    assert cosine_dense([1.0, 0.0], [0.0, 1.0]) == 0.0
    # mismatched lengths / empties never raise
    assert cosine_dense([1.0], [1.0, 2.0]) == 0.0
    assert cosine_dense([], [1.0]) == 0.0


def test_cosine_sparse_and_lexical_overlap():
    a = text_vector("budget planning meeting")
    b = text_vector("planning budget review")
    assert 0.0 < cosine(a, b) <= 1.0
    assert lexical_overlap("alpha beta gamma", "beta gamma delta") == 0.5
    assert lexical_overlap("", "x") == 0.0


def test_hashing_embedding_is_deterministic_and_normalised():
    p = HashingEmbeddingProvider(dim=64)
    v1 = asyncio.run(p.embed_one("hello world memory"))
    v2 = asyncio.run(p.embed_one("hello world memory"))
    assert v1 == v2
    assert len(v1) == 64
    norm = sum(x * x for x in v1) ** 0.5
    assert abs(norm - 1.0) < 1e-6
    # empty text → zero vector
    assert asyncio.run(p.embed_one("")) is None or all(x == 0 for x in asyncio.run(p.embed_one("  ")) or [0])


def test_get_embedding_provider_disabled_by_default(monkeypatch):
    from backend.api.settings import settings
    from backend.infrastructure.llm import embeddings as emb

    monkeypatch.setattr(settings.embedding, "enabled", False)
    emb.reset_embedding_provider_for_tests()
    assert get_embedding_provider() is None


def test_get_embedding_provider_hashing_when_enabled(monkeypatch):
    from backend.api.settings import settings
    from backend.infrastructure.llm import embeddings as emb

    monkeypatch.setattr(settings.embedding, "enabled", True)
    monkeypatch.setattr(settings.embedding, "provider", "hashing")
    emb.reset_embedding_provider_for_tests()
    provider = get_embedding_provider()
    assert provider is not None
    emb.reset_embedding_provider_for_tests()
