<!---
Copyright 2026 SuZeAI (SuzeNith). All rights reserved.

Licensed under the AI – Collective Non-Commercial / Academic License (the
"License"); you may not use this file except in compliance with the
License. You may obtain a copy of the License at

    ./LICENSE

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

<p align="center">
  <img alt="AI – Collective" src="./assets/logo.png" width="480">
</p>

<p align="center">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Non--Commercial%20%2F%20Academic-blue"></a>
  <a href="https://github.com/SuZeAI/ai-collective/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/SuZeAI/ai-collective/actions/workflows/ci.yml/badge.svg"></a>
  <a href="pyproject.toml"><img alt="Python" src="https://img.shields.io/badge/python-3.11%2B-blue"></a>
  <a href="ui/package.json"><img alt="Node" src="https://img.shields.io/badge/node-18%2B-green"></a>
</p>

<p align="center">
  <a href="#overview">Overview</a> ·
  <a href="#key-features">Features</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#staff-topology-modes">Topologies</a> ·
  <a href="#getting-started">Getting Started</a> ·
  <a href="#use-cases">Use Cases</a>
</p>

<h3 align="center">Create and manage AI-powered companies, of any kind</h3>

AI – Collective is a backend and web application for building and running **companies** — virtual
organizations staffed entirely by AI. Describe a company in chat and the platform proposes its
departments, staff, and skills; from there you can run a software startup, a marketing agency, a
research lab, a trading desk, a content studio, or anything else you can describe, and operate any
number of them side by side from a single control center. Inside each company, "staff" — each with
its own skills, model, and instructions — are arranged into a topology (sequential, ring, mesh,
supervisor, tree, or a fully custom graph) that defines how they hand off work and collaborate
toward a shared objective. Runs stream turn-by-turn over Server-Sent Events, support mid-run human
intervention, and persist a knowledge graph of what has been discussed so far.

See [`docs/`](docs/README.md) for the full architecture, configuration, and API reference.

<p align="center">
  <img alt="AI – Collective landing page" src="./assets/landing-page.png" width="960">
</p>

-----

## Overview

Unlike a single-prompt chatbot, AI – Collective models work the way a real organization does: a
**Company** contains **Departments**, each staffed by **Staff** members with bound **Skills**
(tools). A company's `type` (software, marketing, research, or general) seeds its suggested
structure but never restricts it — the AI Office Designer will build whatever kind of company you
describe. You can create and run any number of companies at once, each isolated with its own
departments, staff, projects, and data, and switch between them (or monitor all of them together)
from the "All" control center. Work inside a company is tracked through a lightweight project
hierarchy (Project → Epic/Sprint → Task), and every staff run is a graph execution — chosen from
six topology modes — rather than a single LLM call. The platform is LLM-agnostic, supports both
JSON and MongoDB persistence, and can scale from a laptop (in-memory queue, threading lock) to a
distributed deployment (RabbitMQ, Redis, Kubernetes sandbox pods).

## Key Features

| Feature | Description |
| :--- | :--- |
| Six staff topologies | Sequential, Ring, Mesh, Supervisor, Tree, and Custom (user-defined LangGraph DAG) orchestration patterns. |
| Atomic skill system | 50+ built-in toolkits (Google Workspace, web search, social media, messaging platforms, browser automation). Bind granular capabilities to any staff member. |
| Subagent support | Staff can spawn parallel subagents for concurrent task delegation, with configurable concurrency and turn limits. |
| Real-time SSE streaming | Turn-by-turn agent response streaming with intermediate event visibility (`agent_start`, `llm_request_start`, `subagent_complete`, and more). |
| Knowledge graph memory | Conversation context extraction via spaCy (static) or LLM-based semantic graph building. |
| Token budget management | Automatic context-window management per agent turn with configurable limits. |
| Multi-LLM support | LLM-agnostic: Google Gemini, OpenAI, Anthropic Claude, and OpenRouter, swappable at runtime. |
| Flexible storage | JSON-based (zero setup) or MongoDB persistence. |
| Human-in-the-loop | Intervene in an in-progress run to provide feedback or steer the workflow. |
| Auth and companies | JWT and Google OAuth sign-in, multi-company isolation, role-based access. |
| Activity feed and analytics | Real-time activity logging, task metrics, per-staff productivity, and department efficiency dashboards. |

## Architecture

AI – Collective follows a ports-and-adapters (hexagonal) architecture with strict layer
separation and fully asynchronous execution.

```mermaid
graph TD
    A[User / Task] --> B[REST API — FastAPI]
    B --> C{Staff Graph Service}
    C -->|sequential| D[LangGraph Orchestrator]
    C -->|ring| E[LangGraph Ring]
    C -->|mesh| F[LangGraph Mesh]
    C -->|supervisor| G[LangGraph Supervisor]
    C -->|tree| N[LangGraph Tree]
    C -->|custom| O[LangGraph Custom DAG]
    D & E & F & G & N & O --> H[Staff Executor + Tool Bindings]
    H --> I[50+ Skill Toolkits]
    H --> J[Subagent Spawner]
    I & J --> K[LLM Provider — Gemini / GPT / Claude / OpenRouter]
    K --> L[SSE Stream → Frontend]
    L --> M[Knowledge Graph + Analytics]
```

**Stack**

- **Frontend** — React 18, TypeScript 5.8, Vite 6, Tailwind CSS, Framer Motion, Radix UI
- **Backend** — FastAPI (Python 3.11+) with a ports-and-adapters layout (Domain → Application → Infrastructure → API)
- **Orchestration** — LangGraph 0.2 state machines with six topology modes
- **Storage** — JSON (default) or MongoDB 7 via Motor (async driver)
- **Task queue** — In-memory `ThreadPoolExecutor` (default) or RabbitMQ (distributed)
- **Distributed lock** — Threading (default) or Redis
- **Auth** — PyJWT, bcrypt, Google OAuth 2.0

-----

## Staff Topology Modes

The topology is selected at runtime via the `mode` field of the API request.

**Sequential (default)** — a single staff member processes the full request. The fastest and most
predictable mode.

**Ring** — staff execute in circular order: `Staff 0 → Staff 1 → … → Staff N → Staff 0`. Each turn
sees the full accumulated conversation history. Continues until `max_rounds` is reached. Suited to
iterative refinement and debate scenarios.

**Mesh** — a hub staff member connects bidirectionally to N spoke staff members and decides which
spoke to activate using control blocks (`<NEXT_AGENT>`, `<DISCUSSION_END>`). Suited to diverse
specialist departments coordinated centrally.

**Supervisor** — a lead staff member delegates to N worker staff members via
`<DELEGATE_TO>WorkerName</DELEGATE_TO>`. Workers report back to the lead, which synthesizes
results and either delegates again or returns a `<FINAL_ANSWER>`. Suited to hierarchical
manager/worker workflows.

**Tree** — staff are arranged in a hierarchical parent/child tree; results roll up from leaves to
root. Suited to structured, multi-level delegation.

**Custom** — a user-defined LangGraph DAG (`CustomGraphSpec`), for workflows that do not fit the
built-in topologies.

-----

## Configuration

`config.yml` (at `.config/config.yml`, committed to git) is the single, complete source for every
setting, including secrets. No part of the backend reads a bare OS or `.env` variable to configure
itself — the only way an env var reaches a setting is an explicit `${VAR}` reference written
inline in `config.yml`, resolved from a `.env` file (gitignored) at startup:

```bash
cp .env.template .env
# fill in at least one provider key referenced by config.yml's models: list,
# e.g. GOOGLE_API_KEY
```

Key sections of `config.yml`:

```yaml
# LLM providers — a list, each with its own key and failover policy
models:
  - name: gemini
    provider_name: Google
    model: gemini-3-flash-preview
    api_key: $GOOGLE_API_KEY
    enabled: true              # flip provider/model by toggling `enabled`
    failover:
      strategy: rotate         # rotate (multi-key) | 9router (external gateway)

# Storage backend: "json" (default, no setup) or "mongo"
storage:
  backend: json

mongo:
  uri: ${MONGO_URI}

# Task queue: "memory" (default) or "rabbitmq"
task_queue:
  backend: memory
  rabbitmq_url: ${RABBITMQ_URL}

# Distributed lock: "threading" (default) or "redis"
lock:
  backend: threading
  redis_url: ${REDIS_URL}

# Staff execution limits
staff:
  subagent_max_concurrent: 3
  subagent_max_turns: 6
  context_token_limit: 12000   # per-turn context budget
  output_token_reserve: 2000

# Knowledge graph extraction: "static" (spaCy) or "llm"
graph:
  build_mode: static

# Sandbox code execution: "local" (default) or "k8s" — no "docker" mode
sandbox:
  mode: local
  timeout: 120

logging:
  log_level: info              # debug | info | warning | error
  log_console: true
  log_file: false               # true → .artifact/logs/ai_collective.log

auth:
  jwt_secret_key: ${JWT_SECRET_KEY}   # change in production!
  jwt_access_token_expire_minutes: 10080

# Google OAuth (optional social sign-in) — secrets pulled from .env
# google_login_client_id: ${GOOGLE_LOGIN_CLIENT_ID}
# google_login_client_secret: ${GOOGLE_LOGIN_CLIENT_SECRET}
```

See `docs/configuration.md` for the full `config.yml` reference and `.env.template` for every
secret the shipped config references.

-----

## Getting Started

### Run Locally

Requires **Node.js 18+**, **Python 3.11+**, and [**uv**](https://github.com/astral-sh/uv).

> The local backend defaults to an in-memory task queue and a threading lock — no Redis or
> RabbitMQ needed. Start infrastructure services via Docker only if you need them (step 3b).

**Prerequisites**

```bash
node --version   # v18+
python --version # 3.11+
uv --version     # any recent version
```

**Step 1 — Clone and install dependencies**

```bash
git clone https://github.com/SuZeAI/ai-collective.git
cd ai-collective

uv sync --all-extras
npm --prefix ui ci
```

**Step 2 — Configure environment**

```bash
cp .env.template .env
# Edit .env — fill in a provider key referenced by config.yml's models: list
# (e.g. GOOGLE_API_KEY), and toggle the desired model's enabled: true there
```

**Step 3a — Start frontend and backend (minimal, no infra)**

Open two terminals:

```bash
# Terminal 1 — Backend (http://localhost:8000)
uv run uvicorn server.api.main:app --reload --port 8000

# Terminal 2 — Frontend (http://localhost:8080)
npm --prefix ui run dev -- --host 0.0.0.0 --port 8080
```

App at **http://localhost:8080**, API docs at **http://localhost:8000/docs**.

**Step 3b — (Optional) Start infrastructure services**

```bash
# Start only Redis + RabbitMQ via Docker Compose
make infra
# Redis:    localhost:6379
# RabbitMQ: localhost:5672  (management UI: http://localhost:15672)

# Or include MongoDB as well
docker compose -f docker/docker-compose-dev.yaml up -d mongodb redis rabbitmq
# MongoDB: localhost:27017

# Then in config.yml, switch backends:
#   storage.backend: mongo
#   task_queue.backend: rabbitmq
#   lock.backend: redis
# and set the matching secrets in .env:
#   MONGO_URI=mongodb://admin:admin@localhost:27017/ai_collective?authSource=admin
#   RABBITMQ_URL=amqp://guest:guest@localhost:5672/
#   REDIS_URL=redis://localhost:6379/0
```

**Useful make targets (local)**

| Command | Description |
| :--- | :--- |
| `make backend` | Run backend with hot-reload |
| `make frontend` | Run frontend dev server |
| `make infra` | Start Redis + RabbitMQ via Docker |
| `make infra-down` | Stop infrastructure containers |
| `make install` | Install all dependencies |

### Run with Docker

All services (frontend, backend, MongoDB, Redis, RabbitMQ, Nginx) run as Docker containers.
Requires **Docker 24+** and **Docker Compose v2**.

**Development mode (hot-reload)**

Source files in `server/` and `ui/` are mounted into containers — changes are reflected
immediately without rebuilding.

```bash
cp .env.template .env
# Edit .env — fill in a provider key referenced by config.yml's models: list

make dev
# or:
docker compose -f docker/docker-compose-dev.yaml up --build -d
```

| URL | Description |
| :--- | :--- |
| http://localhost:2026 | Main application |
| http://localhost:2026/api/v1/docs | Swagger UI |
| http://localhost:2026/api/v1/redoc | ReDoc |
| http://localhost:15672 | RabbitMQ management UI (guest/guest) |
| http://localhost:8083 | Redis Commander |
| http://localhost:8081 | Mongo Express (admin/admin) |
| http://localhost:2026/nginx_status | Nginx connection stats |

**Dev commands**

| Command | Description |
| :--- | :--- |
| `make dev` | Start full dev stack |
| `make dev-down` | Stop and remove dev containers |
| `make dev-logs` | Tail all dev logs |
| `make dev-logs-backend` | Tail only backend logs |
| `make dev-build` | Rebuild images without cache |
| `make dev-ps` | Show container status |

**Production mode**

Builds optimized images and serves the frontend via Nginx.

```bash
cp .env.template .env
# Edit .env — fill in a provider key and a strong JWT_SECRET_KEY

make up
# App: http://localhost:2026
```

**Prod commands**

| Command | Description |
| :--- | :--- |
| `make up` | Start production stack |
| `make down` | Stop and remove production containers |
| `make build` | Rebuild production images |
| `make logs` | Tail all production logs |
| `make ps` | Show container status |
| `make restart` | Restart all containers |

**Optional Docker profiles**

AIO Sandbox — a standalone code execution container, for manual/debug use (the sandbox mode
selection below is `local` or `k8s`, not this container):

```bash
make dev-sandbox    # or: make prod-sandbox
```

K8s Provisioner — creates per-request sandbox Pods on Kubernetes:

```bash
make dev-provisioner    # or: make prod-provisioner

# Then in config.yml:
# sandbox:
#   mode: k8s
#   provisioner_url: http://provisioner:8002
```

See `docs/sandbox.md` and `docs/k3s.md` for the full setup.

MongoDB Express (prod only):

```bash
docker compose -f docker/docker-compose.yaml --profile mongo-express up -d
# UI: http://localhost:8081
```

Monitoring tools (prod only) — Redis Commander and the RabbitMQ management UI:

```bash
docker compose -f docker/docker-compose.yaml --profile tools up -d
```

> In dev, all monitoring UIs are always on — no profile flag needed.

**Services overview**

| Service | Dev port | Prod port | Description |
| :--- | :--- | :--- | :--- |
| App (via Nginx) | **2026** | **2026** | Main entry point |
| Backend API | internal:8000 | internal:8000 | FastAPI |
| Frontend | internal:8080 | internal:8080 | React (Vite dev / serve) |
| MongoDB | 27017 | internal | Database |
| Redis | internal | internal | Distributed lock backend |
| RabbitMQ | 5672, **15672** | 5672, **15672** | Task queue + management UI |
| Mongo Express | **8081** | **8081** (profile) | MongoDB web UI |
| Redis Commander | **8083** | **8083** (profile: tools) | Redis browser UI |
| Nginx status | **2026/nginx_status** | **2026/nginx_status** | Connection & request stats |
| Sandbox | 8081 (profile) | — (profile) | Code execution |
| Provisioner | 8002 (profile) | — (profile) | K8s sandbox manager |

Ports in **bold** are browser-accessible UI endpoints.

-----

## System Components

**Backend (ports-and-adapters)**

```
server/
├── api/          # HTTP routers, request/response schemas, dependency injection
├── app/          # Use-case services, abstract ports (interfaces)
├── domain/       # Business logic
│   ├── staff/    # Orchestrators: sequential, ring, mesh, supervisor, tree, custom + subagent + token budget
│   ├── tools/    # 50+ skill toolkits (Google Workspace, web, social, messaging, sandbox)
│   ├── memory/   # Knowledge graph extraction (spaCy / LLM-based)
│   └── event/    # SSE event schema definitions
├── infra/        # Repositories, LLM factories, task queues, lock providers
└── share/        # Small utilities shared across the layers above (logging, text helpers)
```

**Frontend**

```
ui/src/
├── pages/       # Dashboard, StaffBuilder, DepartmentBuilder, TaskManager,
│                # Meetings, Playground, Analytics, Skills, Settings, Companies
├── components/  # Reusable UI (Radix UI + custom, dark/light theme)
├── contexts/    # AuthContext, LanguageContext (i18n)
├── hooks/       # Custom React hooks
└── lib/         # API client, staff-role mapping utilities
```

**Real-time event streaming**

`POST /api/v1/llm/staff-graph/run-stream` returns Server-Sent Events. Canonical event types live
in the `EventType` enum (`server/domain/event/schema.py`):

| Event | Description |
| :--- | :--- |
| `agent_start` | Orchestrator started (sequential) |
| `agent_turn_start` | Individual turn begins (ring/tree/supervisor/mesh) |
| `context_building` | Knowledge graph lookup starting |
| `context_retrieved` | Graph context ready |
| `llm_request_start` | LLM call dispatched |
| `llm_response_complete` | LLM response received |
| `message_ingested` | Message ingested into the knowledge graph |
| `turn_complete` | Full turn object with staff response |
| `subagent_start` / `subagent_complete` | A staff member spawns/finishes a subagent |
| `fanout_start` / `fanout_complete` | Concurrent branch fan-out begins/ends (supervisor/mesh) |
| `user_message_injected` | A mid-run human interjection was merged into the conversation |
| `run_paused` / `run_resumed` | The run was paused/resumed |
| `user_input_request` / `user_input_received` | The `ask_user` tool is waiting for/received human input |

**Tool ecosystem (50+ toolkits)**

| Category | Tools |
| :--- | :--- |
| Google Workspace | Drive, Docs, Sheets, Calendar |
| Web and search | DuckDuckGo, Brave, HackerNews, Reddit, OpenRouter |
| Browser automation | Playwright-based scraping and interaction |
| Social media | X/Twitter, Bluesky, Instagram, TikTok, YouTube, Reddit, Xiaohongshu |
| Messaging | Discord, Slack, Telegram, WhatsApp Business, Signal, Teams, WeChat, Zalo, Line, Viber |
| Productivity | HTTP client, Bash command execution, LLM task delegation |
| Specialized | Polymarket predictions, image processing (rembg), YouTube (yt-dlp) |

-----

## Advanced Features

**Concurrent staff communication.** Within the mesh topology (`MultiAgentMeshOrchestrator`), staff
queries and subagent task delegations can run concurrently. Setting `staff.subagent_max_concurrent`
in `config.yml` (or `staff.mesh_fanout_max_concurrent` for mesh fan-out specifically) lets the hub
staff member query multiple spoke staff members at once, reducing overall run latency.

**Isolated code execution sandboxes.** Untrusted code — Python scripts or shell commands invoked
by staff — runs through a `SandboxProvider` with two modes (`sandbox.mode` in `config.yml`):
local (a subprocess on the backend host, for development) or Kubernetes (a dedicated provisioner
service spawns per-request sandbox Pods with automatic lifecycle management).

**Dynamic knowledge graph memory.** Conversations build and consult a persistent semantic model.
Guided by `graph.build_mode` in `config.yml`, the orchestrator extracts entities and relationships
from conversation history using either static mode (fast, rule-based parsing with spaCy) or LLM
mode (higher-fidelity semantic extraction using a configurable foundation model).

**Distributed task queuing and locking.** For production-grade scalability, the backend detaches
long-running staff-graph runs from the HTTP thread pool using a RabbitMQ event bus, and enforces
mutual exclusion of staff-graph transitions via distributed locking backed by Redis.

-----

## Use Cases

Any company you can describe, the AI Office Designer can build:

- **Software company** — engineering, QA, and DevOps departments shipping and reviewing code.
- **Marketing agency** — strategy, copy, and design staff running a content pipeline via the
  supervisor topology.
- **Research lab** — analysts debating findings via the ring topology for multi-round refinement.
- **Trading desk** — a department of analysts debating market trends based on real-time news.
- **Any general company** — parallel task execution via subagents processing independent
  subtasks concurrently, regardless of industry.

## Documentation

Backend documentation lives in [`docs/`](docs/README.md): architecture, configuration (the full
`config.yml` reference), security, webhooks, staff orchestration, deployment, and the API
reference.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md) first. Follow the ports-and-adapters patterns in the
backend and keep frontend components modular and typed. For security reports, see
[SECURITY.md](SECURITY.md).

> By contributing, you agree your contribution is provided under the project license and may be
> relicensed or offered commercially by the copyright holder.

## License

AI – Collective is released under the AI – Collective Non-Commercial / Academic License — see
[LICENSE](LICENSE) and [NOTICE](NOTICE).

- Free for educational and research (non-commercial) use.
- Commercial use — products, services, SaaS, for-profit internal operations, consulting, or
  redistribution under other terms — is not granted by this license and requires a separate
  written commercial license.

To obtain a commercial license or request any other use, please contact the author (see below).

## Author and Contact

**SuZeAI (SuzeNith)** — AI research engineer focused on autonomous multi-agent systems.

- **Email:** suzeai545@gmail.com
- **GitHub:** [https://github.com/SuZeAI](https://github.com/SuZeAI)

For commercial licensing, partnerships, or permissions beyond educational and research use,
please reach out by email.

-----

<p align="center">
© 2026 SuZeAI (SuzeNith) — Released under the
<a href="LICENSE">Non-Commercial / Academic License</a>.
Commercial use requires permission: <a href="mailto:suzeai545@gmail.com">suzeai545@gmail.com</a>.
</p>
