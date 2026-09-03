from __future__ import annotations

from typing import Any
from pydantic import BaseModel

from server.api.schemas.skill import mask_secret_config


class ConnectionSchema(BaseModel):
    id: str
    platform: str
    name: str
    config: dict[str, Any] = {}
    description: str = ""
    enabled: bool = True
    kind: str = "outbound"          # "inbound_webhook" | "outbound"
    companyId: str = ""             # "" = global / account-scoped
    # Routing override for inbound webhooks (empty → company primary department).
    routingDepartmentId: str = ""
    routingStaffIds: list[str] = []
    createdAt: str

    @staticmethod
    def from_domain(c) -> "ConnectionSchema":
        return ConnectionSchema(
            id=c.id,
            platform=c.platform,
            name=c.name,
            config=mask_secret_config(dict(c.config or {})),
            description=c.description,
            enabled=getattr(c, "enabled", True),
            kind=getattr(c, "kind", "outbound") or "outbound",
            companyId=getattr(c, "company_id", "") or "",
            routingDepartmentId=getattr(c, "routing_department_id", "") or "",
            routingStaffIds=list(getattr(c, "routing_staff_ids", []) or []),
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
    routingDepartmentId: str = ""
    routingStaffIds: list[str] = []
