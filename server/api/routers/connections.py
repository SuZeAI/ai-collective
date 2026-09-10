from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends

from server.api.deps import get_connection_service, require_admin_dep as require_admin
from server.api.schemas.connection import ConnectionSchema, UpsertConnectionRequest
from server.api.schemas.skill import merge_config_preserving_secrets
from server.app.service.connection_service import ConnectionService
from server.domain.errors import NotFoundError
from server.domain.models import Connection

router = APIRouter(prefix="/connections", tags=["connections"])


@router.get("", response_model=list[ConnectionSchema])
def list_connections(
    company_id: str | None = None,
    kind: str | None = None,
    service: ConnectionService = Depends(get_connection_service),
    _: object = Depends(require_admin),
):
    return [
        ConnectionSchema.from_domain(c)
        for c in service.list_connections(company_id=company_id, kind=kind)
    ]


@router.post("", response_model=ConnectionSchema)
def upsert_connection(
    req: UpsertConnectionRequest,
    service: ConnectionService = Depends(get_connection_service),
    _: object = Depends(require_admin),
):
    conn_id = req.id or f"conn_{uuid4().hex}"
    try:
        existing = service.get_connection(conn_id)
    except NotFoundError:
        existing = None
    created_at = existing.created_at if existing else datetime.now(timezone.utc)
    conn = Connection(
        id=conn_id,
        platform=req.platform,
        name=req.name,
        config=merge_config_preserving_secrets(
            existing.config if existing else None, dict(req.config or {})
        ),
        description=req.description or "",
        created_at=created_at,
        enabled=req.enabled,
        kind=req.kind or "outbound",
        company_id=req.companyId or "",
        owner_id=existing.owner_id if existing else "default",
        routing_department_id=req.routingDepartmentId or "",
        routing_staff_ids=list(req.routingStaffIds or []),
    )
    saved = service.upsert_connection(conn)
    return ConnectionSchema.from_domain(saved)


@router.delete("/{conn_id}")
def delete_connection(
    conn_id: str,
    service: ConnectionService = Depends(get_connection_service),
    _: object = Depends(require_admin),
):
    service.delete_connection(conn_id)
    return {"deleted": True}
