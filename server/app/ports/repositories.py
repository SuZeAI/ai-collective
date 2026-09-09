from __future__ import annotations

from datetime import datetime
from typing import Protocol

from server.domain.memory.knowledge_graph import MeetingKnowledgeGraph
from server.domain.models import (
    Staff,
    Skill,
    Department,
    Task,
    Epic,
    Message,
    Analytics,
    ActivityFeedItem,
    ModelPricing,
    OfficeBuilderSession,
    Project,
    Sprint,
    Connection,
    TokenUsageRecord,
    User,
    Company,
)


class StaffRepository(Protocol):
    def list(self) -> list[Staff]:
        ...

    def get(self, staff_id: str) -> Staff | None:
        ...

    def upsert(self, staff: Staff) -> Staff:
        ...

    def delete(self, staff_id: str) -> None:
        ...


class SkillRepository(Protocol):
    def list(self) -> list[Skill]:
        ...

    def get(self, skill_id: str) -> Skill | None:
        ...

    def upsert(self, skill: Skill) -> Skill:
        ...

    def delete(self, skill_id: str) -> None:
        ...


class DepartmentRepository(Protocol):
    def list(self) -> list[Department]:
        ...

    def get(self, department_id: str) -> Department | None:
        ...

    def upsert(self, department: Department) -> Department:
        ...

    def delete(self, department_id: str) -> None:
        ...


class TaskRepository(Protocol):
    def list(self) -> list[Task]:
        ...

    def get(self, task_id: str) -> Task | None:
        ...

    def upsert(self, task: Task) -> Task:
        ...

    def delete(self, task_id: str) -> None:
        ...


class ProjectRepository(Protocol):
    def list(self) -> list[Project]:
        ...

    def get(self, project_id: str) -> Project | None:
        ...

    def upsert(self, project: Project) -> Project:
        ...

    def delete(self, project_id: str) -> None:
        ...

    def allocate_issue_number(self, project_id: str) -> int:
        """Atomically increment and return the project's issue counter.

        This is the single mutable counter on the platform; implementations MUST
        be race-safe (Mongo ``$inc`` / JSON repo lock) rather than letting the
        caller read-modify-write.
        """
        ...


class EpicRepository(Protocol):
    def list(self) -> list[Epic]:
        ...

    def get(self, epic_id: str) -> Epic | None:
        ...

    def upsert(self, epic: Epic) -> Epic:
        ...

    def delete(self, epic_id: str) -> None:
        ...


class SprintRepository(Protocol):
    def list(self) -> list[Sprint]:
        ...

    def get(self, sprint_id: str) -> Sprint | None:
        ...

    def upsert(self, sprint: Sprint) -> Sprint:
        ...

    def delete(self, sprint_id: str) -> None:
        ...


class MeetingRepository(Protocol):
    def list(self, task_id: str | None = None) -> list[Message]:
        ...

    def add(self, message: Message) -> Message:
        ...

    def delete_by_task(self, task_id: str) -> None:
        ...


class AnalyticsRepository(Protocol):
    def get(self) -> Analytics:
        ...

    def set(self, analytics: Analytics) -> Analytics:
        ...


class ActivityFeedRepository(Protocol):
    def list(self) -> list[ActivityFeedItem]:
        ...

    def add(self, item: ActivityFeedItem) -> ActivityFeedItem:
        ...


class ConnectionRepository(Protocol):
    def list(self) -> list[Connection]:
        ...

    def get(self, conn_id: str) -> Connection | None:
        ...

    def upsert(self, conn: Connection) -> Connection:
        ...

    def delete(self, conn_id: str) -> None:
        ...


class OfficeBuilderSessionRepository(Protocol):
    def list(self) -> list[OfficeBuilderSession]:
        ...

    def get(self, session_id: str) -> OfficeBuilderSession | None:
        ...

    def upsert(self, session: OfficeBuilderSession) -> OfficeBuilderSession:
        ...

    def delete(self, session_id: str) -> None:
        ...


class CompanyRepository(Protocol):
    def list(self) -> list[Company]:
        ...

    def get(self, company_id: str) -> Company | None:
        ...

    def upsert(self, company: Company) -> Company:
        ...

    def delete(self, company_id: str) -> None:
        ...


class UserRepository(Protocol):
    def list(self) -> list[User]:
        ...

    def find_by_id(self, user_id: str) -> User | None:
        ...

    def find_by_email(self, email: str) -> User | None:
        ...

    def find_by_provider_id(self, provider: str, provider_id: str) -> User | None:
        ...

    def save(self, user: User) -> User:
        ...


class TokenUsageRepository(Protocol):
    def add(self, record: TokenUsageRecord) -> TokenUsageRecord:
        ...

    def list(self, since: datetime | None = None) -> list[TokenUsageRecord]:
        ...


class ModelPricingRepository(Protocol):
    def list(self) -> list[ModelPricing]:
        ...

    def get(self, model: str) -> ModelPricing | None:
        ...

    def upsert(self, pricing: ModelPricing) -> ModelPricing:
        ...

    def delete(self, model: str) -> None:
        ...


class SystemSettingsRepository(Protocol):
    """Small persisted key-value store for runtime-switchable system settings
    (currently just the Settings-UI active LLM model override)."""

    def get_active_model(self) -> str | None:
        ...

    def set_active_model(self, name: str) -> None:
        ...


class GraphKnowledgeRepository(Protocol):
    def get(self, conversation_id: str) -> MeetingKnowledgeGraph | None:
        ...

    def upsert(self, graph: MeetingKnowledgeGraph) -> MeetingKnowledgeGraph:
        ...

    def delete(self, conversation_id: str) -> None:
        ...

    def append_event(self, conversation_id: str, event: dict[str, object]) -> None:
        ...
