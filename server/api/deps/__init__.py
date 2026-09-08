"""Composition root: wires concrete adapters into services.

Split by domain area into sibling modules; this file just re-exports every
public name so existing call sites (``from server.api.deps import X``) don't
need to change.
"""
from __future__ import annotations

from server.api.deps._core import PROJECT_ROOT, SEED_DIR, STORAGE_DIR, Repos
from server.api.deps.auth import current_owner_id_dep, current_user_dep
from server.api.deps.company import get_company_service, get_connection_service
from server.api.deps.documents import _library_document_store, get_document_library_service
from server.api.deps.meetings import (
    get_activity_feed_service,
    get_analytics_service,
    get_graph_context_service,
    get_meeting_service,
)
from server.api.deps.monitoring import (
    _llm_provider,
    _monitoring_stores,
    _resolve_active_model_config,
    get_llm_service,
    get_monitoring_service,
    get_simulation_service,
    get_staff_graph_service,
    get_system_settings_repository,
    init_usage_tracking,
    refresh_llm_provider,
)
from server.api.deps.office_builder import (
    get_office_builder_service,
    get_office_builder_session_service,
)
from server.api.deps.projects import get_epic_service, get_project_service, get_sprint_service
from server.api.deps.seed import seed_default_data
from server.api.deps.staff import (
    get_department_service,
    get_recruiting_service,
    get_skill_service,
    get_skill_tool_manager,
    get_staff_service,
    get_task_service,
)
from server.api.deps.users import get_user_service, seed_admin_user

__all__ = [
    "PROJECT_ROOT",
    "SEED_DIR",
    "STORAGE_DIR",
    "Repos",
    "current_owner_id_dep",
    "current_user_dep",
    "get_company_service",
    "get_connection_service",
    "_library_document_store",
    "get_document_library_service",
    "get_activity_feed_service",
    "get_analytics_service",
    "get_graph_context_service",
    "get_meeting_service",
    "_llm_provider",
    "_monitoring_stores",
    "_resolve_active_model_config",
    "get_llm_service",
    "get_monitoring_service",
    "get_simulation_service",
    "get_staff_graph_service",
    "get_system_settings_repository",
    "init_usage_tracking",
    "refresh_llm_provider",
    "get_office_builder_service",
    "get_office_builder_session_service",
    "get_epic_service",
    "get_project_service",
    "get_sprint_service",
    "seed_default_data",
    "get_department_service",
    "get_recruiting_service",
    "get_skill_service",
    "get_skill_tool_manager",
    "get_staff_service",
    "get_task_service",
    "get_user_service",
    "seed_admin_user",
]
