"""Shared vector / lexical similarity helpers for the memory subsystem.

These were previously private to ``graph_context_service`` (``_tokenize`` /
``_term_freq`` / ``_cosine``). They are lifted here so the knowledge graph,
long-term memory and document-library RAG all share one implementation and
behave identically. Pure functions, no I/O.

Two flavours of cosine live here:

* ``cosine`` — sparse, over term-frequency dicts (lexical fallback, no model).
* ``cosine_dense`` — dense, over ``list[float]`` embedding vectors (real RAG).
"""

from __future__ import annotations

import math
import re

# Minimal English stopword set — mirrors the intent of the graph service's list
# but kept self-contained so this module has no upstream dependency.
_STOPWORDS = frozenset(
    {
        "the", "and", "for", "are", "was", "were", "you", "your", "with", "this",
        "that", "from", "have", "has", "had", "but", "not", "they", "their",
        "what", "which", "when", "who", "will", "would", "could", "should",
        "there", "here", "into", "out", "about", "over", "than", "then", "them",
        "its", "it's", "his", "her", "our", "ours", "any", "all", "can", "may",
    }
)

_WORD_RE = re.compile(r"[a-zA-Z0-9_]+")


def tokenize(text: str) -> list[str]:
    """Lowercase word tokens of length ≥ 3, stopwords removed."""
    words = _WORD_RE.findall((text or "").lower())
    return [w for w in words if len(w) >= 3 and w not in _STOPWORDS]


def term_freq(tokens: list[str]) -> dict[str, float]:
    """Normalised term-frequency vector for a token list."""
    if not tokens:
        return {}
    out: dict[str, float] = {}
    total = float(len(tokens))
    for token in tokens:
        out[token] = out.get(token, 0.0) + (1.0 / total)
    return out


def text_vector(text: str) -> dict[str, float]:
    """Convenience: term-frequency vector straight from raw text."""
    return term_freq(tokenize(text))


def cosine(a: dict[str, float], b: dict[str, float]) -> float:
    """Cosine similarity between two sparse term-frequency vectors."""
    if not a or not b:
        return 0.0
    dot = sum(v * b.get(k, 0.0) for k, v in a.items())
    if dot <= 0:
        return 0.0
    norm_a = math.sqrt(sum(v * v for v in a.values()))
    norm_b = math.sqrt(sum(v * v for v in b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def cosine_dense(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two dense embedding vectors.

    Returns 0.0 on empty/mismatched/zero vectors rather than raising, so a
    bad embedding never breaks retrieval.
    """
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0
    for x, y in zip(a, b):
        dot += x * y
        norm_a += x * x
        norm_b += y * y
    if norm_a <= 0.0 or norm_b <= 0.0:
        return 0.0
    return dot / (math.sqrt(norm_a) * math.sqrt(norm_b))


def lexical_overlap(query: str, text: str) -> float:
    """Jaccard-style term overlap in [0, 1] — the no-model recall fallback."""
    q = set(tokenize(query))
    t = set(tokenize(text))
    if not q or not t:
        return 0.0
    return len(q & t) / len(q | t)
