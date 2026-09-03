"""Dependency-free Okapi BM25 ranking — the default local RAG mechanism.

Used to retrieve "additional information" (the most relevant conversation
chunks for a query) without any external service or embedding model. BM25 is a
strong lexical baseline that markedly beats raw term-overlap, so it is the
sensible default when the vector/graph backends are disabled.

Pure functions over an in-memory corpus; no I/O.
"""

from __future__ import annotations

import math

from server.domain.memory.vectors import tokenize

_K1 = 1.5  # term-frequency saturation
_B = 0.75  # length normalisation


def bm25_rank(
    query: str,
    docs: list[tuple[str, str]],
    *,
    top_k: int = 5,
) -> list[tuple[str, float]]:
    """Rank ``docs`` (``(id, text)``) against ``query`` by Okapi BM25.

    Returns the top ``top_k`` ``(id, score)`` pairs with score > 0, best first.
    """
    q_terms = tokenize(query)
    if not q_terms or not docs:
        return []

    tokenized: list[tuple[str, list[str]]] = [(doc_id, tokenize(text)) for doc_id, text in docs]
    n = len(tokenized)
    avgdl = sum(len(toks) for _, toks in tokenized) / n if n else 0.0
    if avgdl == 0:
        return []

    # Document frequency per query term.
    q_set = set(q_terms)
    df: dict[str, int] = {t: 0 for t in q_set}
    for _, toks in tokenized:
        seen = set(toks)
        for t in q_set:
            if t in seen:
                df[t] += 1

    # idf with the standard +0.5 smoothing (floored at 0).
    idf = {
        t: max(0.0, math.log((n - df[t] + 0.5) / (df[t] + 0.5) + 1.0))
        for t in q_set
    }

    scored: list[tuple[str, float]] = []
    for doc_id, toks in tokenized:
        if not toks:
            continue
        dl = len(toks)
        tf: dict[str, int] = {}
        for t in toks:
            if t in q_set:
                tf[t] = tf.get(t, 0) + 1
        score = 0.0
        for t, freq in tf.items():
            denom = freq + _K1 * (1 - _B + _B * dl / avgdl)
            score += idf[t] * (freq * (_K1 + 1)) / denom
        if score > 0:
            scored.append((doc_id, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_k]
