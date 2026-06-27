from __future__ import annotations

from typing import Any
from pydantic import BaseModel


class ConnectionSchema(BaseModel):
    id: str
    platform: str
    name: str
    config: dict[str, Any] = {}
    description: str = ""
    enabled: bool = True
    kind: str = "outbound"          # "inbound_webhook" | "outbound"
    companyId: str = ""             # "" = global / account-scoped
    createdAt: str

    @staticmethod
    def from_domain(c) -> "ConnectionSchema":
        return ConnectionSchema(
            id=c.id,
            platform=c.platform,
            name=c.name,
            config=dict(c.config or {}),
            description=c.description,
            enabled=getattr(c, "enabled", True),
            kind=getattr(c, "kind", "outbound") or "outbound",
            companyId=getattr(c, "company_id", "") or "",
            createdAt=c.created_at.isoformat(),
        )


class UpsertConnectionRequest(BaseModel):
    id: str | None = None
    platform: str
    name: str
    config: dict[str, Any] = {}
    description: str = ""
    enabled: bool = True
    kind: str = "outbound"
    companyId: str = ""
