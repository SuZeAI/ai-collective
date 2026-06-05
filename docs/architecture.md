# Architecture

The backend follows a **ports-and-adapters (hexagonal)** design. Dependencies
point inward: the domain knows nothing about the web framework or storage, and
the application layer talks to infrastructure only through Protocols.

```
backend/
├── api/                 # Presentation: FastAPI app, routers, schemas, DI, auth
│   ├── main.py          # App factory, CORS, exception handlers, lifecycle
│   ├── deps.py          # Dependency-injection wiring + current_user_dep
│   ├── security.py      # Password hashing + JWT encode/decode
│   ├── settings.py      # Pydantic settings (env-driven)
│   ├── routers/         # One module per resource
│   └── schemas/         # Pydantic request/response models
├── application/         # Use cases
│   ├── ports/           # Protocols (repositories, llm, agent_graph)
│   └── service/         # Application services (orchestrate domain + ports)
├── domain/              # Core model + business logic (no framework imports)
│   ├── models.py        # Frozen dataclasses (Agent, Team, Task, User, ...)
│   ├── agent/           # LangGraph multi-agent topologies
│   ├── tools/           # LLM tool implementations (http, browser, messaging…)
│   ├── thirty_part/     # Inbound webhook processors (15 platforms)
│   ├── service/         # Domain services (e.g. skill→tool binding)
│   └── memory/          # Knowledge-graph dataclasses
├── infrastructure/      # Adapters
│   ├── repositories/    # JSON-file / Mongo repositories
│   ├── llm/             # LangChain provider adapters
│   ├── sandbox/         # Code-execution sandboxes (local/docker/k8s)
│   ├── browser/         # Playwright / browser-use adapters
│   ├── task_queue.py    # Memory / RabbitMQ task queue
│   └── lock_provider.py # Threading / Redis locks
└── log/                 # Logging setup (rotating file + console)
```

## Layer rules

- **domain** imports nothing from `application`, `api`, or `infrastructure`.
- **application** depends only on `application.ports.*` Protocols, never on
  concrete adapters. (The repository ports include `AgentRepository`,
  `SkillRepository`, `TeamRepository`, `TaskRepository`, `ConnectionRepository`,
  `WorkspaceRepository`, `UserRepository`, and graph/analytics/activity repos.)
- **infrastructure** implements those Protocols; **api/deps.py** is the
  composition root that injects concrete adapters into services.

## Request lifecycle

1. FastAPI routes a request to a handler in `api/routers/`.
2. `Depends(...)` factories in `api/deps.py` build the relevant service with its
   injected repositories / LLM provider.
3. The service runs the use case against domain logic and ports.
4. Domain errors (`NotFoundError`, `ValidationError`) are translated to HTTP
   404 / 422 by exception handlers registered in `main.py`.

## Agent execution

Multi-agent runs are built on **LangGraph**. Five topologies live in
`domain/agent/` (sequential orchestrator, ring, supervisor, tree, mesh) and
share a runtime helper (`_graph_runtime.py`). See
[agent-orchestration.md](agent-orchestration.md).

## Storage

Default storage is **JSON files** under `STORAGE_DIR` (one file per entity
type). A MongoDB backend is selectable via `STORAGE_BACKEND=mongo`. Repositories
are loaded once into memory and rewritten on update — adequate for small/medium
datasets; migrate to a database for large ones.
