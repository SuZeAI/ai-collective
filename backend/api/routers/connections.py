from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends

from backend.api.deps import get_connection_service
from backend.api.schemas.connection import ConnectionSchema, UpsertConnectionRequest
from backend.application.service.connection_service import ConnectionService
from backend.domain.models import ThirdPartyConnection

router = APIRouter(prefix="/connections", tags=["connections"])


@router.get("", response_model=list[ConnectionSchema])
def list_connections(service: ConnectionService = Depends(get_connection_service)):
    return [ConnectionSchema.from_domain(c) for c in service.list_connections()]


@router.post("", response_model=ConnectionSchema)
def upsert_connection(
    req: UpsertConnectionRequest,
    service: ConnectionService = Depends(get_connection_service),
):
    conn_id = req.id or f"conn_{uuid4().hex}"
    existing = service._repo.get(conn_id)
    created_at = existing.created_at if existing else datetime.now(timezone.utc)
    conn = ThirdPartyConnection(
        id=conn_id,
        platform=req.platform,
        name=req.name,
        config=dict(req.config or {}),
        description=req.description or "",
        created_at=created_at,
    )
    saved = service.upsert_connection(conn)
    return ConnectionSchema.from_domain(saved)


@router.delete("/{conn_id}")
def delete_connection(
    conn_id: str,
    service: ConnectionService = Depends(get_connection_service),
):
    service.delete_connection(conn_id)
    return {"deleted": True}
