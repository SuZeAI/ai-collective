# <img src="./assets/spider.png" height="25" alt="spider" /> AI – Collective
<p align="center">
<img src="./assets/logo_1_no_bg.png" width="550" alt="AI Collective Logo">
</p>

<p align="center">
<strong>A high-performance multi-agent orchestration platform for programmable AI workforces.</strong>
</p>

<p align="center">
<a href="#-what-is-ai--collective">About</a> •
<a href="#-key-features">Features</a> •
<a href="#-architecture">Architecture</a> •
<a href="#-agent-topology-modes">Topologies</a> •
<a href="#-option-1--run-locally">Local</a> •
<a href="#-option-2--run-with-docker">Docker</a> •
<a href="#-use-cases">Use Cases</a>
</p>

-----

## 🤖 What is AI – Collective?

**AI – Collective** is an open-source framework for modeling, orchestrating, and executing complex workflows through **Customizable Multi-Agent Teams**. Unlike standard chatbots, it enables the creation of an "AI Workforce" where agents possess specific skills, follow organizational topologies (Sequential, Ring, Mesh, or Supervisor), and collaborate to solve high-level objectives — with real-time streaming and human-in-the-loop support.

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| **4 Agent Topologies** | Sequential, Ring, Mesh, and Supervisor orchestration patterns powered by LangGraph state machines. |
| **Atomic Skill System** | 50+ built-in toolkits (Google Workspace, web search, social media, messaging platforms, browser automation). Bind granular capabilities to any agent. |
| **Subagent Support** | Agents can spawn parallel subagents for concurrent task delegation (configurable concurrency + turn limits). |
| **Real-time SSE Streaming** | Turn-by-turn agent response streaming with intermediate event visibility (`agent_start`, `llm_request_start`, `subagent_complete`, etc.). |
| **Knowledge Graph Memory** | Conversation context extraction via spaCy (static) or LLM-based semantic graph building. |
| **Token Budget Management** | Automatic context-window management per agent turn with configurable limits. |
| **Multi-LLM Support** | LLM-agnostic: Google Gemini, OpenAI, Anthropic Claude, OpenRouter — swappable at runtime. |
| **Flexible Storage** | JSON-based (zero setup) or MongoDB persistence. |
| **Human-in-the-Loop** | Seamlessly intervene in agent discussions to provide feedback or steer the workflow. |
| **Auth & Workspaces** | JWT + Google OAuth sign-in, multi-workspace isolation, role-based access. |
| **Activity Feed & Analytics** | Real-time activity logging, task metrics, per-agent productivity, and team efficiency dashboards. |

## 🏗️ Architecture

AI – Collective follows **Clean Architecture** with strict layer separation and **fully asynchronous execution**.

```mermaid
graph TD
    A[User / Task] --> B[REST API — FastAPI]
    B --> C{Agent Graph Service}
    C -->|sequential| D[LangGraph Agent Orchestrator]
    C -->|ring| E[LangGraph Ring Orchestrator]
    C -->|mesh| F[Multi-Agent Mesh Orchestrator]
    C -->|supervisor| G[LangGraph Supervisor Orchestrator]
    D & E & F & G --> H[Agent Executor + Tool Bindings]
    H --> I[50+ Skill Toolkits]
    H --> J[Subagent Spawner]
    I & J --> K[LLM Provider — Gemini / GPT / Claude / OpenRouter]
    K --> L[SSE Stream → Frontend]
    L --> M[Knowledge Graph + Analytics]
```

**Stack:**
- **Frontend**: React 18 + TypeScript 5.8 + Vite 6 + Tailwind CSS + Framer Motion + Radix UI
- **Backend**: FastAPI (Python 3.11+) with Clean Architecture (Domain → Application → Infrastructure → API)
- **Orchestration**: LangGraph 0.2 state machines with 4 topology modes
- **Storage**: JSON (default) or MongoDB 7 via Motor (async driver)
- **Task Queue**: In-memory ThreadPoolExecutor (default) or RabbitMQ (distributed)
- **Distributed Lock**: Threading (default) or Redis
- **Auth**: PyJWT + bcrypt + Google OAuth 2.0

-----

## 🔀 Agent Topology Modes

Select a topology at runtime via the `mode` field in the API request.

### Sequential (default)
Single agent processes the full request. Fastest and most predictable.

### Ring
Agents execute in circular order: `Agent 0 → Agent 1 → … → Agent N → Agent 0`. Each agent sees the full accumulated conversation history. Continues until `max_rounds` is reached. Ideal for iterative refinement and debate scenarios.

### Mesh
A **hub agent** connects bidirectionally to N **spoke agents**. The hub decides which spoke to activate using control blocks (`<NEXT_AGENT>`, `<DISCUSSION_END>`). Best for diverse specialist teams with a central coordinator.

### Supervisor
A **lead agent** delegates to N **worker agents** via `<DELEGATE_TO>WorkerName</DELEGATE_TO>`. Workers report back to the lead, which synthesizes results and either delegates again or returns a `<FINAL_ANSWER>`. Ideal for hierarchical manager-worker workflows.

-----

## ⚙️ Configuration

Regardless of which run option you choose, start by creating a `.env` file:

```bash
cp .env.template .env
```

Key variables:

```env
# LLM provider — at least one API key is required
LLM_PROVIDER=google          # google | openai | anthropic | openrouter
LLM_MODEL=gemini-2.0-flash
GOOGLE_API_KEY=<your-key>
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
OPENROUTER_API_KEY=

# Storage backend: "json" (default, no setup) or "mongo"
STORAGE_BACKEND=json
MONGO_URI=mongodb://admin:admin@localhost:27017/ai_collective?authSource=admin

# Task queue: "memory" (default) or "rabbitmq"
TASK_QUEUE_BACKEND=memory
TASK_QUEUE_MAX_CONCURRENT=3
RABBITMQ_URL=amqp://guest:guest@localhost:5672/

# Distributed lock: "threading" (default) or "redis"
LOCK_BACKEND=threading
REDIS_URL=redis://localhost:6379/0

# Subagent limits
SUBAGENT_MAX_CONCURRENT=3
SUBAGENT_MAX_TURNS=6

# Token budget per agent turn
AGENT_CONTEXT_TOKEN_LIMIT=12000
AGENT_OUTPUT_TOKEN_RESERVE=2000

# Knowledge graph extraction: "static" (spaCy) or "llm"
GRAPH_BUILD_MODE=static
GRAPH_LLM_PROVIDER=google
GRAPH_LLM_MODEL=gemini-3-flash-preview

# Sandbox code execution: "local" | "docker" | "k8s"
SANDBOX_MODE=local
SANDBOX_TIMEOUT=120

# Logging
LOG_LEVEL=info               # debug | info | warning | error
LOG_CONSOLE=true
LOG_FILE=false               # true → logs/ai_collective.log

# JWT — change in production!
JWT_SECRET_KEY=change-me-in-production-use-openssl-rand-hex-32
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Google OAuth (optional social sign-in)
GOOGLE_LOGIN_CLIENT_ID=
GOOGLE_LOGIN_CLIENT_SECRET=
```

See `.env.template` for all available options.

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
# Edit .env and set at least LLM_PROVIDER + the matching API key
```

### Step 3a — Start frontend + backend (minimal, no infra)

Open two terminals:

```bash
# Terminal 1 — Backend (http://localhost:8000)
uv run uvicorn backend.api.main:app --reload --port 8000

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

# Then update .env:
# STORAGE_BACKEND=mongo
# MONGO_URI=mongodb://admin:admin@localhost:27017/ai_collective?authSource=admin
# TASK_QUEUE_BACKEND=rabbitmq
# RABBITMQ_URL=amqp://guest:guest@localhost:5672/
# LOCK_BACKEND=redis
# REDIS_URL=redis://localhost:6379/0
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

Source files in `backend/` and `src/` are mounted into containers — changes are reflected immediately without rebuilding.

```bash
# 1. Configure environment
cp .env.template .env
# Edit .env — set LLM_PROVIDER + API key at minimum

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
# Edit .env — set LLM_PROVIDER + API key + a strong JWT_SECRET_KEY

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

**AIO Sandbox** — isolated code execution container:

```bash
make dev-sandbox    # or: make prod-sandbox

# Then add to .env:
# SANDBOX_MODE=remote
# SANDBOX_URL=http://sandbox:8080
```

**K8s Provisioner** — creates per-request sandbox Pods on Kubernetes:

```bash
make dev-provisioner    # or: make prod-provisioner

# Then add to .env:
# SANDBOX_MODE=remote
# SANDBOX_PROVISIONER_URL=http://provisioner:8002
```

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
backend/
├── api/          # HTTP routers, request/response schemas, dependency injection
├── application/  # Use-case services, abstract ports (interfaces)
├── domain/       # Business logic
│   ├── agent/    # Orchestrators: sequential, ring, mesh, supervisor + subagent + token budget
│   ├── tools/    # 50+ skill toolkits (Google Workspace, web, social, messaging, sandbox)
│   ├── memory/   # Knowledge graph extraction (spaCy / LLM-based)
│   └── event/    # SSE event schema definitions
├── infrastructure/ # Repositories, LLM factories, task queues, lock providers
└── log/          # Structured logging (console + optional file output)
```

### Frontend

```
src/
├── pages/       # Dashboard, AgentBuilder, TeamBuilder, TaskManager,
│                # Conversations, Playground, Analytics, Skills, Settings, Workspaces
├── components/  # Reusable UI (Radix UI + custom, dark/light theme)
├── contexts/    # AuthContext, LanguageContext (i18n)
├── hooks/       # Custom React hooks
└── lib/         # API client, agent-role mapping utilities
```

### Real-time Event Streaming

`POST /api/v1/llm/agent-graph/run-stream` returns **Server-Sent Events** with the following event types:

| Event | Description |
| :--- | :--- |
| `agent_start` | Orchestrator started |
| `agent_turn_start` | Individual agent turn begins |
| `context_building` | Knowledge graph lookup |
| `context_retrieved` | Graph context ready |
| `llm_request_start` | LLM call dispatched |
| `llm_response_complete` | LLM response received |
| `subagent_start` | Subagent spawned |
| `subagent_complete` | Subagent finished |
| `turn_complete` | Full `GraphTurn` object with agent response |
| `graph_context` | Final knowledge graph summary |

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

### 1. Concurrent Agent Communication
Within the `MultiAgentMeshOrchestrator`, the platform supports running agent queries and subagent task delegations concurrently. By setting the `max_concurrent` parameter (e.g. in the dashboard or environment `SUBAGENT_MAX_CONCURRENT`), the hub agent can query multiple spoke agents simultaneously. This achieves parallel execution of task blocks, dramatically reducing overall process latency.

### 2. Isolated Code Execution Sandboxes
For untrusted code execution (such as Python scripts or shell commands parsed by agents), the system implements a robust `SandboxProvider`. It supports three execution layers:
- **Local**: Executes commands directly in the host OS (for development).
- **Docker**: Spins up isolated ephemeral Docker containers to execute commands safely.
- **Kubernetes (K8s)**: Calls a dedicated remote provisioner service that dynamically spawns per-request sandbox Pods, lifecycle-managed automatically.

### 3. Dynamic Knowledge Graph Memory
Conversations build and consult a persistent semantic model dynamically. Guided by `GRAPH_BUILD_MODE`, the orchestrator extracts entities and relationships from conversation history using:
- **Static Mode**: Fast, local rule-based entity parsing utilizing `spaCy` NLP libraries.
- **LLM Mode**: High-fidelity semantic graph extraction using configurable foundation models to capture complex multi-agent interactions and facts.

### 4. Distributed Task Queuing & Locking
For production-grade scalability, the backend detaches long-running agent loops from the HTTP thread pool using a **RabbitMQ** event bus. Mutual exclusion of agent graph transitions is enforced via distributed locking (supported via **Redis** commander).

-----

## 🧪 Use Cases

- **Financial Analysis**: Team of analysts debating market trends based on real-time news.
- **Content Pipeline**: Strategy → Drafting → Critiquing → Final Polish (Supervisor topology).
- **Iterative Research**: Ring topology for multi-round refinement across specialist agents.
- **Software Research**: Automated vulnerability detection and documentation generation.
- **Parallel Task Execution**: Subagents processing independent subtasks concurrently.

## 🤝 Contributing

We welcome contributions! Please follow the Clean Architecture patterns established in the backend and ensure all frontend components are modular and typed.

## 👨‍💻 Author

**SuZeAI (SuzeNith)** — AI Research Engineer focused on autonomous multi-agent systems.

-----

<p align="center">
Released under the <a href="LICENSE">MIT License</a>.
</p>
