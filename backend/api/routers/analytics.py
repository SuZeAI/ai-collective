from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.api.deps import current_owner_id_dep, get_analytics_service
from backend.api.schemas.analytics import AnalyticsSchema
from backend.app.service.analytics_service import AnalyticsService


router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("", response_model=AnalyticsSchema)
def get_analytics(
    service: AnalyticsService = Depends(get_analytics_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> AnalyticsSchema:
    return AnalyticsSchema.from_domain(service.get_analytics(owner_id))
