from __future__ import annotations

from fastapi import APIRouter, Depends

from backend.api.deps import current_owner_id_dep, get_activity_feed_service, get_agent_service
from backend.api.schemas.activity_feed import ActivityFeedItemSchema
from backend.application.service.activity_feed_service import ActivityFeedService
from backend.application.service.agent_service import AgentService
from backend.domain.models import is_visible_to


router = APIRouter(prefix="/activity-feed", tags=["activity"])


@router.get("", response_model=list[ActivityFeedItemSchema])
def list_items(
    service: ActivityFeedService = Depends(get_activity_feed_service),
    agent_service: AgentService = Depends(get_agent_service),
    owner_id: str = Depends(current_owner_id_dep),
) -> list[ActivityFeedItemSchema]:
    # ActivityFeedItem has no owner_id of its own — scope via the agent it's
    # attributed to, the same way task-scoped endpoints join through Task.
    visible_agent_ids = {a.id for a in agent_service.list_agents() if is_visible_to(owner_id, a.owner_id)}
    return [
        ActivityFeedItemSchema.from_domain(i)
        for i in service.list_items()
        if i.agent_id in visible_agent_ids
    ]
