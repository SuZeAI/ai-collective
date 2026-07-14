from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from backend.api.deps import current_user_dep, get_monitoring_service
from backend.api.schemas.consumption import ConsumptionSchema
from backend.application.service.monitoring_service import MonitoringService
from backend.domain.models import User


router = APIRouter(prefix="/consumption", tags=["consumption"])


@router.get("", response_model=ConsumptionSchema)
def get_consumption(
    days: int = Query(default=30, ge=1, le=365),
    user: User = Depends(current_user_dep),
    service: MonitoringService = Depends(get_monitoring_service),
) -> ConsumptionSchema:
    """Token/cost consumption for the calling user, broken down by department
    (department), staff (staff) and human (user). Scoped to the caller's own runs —
    no admin role required. Token-usage records are always tagged with the real
    authenticated user id, so we must filter by that id rather than owner_id
    (which collapses to the shared "default" scope for admin/system accounts).
    """
    return ConsumptionSchema.from_summary(service.get_consumption(user.id, days))
