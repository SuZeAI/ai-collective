from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends

import logging

from server.api.deps import (
    current_owner_id_dep,
    get_company_service,
)
from server.api.ownership import require_deletable, require_modifiable
from server.api.schemas.company import CompanySchema, UpsertCompanyRequest
from server.app.service.company_service import CompanyService
from server.domain.errors import NotFoundError
from server.domain.models import Company, is_visible_to
from server.domain.third_party.registry import list_platforms

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("", response_model=list[CompanySchema])
def list_companies(
    service: CompanyService = Depends(get_company_service),
    owner_id: str = Depends(current_owner_id_dep),
):
    return [
        CompanySchema.from_domain(w)
        for w in service.list_companies()
        if is_visible_to(owner_id, w.owner_id)
    ]


@router.post("", response_model=CompanySchema)
def upsert_company(
    req: UpsertCompanyRequest,
    service: CompanyService = Depends(get_company_service),
    owner_id: str = Depends(current_owner_id_dep),
):
    company_id = req.id or f"ws_{uuid4().hex}"
    existing = service.try_get_company(company_id)
    require_modifiable(existing, owner_id, f"Company {company_id!r}")
    created_at = existing.created_at if existing else datetime.now(timezone.utc)
    company = Company(
        id=company_id,
        name=req.name,
        description=req.description or "",
        department_ids=list(req.departmentIds or []),
        primary_department_id=req.primaryDepartmentId or "",
        created_at=created_at,
        type=(req.type or (existing.type if existing else None) or "general"),
        avatar=(req.avatar or "").strip() or req.name[:1].upper() or "W",
        avatar_icon=(req.avatar_icon or "").strip(),
        avatar_color=(req.avatar_color or "").strip(),
        avatar_url=(req.avatar_url or "").strip(),
        owner_id=existing.owner_id if existing else owner_id,
    )
    saved = service.upsert_company(company)
    return CompanySchema.from_domain(saved)


@router.delete("/{company_id}")
def delete_company(
    company_id: str,
    service: CompanyService = Depends(get_company_service),
    owner_id: str = Depends(current_owner_id_dep),
):
    existing = service.try_get_company(company_id)
    require_deletable(existing, owner_id, f"Company {company_id!r}")

    return service.delete_company_cascade(company_id, existing, owner_id)


@router.get("/platforms")
def get_platforms():
    """Return all supported platform definitions and their config field schemas."""
    return list_platforms()


@router.get("/{company_id}", response_model=CompanySchema)
def get_company(
    company_id: str,
    service: CompanyService = Depends(get_company_service),
    owner_id: str = Depends(current_owner_id_dep),
):
    company = service.get_company(company_id)
    if not is_visible_to(owner_id, company.owner_id):
        raise NotFoundError(f"Company {company_id!r} not found")
    return CompanySchema.from_domain(company)
