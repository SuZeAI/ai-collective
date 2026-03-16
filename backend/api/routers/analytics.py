from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.api.deps import get_analytics_service
from backend.api.schemas.analytics import AnalyticsSchema
from backend.application.service.analytics_service import AnalyticsService


router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("", response_model=AnalyticsSchema)
def get_analytics(service: AnalyticsService = Depends(get_analytics_service)) -> AnalyticsSchema:
    return AnalyticsSchema.from_domain(service.get_analytics())
