from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from backend.api.deps import current_owner_id_dep, get_monitoring_service
from backend.api.schemas.consumption import ConsumptionSchema
from backend.application.service.monitoring_service import MonitoringService


router = APIRouter(prefix="/consumption", tags=["consumption"])


@router.get("", response_model=ConsumptionSchema)
def get_consumption(
    days: int = Query(default=30, ge=1, le=365),
    owner_id: str = Depends(current_owner_id_dep),
    service: MonitoringService = Depends(get_monitoring_service),
) -> ConsumptionSchema:
    """Token/cost consumption for the calling user, broken down by department
    (department), staff (staff) and human (user). Scoped to the caller's own runs —
    no admin role required; visibility is enforced by owner_id filtering.
    """
    return ConsumptionSchema.from_summary(service.get_consumption(owner_id, days))
