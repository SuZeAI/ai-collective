from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.api.deps import get_activity_feed_service
from backend.api.schemas.activity_feed import ActivityFeedItemSchema
from backend.application.service.activity_feed_service import ActivityFeedService


router = APIRouter(prefix="/activity-feed", tags=["activity"])


@router.get("", response_model=list[ActivityFeedItemSchema])
def list_items(service: ActivityFeedService = Depends(get_activity_feed_service)) -> list[ActivityFeedItemSchema]:
    return [ActivityFeedItemSchema.from_domain(i) for i in service.list_items()]
