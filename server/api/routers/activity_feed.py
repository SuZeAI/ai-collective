from __future__ import annotations

from fastapi import APIRouter, Depends

from server.api.deps import current_owner_id_dep, get_activity_feed_service, get_staff_service
from server.api.schemas.activity_feed import ActivityFeedItemSchema
from server.app.service.activity_feed_service import ActivityFeedService
from server.app.service.staff_service import StaffService
from server.domain.models import is_visible_to


router = APIRouter(prefix="/activity-feed", tags=["activity"])


@router.get("", response_model=list[ActivityFeedItemSchema])
def list_items(
    service: ActivityFeedService = Depends(get_activity_feed_service),
    staff_service: StaffService = Depends(get_staff_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> list[ActivityFeedItemSchema]:
    # ActivityFeedItem has no owner_id of its own — scope via the staff member
    # it's attributed to, the same way task-scoped endpoints join through Task.
    visible_staff_ids = {a.id for a in staff_service.list_staff() if is_visible_to(owner_id, a.owner_id)}
    return [
        ActivityFeedItemSchema.from_domain(i)
        for i in service.list_items()
        if i.staff_id in visible_staff_ids
    ]
