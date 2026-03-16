from __future__ import annotations

from pydantic import BaseModel


class ActivityFeedItemSchema(BaseModel):
    id: str
    agentId: str
    action: str
    time: str

    @staticmethod
    def from_domain(i) -> "ActivityFeedItemSchema":
        return ActivityFeedItemSchema(id=i.id, agentId=i.agent_id, action=i.action, time=i.time)
