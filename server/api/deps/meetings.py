from __future__ import annotations

from server.api.deps._core import _repos
from server.api.settings import settings
from server.app.service.activity_feed_service import ActivityFeedService
from server.app.service.analytics_service import AnalyticsService
from server.app.service.graph_context_service import GraphContextService
from server.app.service.meeting_service import MeetingService
from server.infra.llm.factory import build_default_llm_provider


def get_meeting_service() -> MeetingService:
    repos = _repos()
    conversations, graph_knowledge = repos.conversations, repos.graph_knowledge
    graph_llm = None
    if settings.graph_build_mode == "llm":
        graph_llm = build_default_llm_provider(
            provider=settings.graph_llm_provider,
            model=settings.graph_llm_model,
        )
    return MeetingService(
        conversations,
        GraphContextService(
            graph_knowledge,
            llm_provider=graph_llm,
            build_mode=settings.graph_build_mode,
        ),
    )


def get_analytics_service() -> AnalyticsService:
    repos = _repos()
    return AnalyticsService(repos.analytics, repos.tasks)


def get_activity_feed_service() -> ActivityFeedService:
    return ActivityFeedService(_repos().activity_feed)


def get_graph_context_service() -> GraphContextService:
    graph_knowledge = _repos().graph_knowledge
    graph_llm = None
    if settings.graph_build_mode == "llm":
        graph_llm = build_default_llm_provider(
            provider=settings.graph_llm_provider,
            model=settings.graph_llm_model,
        )
    return GraphContextService(
        graph_knowledge,
        llm_provider=graph_llm,
        build_mode=settings.graph_build_mode,
    )
