# <img src="./assets/spider.png" height="25" alt="spider" /> AI – Collective
<p align="center">
<img src="./assets/logo.png" width="550" alt="AI Collective Logo">
</p>

<p align="center">
<strong>A high-performance multi-agent orchestration platform for programmable AI workforces.</strong>
</p>

<p align="center">
<a href="#-what-is-ai--collective">About</a> •
<a href="#-key-features">Features</a> •
<a href="#-architecture">Architecture</a> •
<a href="#-staff-topology-modes">Topologies</a> •
<a href="#-option-1--run-locally">Local</a> •
<a href="#-option-2--run-with-docker">Docker</a> •
<a href="#-use-cases">Use Cases</a>
</p>

-----

## 🤖 What is AI – Collective?

**AI – Collective** is a source-available framework (free for educational and research use — see [License](#-license)) for modeling, orchestrating, and executing complex workflows through **Customizable Multi-Agent Departments**. Unlike standard chatbots, it enables the creation of an "AI Workforce" where staff possess specific skills, follow organizational topologies (Sequential, Ring, Mesh, Supervisor, Tree, or Custom), and collaborate to solve high-level objectives — with real-time streaming and human-in-the-loop support.

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| **6 Staff Topologies** | Sequential, Ring, Mesh, Supervisor, Tree, and Custom (user-defined LangGraph DAG) orchestration patterns. |
| **Atomic Skill System** | 50+ built-in toolkits (Google Workspace, web search, social media, messaging platforms, browser automation). Bind granular capabilities to any staff member. |
| **Subagent Support** | Staff can spawn parallel subagents for concurrent task delegation (configurable concurrency + turn limits). |
| **Real-time SSE Streaming** | Turn-by-turn agent response streaming with intermediate event visibility (`agent_start`, `llm_request_start`, `subagent_complete`, etc.). |
| **Knowledge Graph Memory** | Conversation context extraction via spaCy (static) or LLM-based semantic graph building. |
| **Token Budget Management** | Automatic context-window management per agent turn with configurable limits. |
| **Multi-LLM Support** | LLM-agnostic: Google Gemini, OpenAI, Anthropic Claude, OpenRouter — swappable at runtime. |
| **Flexible Storage** | JSON-based (zero setup) or MongoDB persistence. |
| **Human-in-the-Loop** | Seamlessly intervene in agent discussions to provide feedback or steer the workflow. |
| **Auth & Companies** | JWT + Google OAuth sign-in, multi-company isolation, role-based access. |
| **Activity Feed & Analytics** | Real-time activity logging, task metrics, per-agent productivity, and team efficiency dashboards. |

## 🏗️ Architecture

AI – Collective follows **Clean Architecture** with strict layer separation and **fully asynchronous execution**.

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

**Stack:**
- **Frontend**: React 18 + TypeScript 5.8 + Vite 6 + Tailwind CSS + Framer Motion + Radix UI
- **Backend**: FastAPI (Python 3.11+) with Clean Architecture (Domain → Application → Infrastructure → API)
- **Orchestration**: LangGraph 0.2 state machines with 6 topology modes
- **Storage**: JSON (default) or MongoDB 7 via Motor (async driver)
- **Task Queue**: In-memory ThreadPoolExecutor (default) or RabbitMQ (distributed)
- **Distributed Lock**: Threading (default) or Redis
- **Auth**: PyJWT + bcrypt + Google OAuth 2.0

-----

## 🔀 Staff Topology Modes

Select a topology at runtime via the `mode` field in the API request.

### Sequential (default)
Single staff member processes the full request. Fastest and most predictable.

### Ring
Staff execute in circular order: `Staff 0 → Staff 1 → … → Staff N → Staff 0`. Each turn sees the full accumulated conversation history. Continues until `max_rounds` is reached. Ideal for iterative refinement and debate scenarios.

### Mesh
A **hub staff member** connects bidirectionally to N **spoke staff members**. The hub decides which spoke to activate using control blocks (`<NEXT_AGENT>`, `<DISCUSSION_END>`). Best for diverse specialist departments with a central coordinator.

### Supervisor
A **lead staff member** delegates to N **worker staff members** via `<DELEGATE_TO>WorkerName</DELEGATE_TO>`. Workers report back to the lead, which synthesizes results and either delegates again or returns a `<FINAL_ANSWER>`. Ideal for hierarchical manager-worker workflows.

### Tree
Staff are arranged in a hierarchical parent/child tree; results roll up from leaves to root. Ideal for structured, multi-level delegation.

### Custom
A user-defined LangGraph DAG (`CustomGraphSpec`), for workflows that don't fit the built-in topologies.

-----

## ⚙️ Configuration

**`config.yml` (committed to git) is the single, complete source for every
setting, including secrets.** No part of the backend reads a bare OS/`.env`
variable to configure itself — the only way an env var reaches a setting is
an explicit `${VAR}` reference written inline in `config.yml`, resolved from
a `.env` file (gitignored) at startup:

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
  log_file: false               # true → logs/ai_collective.log

auth:
  jwt_secret_key: ${JWT_SECRET_KEY}   # change in production!
  jwt_access_token_expire_minutes: 10080

# Google OAuth (optional social sign-in) — secrets pulled from .env
# google_login_client_id: ${GOOGLE_LOGIN_CLIENT_ID}
# google_login_client_secret: ${GOOGLE_LOGIN_CLIENT_SECRET}
```

See `docs/configuration.md` for the full `config.yml` reference and
`.env.template` for every secret the shipped config references.

-----

## 💻 Option 1 — Run Locally

Requires **Node.js 18+**, **Python 3.11+**, and [**uv**](https://github.com/astral-sh/uv).

> **Note:** The local backend defaults to in-memory task queue and threading lock — no Redis or RabbitMQ needed. Start only the infrastructure services via Docker if you need them (step 3b).

### Prerequisites

```bash
node --version   # v18+
python --version # 3.11+
uv --version     # any recent version
```

### Step 1 — Clone & install dependencies

```bash
git clone https://github.com/SuZeAI/ai-collective.git
cd ai-collective

# Install Python dependencies
uv sync --all-extras

# Install Node.js dependencies
npm ci
```

### Step 2 — Configure environment

```bash
cp .env.template .env
# Edit .env — fill in a provider key referenced by config.yml's models: list
# (e.g. GOOGLE_API_KEY), and toggle the desired model's enabled: true there
```

### Step 3a — Start frontend + backend (minimal, no infra)

Open two terminals:

```bash
# Terminal 1 — Backend (http://localhost:8000)
uv run uvicorn server.api.main:app --reload --port 8000

# Terminal 2 — Frontend (http://localhost:8080)
npm run dev -- --host 0.0.0.0 --port 8080
```

App at **http://localhost:8080** · API docs at **http://localhost:8000/docs**

### Step 3b — (Optional) Start infrastructure services

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

### Useful make targets (local)

| Command | Description |
| :--- | :--- |
| `make backend` | Run backend with hot-reload |
| `make frontend` | Run frontend dev server |
| `make infra` | Start Redis + RabbitMQ via Docker |
| `make infra-down` | Stop infrastructure containers |
| `make install` | Install all dependencies |

-----

## 🐳 Option 2 — Run with Docker

All services (frontend, backend, MongoDB, Redis, RabbitMQ, Nginx) run as Docker containers. Requires **Docker 24+** and **Docker Compose v2**.

### Development mode (hot-reload)

Source files in `server/` and `src/` are mounted into containers — changes are reflected immediately without rebuilding.

```bash
# 1. Configure environment
cp .env.template .env
# Edit .env — fill in a provider key referenced by config.yml's models: list

# 2. Start the full dev stack
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

**Dev commands:**

| Command | Description |
| :--- | :--- |
| `make dev` | Start full dev stack |
| `make dev-down` | Stop and remove dev containers |
| `make dev-logs` | Tail all dev logs |
| `make dev-logs-backend` | Tail only backend logs |
| `make dev-build` | Rebuild images without cache |
| `make dev-ps` | Show container status |

### Production mode

Builds optimized images and serves the frontend via Nginx.

```bash
cp .env.template .env
# Edit .env — fill in a provider key + a strong JWT_SECRET_KEY

make up
# App: http://localhost:2026
```

**Prod commands:**

| Command | Description |
| :--- | :--- |
| `make up` | Start production stack |
| `make down` | Stop and remove production containers |
| `make build` | Rebuild production images |
| `make logs` | Tail all production logs |
| `make ps` | Show container status |
| `make restart` | Restart all containers |

### Optional Docker profiles

**AIO Sandbox** — standalone code execution container, for manual/debug use
(the actual sandbox mode selection below is `local` or `k8s`, not this
container):

```bash
make dev-sandbox    # or: make prod-sandbox
```

**K8s Provisioner** — creates per-request sandbox Pods on Kubernetes:

```bash
make dev-provisioner    # or: make prod-provisioner

# Then in config.yml:
# sandbox:
#   mode: k8s
#   provisioner_url: http://provisioner:8002
```
See `docs/sandbox.md` / `docs/k3s.md` for the full setup.

**MongoDB Express** (prod only):

```bash
docker compose -f docker/docker-compose.yaml --profile mongo-express up -d
# UI: http://localhost:8081
```

**Monitoring tools** (prod only) — Redis Commander + RabbitMQ UI:

```bash
docker compose -f docker/docker-compose.yaml --profile tools up -d
```

> In **dev**, all monitoring UIs are always on — no profile flag needed.

### Services overview

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

> Ports in **bold** are browser-accessible UI endpoints.

-----

## 🛠️ System Components

### Backend (Clean Architecture)

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
└── log/          # Structured logging (console + optional file output)
```

### Frontend

```
src/
├── pages/       # Dashboard, StaffBuilder, DepartmentBuilder, TaskManager,
│                # Meetings, Playground, Analytics, Skills, Settings, Companies
├── components/  # Reusable UI (Radix UI + custom, dark/light theme)
├── contexts/    # AuthContext, LanguageContext (i18n)
├── hooks/       # Custom React hooks
└── lib/         # API client, staff-role mapping utilities
```

### Real-time Event Streaming

`POST /api/v1/llm/staff-graph/run-stream` returns **Server-Sent Events**. Canonical event types live in the `EventType` enum (`server/domain/event/schema.py`):

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

### Integrated Tool Ecosystem (50+ Toolkits)

| Category | Tools |
| :--- | :--- |
| **Google Workspace** | Drive, Docs, Sheets, Calendar |
| **Web & Search** | DuckDuckGo, Brave, HackerNews, Reddit, OpenRouter |
| **Browser Automation** | Playwright-based scraping & interaction |
| **Social Media** | X/Twitter, Bluesky, Instagram, TikTok, YouTube, Reddit, Xiaohongshu |
| **Messaging** | Discord, Slack, Telegram, WhatsApp Business, Signal, Teams, WeChat, Zalo, Line, Viber |
| **Productivity** | HTTP client, Bash command execution, LLM task delegation |
| **Specialized** | Polymarket predictions, image processing (rembg), YouTube (yt-dlp) |

-----

## ⚙️ Advanced Features & Mechanics

### 1. Concurrent Staff Communication
Within the mesh topology (`MultiAgentMeshOrchestrator`), the platform supports running staff queries and subagent task delegations concurrently. By setting `staff.subagent_max_concurrent` in `config.yml` (or `staff.mesh_fanout_max_concurrent` for mesh fan-out specifically), the hub staff member can query multiple spoke staff members simultaneously. This achieves parallel execution of task blocks, dramatically reducing overall process latency.

### 2. Isolated Code Execution Sandboxes
For untrusted code execution (such as Python scripts or shell commands parsed by staff), the system implements a `SandboxProvider` with two execution modes (`sandbox.mode` in `config.yml`):
- **Local**: Executes commands as a subprocess directly in the backend host (for development).
- **Kubernetes (K8s)**: Calls a dedicated remote provisioner service that dynamically spawns per-request sandbox Pods, lifecycle-managed automatically.

### 3. Dynamic Knowledge Graph Memory
Conversations build and consult a persistent semantic model dynamically. Guided by `graph.build_mode` in `config.yml`, the orchestrator extracts entities and relationships from conversation history using:
- **Static Mode**: Fast, local rule-based entity parsing utilizing `spaCy` NLP libraries.
- **LLM Mode**: High-fidelity semantic graph extraction using configurable foundation models to capture complex multi-agent interactions and facts.

### 4. Distributed Task Queuing & Locking
For production-grade scalability, the backend detaches long-running staff-graph runs from the HTTP thread pool using a **RabbitMQ** event bus. Mutual exclusion of staff-graph transitions is enforced via distributed locking (backed by **Redis**).

-----

## 🧪 Use Cases

- **Financial Analysis**: Department of analysts debating market trends based on real-time news.
- **Content Pipeline**: Strategy → Drafting → Critiquing → Final Polish (Supervisor topology).
- **Iterative Research**: Ring topology for multi-round refinement across specialist staff.
- **Software Research**: Automated vulnerability detection and documentation generation.
- **Parallel Task Execution**: Subagents processing independent subtasks concurrently.

## 📚 Documentation

Backend docs live in [`docs/`](docs/README.md): architecture, configuration
(full `config.yml` reference), security, webhooks, staff orchestration, deployment, and the
API reference.

## 🤝 Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md) first. Follow the ports-and-adapters
patterns in the backend and keep frontend components modular and typed. For
security reports, see [SECURITY.md](SECURITY.md).

> By contributing, you agree your contribution is provided under the project
> license and may be relicensed/offered commercially by the copyright holder.

## 📄 License

AI – Collective is released under the **AI – Collective Non-Commercial /
Academic License** — see [LICENSE](LICENSE) and [NOTICE](NOTICE).

- ✅ **Free** for educational and research (non-commercial) use.
- ⛔ **Commercial use** — products, services, SaaS, for-profit internal
  operations, consulting, or redistribution under other terms — is **not**
  granted by this license and requires a **separate written commercial
  license**.

To obtain a commercial license or request any other use, please contact the
author (see below).

## 👨‍💻 Author & Contact

**SuZeAI (SuzeNith)** — AI Research Engineer focused on autonomous multi-agent systems.

- 📧 Email: **suzeai545@gmail.com**
- 🐙 GitHub: **[https://github.com/SuZeAI](https://github.com/SuZeAI)**

For commercial licensing, partnerships, or permissions beyond educational and
research use, please reach out by email.

-----

<p align="center">
© 2026 SuZeAI (SuzeNith) — Released under the
<a href="LICENSE">Non-Commercial / Academic License</a>.
Commercial use requires permission: <a href="mailto:suzeai545@gmail.com">suzeai545@gmail.com</a>.
</p>
