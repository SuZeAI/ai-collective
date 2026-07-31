# Architecture

The backend follows a **ports-and-adapters (hexagonal)** design. Dependencies
point inward: the domain knows nothing about the web framework or storage, and
the application layer talks to infrastructure only through Protocols.

```
backend/
├── api/                 # Presentation: FastAPI app, routers, schemas, DI, auth
│   ├── main.py          # App factory, CORS, exception handlers, lifecycle
│   ├── deps.py          # Dependency-injection wiring + current_user_dep / current_owner_id_dep
│   ├── security.py      # Password hashing + JWT encode/decode
│   ├── settings.py      # Pydantic settings, sourced entirely from config.yml (see configuration.md)
│   ├── config_loader.py # config.yml parsing + ${VAR} secret expansion
│   ├── routers/         # One module per resource (staff, departments, companies, tasks,
│   │                    # projects, epics, sprints, meetings, recruiting, connections, webhook, ...)
│   └── schemas/         # Pydantic request/response models
├── application/         # Use cases
│   ├── ports/           # Protocols (repositories.py, llm.py, staff_graph.py, security.py)
│   └── service/         # Application services (orchestrate domain + ports)
├── domain/              # Core model + business logic (no framework imports)
│   ├── models.py        # Frozen dataclasses (Staff, Department, Company, Task, Project,
│   │                    # Epic, Sprint, Message, User, Connection, ...)
│   ├── staff/           # LangGraph multi-agent topologies (see "Staff execution" below)
│   ├── tools/           # LLM tool implementations (http, browser, messaging…)
│   ├── third_party/     # Inbound webhook processors (15 platforms)
│   ├── service/         # Domain services (e.g. skill→tool binding)
│   ├── memory/          # Knowledge-graph dataclasses
│   ├── event/           # SSE event schema definitions
│   └── prompt/, enums.py, errors.py, pricing_defaults.py, utils/
├── infrastructure/      # Adapters
│   ├── repositories/    # JSON-file / Mongo repositories
│   ├── llm/             # LangChain provider adapters + middleware stack
│   ├── sandbox/         # Code-execution sandboxes (local/k8s — no docker mode)
│   ├── browser/         # Playwright / browser-use adapters
│   ├── vector_store/, long_term_memory_store.py, rag_retrieval_store.py, working_memory_store.py
│   ├── task_queue.py    # Memory / RabbitMQ task queue
│   └── lock_provider.py # Threading / Redis locks
└── log/                 # Logging setup (rotating file + console)
```

## Layer rules

- **domain** imports nothing from `application`, `api`, or `infrastructure`.
- **application** depends only on `application.ports.*` Protocols, never on
  concrete adapters. (`application/ports/repositories.py` defines
  `StaffRepository`, `SkillRepository`, `DepartmentRepository`,
  `TaskRepository`, `ProjectRepository`, `EpicRepository`, `SprintRepository`,
  `MeetingRepository`, `ConnectionRepository`, `CompanyRepository`,
  `UserRepository`, `OfficeBuilderSessionRepository`, `TokenUsageRepository`,
  `ModelPricingRepository`, `SystemSettingsRepository`,
  `GraphKnowledgeRepository`, and `AnalyticsRepository` /
  `ActivityFeedRepository`.)
- **infrastructure** implements those Protocols; **api/deps.py** is the
  composition root that injects concrete adapters into services.

## Request lifecycle

1. FastAPI routes a request to a handler in `api/routers/`.
2. `Depends(...)` factories in `api/deps.py` build the relevant service with its
   injected repositories / LLM provider.
3. The service runs the use case against domain logic and ports.
4. Domain errors (`NotFoundError`, `ValidationError`) are translated to HTTP
   404 / 422 by exception handlers registered in `main.py`.

## Staff execution

Multi-agent runs are built on **LangGraph**. Six topologies live in
`domain/staff/` (sequential orchestrator, ring, supervisor, tree, mesh, and a
user-defined `custom` DAG built from a `CustomGraphSpec`) and share a runtime
helper (`_graph_runtime.py`). See
[agent-orchestration.md](agent-orchestration.md).

## Storage

Default storage is **JSON files** under `storage.dir` (one file per entity
type). A MongoDB backend is selectable via `storage.backend=mongo`. Repositories
are loaded once into memory and rewritten on update — adequate for small/medium
datasets; migrate to a database for large ones.
