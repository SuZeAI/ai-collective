from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from backend.domain.memory.long_term_memory import MemoryScope


@dataclass(frozen=True)
class VectorHit:
    id: str
    score: float


def scope_payload(scope: MemoryScope) -> dict[str, str | None]:
    """Flatten a scope into the payload stored alongside a vector."""
    s = scope.normalized()
    return {"workspace_id": s.company_id, "owner_id": s.owner_id, "agent_id": s.staff_id}


def payload_matches(query: MemoryScope, payload: dict) -> bool:
    """Replicates MemoryScope.matches for backends that filter client-side."""
    q = query.normalized()

    def dim_ok(qv: str | None, rv: str | None) -> bool:
        if rv is None:
            return True
        if qv is None:
            return True
        return qv == rv

    return (
        dim_ok(q.company_id, payload.get("workspace_id"))
        and dim_ok(q.owner_id, payload.get("owner_id"))
        and dim_ok(q.staff_id, payload.get("agent_id"))
    )


class VectorStore(Protocol):
    """Minimal ANN index keyed by record id, with scope payloads.

    Implementations are best-effort: any backend error is swallowed and surfaced
    as an empty result so the LTM service can fall back to brute force.
    """

    def upsert(self, record_id: str, vector: list[float], scope: MemoryScope) -> None: ...

    def search(self, vector: list[float], *, top_k: int, scope: MemoryScope) -> list[VectorHit]: ...

    def delete(self, record_id: str) -> None: ...
