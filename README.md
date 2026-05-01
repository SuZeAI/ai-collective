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
<a href="#-option-1--run-locally">Local</a> •
<a href="#-option-2--run-with-docker">Docker</a> •
<a href="#-use-cases">Use Cases</a>
</p>

-----

## 🤖 What is AI – Collective?

**AI – Collective** is an open-source framework designed to model, orchestrate, and execute complex workflows through **Customizable Multi-Agent Teams**. Unlike standard chatbots, it enables the creation of an "AI Workforce" where agents possess specific skills, follow organizational hierarchies (Peer-to-Peer, Hierarchical, or Self-Organizing), and collaborate to solve high-level objectives.

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| **Atomic Skill System** | Define granular capabilities (Market Analysis, Web Search, API Integration) and inject them into agents. |
| **Agent Personas** | Create agents with unique identities, roles, and behavioral constraints. |
| **Dynamic Team Structures** | Model real-world organizations: Flat teams for brainstorming or Hierarchical for production. |
| **Multi-Agent Discussion** | Real-time message exchange, critique, and consensus-building between agents. |
| **Human-in-the-Loop** | Seamlessly intervene in agent discussions to provide feedback or steer the workflow. |
| **Real-time Monitoring** | Comprehensive dashboard to track task progress, agent logs, and system performance. |

## 🏗️ Architecture

AI – Collective is built with a focus on **Clean Architecture** and **Asynchronous Execution**.

```mermaid
graph TD
    A[User/Task] --> B[Team Orchestrator]
    B --> C{Organization Type}
    C -->|Hierarchical| D[Leader -> Workers]
    C -->|Peer-to-Peer| E[Collaborative Mesh]
    D & E --> F[Skill Execution]
    F --> G[Google Workspace/Search/API]
    G --> H[Final Result & Monitoring]
```

  * **Frontend**: React + TypeScript + Vite + Tailwind CSS + Framer Motion.
  * **Backend**: FastAPI (Python 3.11+) with Clean Architecture boundaries.
  * **Intelligence**: LLM-agnostic (optimized for Gemini-2.0-Flash) via agent-graph orchestration.
  * **Storage**: JSON-based (default) or MongoDB persistence.

-----

## ⚙️ Configuration

Regardless of which run option you choose, start by creating a `.env` file:

```bash
cp .env.template .env
```

Then fill in your values. The key variables are:

```env
# LLM provider — at least one API key is required
LLM_PROVIDER=google
LLM_MODEL=gemini-2.0-flash
GOOGLE_API_KEY=<your-key>

# Storage backend: "json" (default, no setup) or "mongo"
STORAGE_BACKEND=json

# JWT secret — change this in production!
JWT_SECRET_KEY=change-me-in-production-use-openssl-rand-hex-32

# Google OAuth (for social sign-in — optional)
GOOGLE_LOGIN_CLIENT_ID=
GOOGLE_LOGIN_CLIENT_SECRET=
```

See `.env.template` for all available options (MongoDB, RabbitMQ, sandbox, logging, etc.).

-----

## 💻 Option 1 — Run Locally

Run the frontend and backend directly on your machine. Requires **Node.js**, **Python 3.11+**, and [**uv**](https://github.com/astral-sh/uv).

> **Note:** The local backend defaults to in-memory task queue and threading lock — no Redis or RabbitMQ needed. For full feature parity you can start only the infrastructure services via Docker (step 3b below).

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

App is available at **http://localhost:8080** · API docs at **http://localhost:8000/docs**

### Step 3b — (Optional) Start infrastructure services

If you need MongoDB, Redis, or RabbitMQ locally without running the full Docker stack:

```bash
# Start only redis + rabbitmq via Docker Compose
make infra
# Redis:    localhost:6379
# RabbitMQ: localhost:5672  (management UI: http://localhost:15672)

# Or include MongoDB as well
docker compose -f docker/docker-compose-dev.yaml up -d mongodb redis rabbitmq
# MongoDB:  localhost:27017

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

All services (frontend, backend, MongoDB, Redis, RabbitMQ, Nginx) run as Docker containers. Requires **Docker** and **Docker Compose v2**.

```bash
docker --version         # 24+
docker compose version   # v2.x
```

### Development mode (hot-reload)

The development stack mounts your source files into the containers — code changes in `backend/` and `src/` are reflected immediately without rebuilding.

```bash
# 1. Configure environment
cp .env.template .env
# Edit .env — set LLM_PROVIDER + API key at minimum

# 2. Start the full dev stack
make dev
# or directly:
docker compose -f docker/docker-compose-dev.yaml up --build -d

# 3. Open the app
#    App:              http://localhost:2026
#    API docs:         http://localhost:2026/api/v1/docs       — Swagger UI (frontend owns /docs)
#    API redoc:        http://localhost:2026/api/v1/redoc
#    RabbitMQ UI:      http://localhost:15672  (guest/guest)   — queues, message rates, connections
#    Redis Commander:  http://localhost:8083                   — browse keys, values, TTL
#    Mongo Express:    http://localhost:8081   (admin/admin)   — collections, documents
#    Nginx status:     http://localhost:2026/nginx_status      — active connections, requests/sec
```

**Useful dev commands:**

| Command | Description |
| :--- | :--- |
| `make dev` | Start full dev stack |
| `make dev-down` | Stop and remove dev containers |
| `make dev-logs` | Tail all dev logs |
| `make dev-logs-backend` | Tail only backend logs |
| `make dev-build` | Rebuild images without cache |
| `make dev-ps` | Show container status |

### Production mode

The production stack builds optimized images and serves the frontend via Nginx.

```bash
# 1. Configure environment
cp .env.template .env
# Edit .env — set LLM_PROVIDER + API key + a strong JWT_SECRET_KEY

# 2. Build and start
make up
# or directly:
docker compose -f docker/docker-compose.yaml up -d

# 3. Open the app
#    App: http://localhost:2026
```

**Useful prod commands:**

| Command | Description |
| :--- | :--- |
| `make up` | Start production stack |
| `make down` | Stop and remove production containers |
| `make build` | Rebuild production images |
| `make logs` | Tail all production logs |
| `make ps` | Show container status |
| `make restart` | Restart all containers |

### Optional Docker profiles

Both `dev` and `prod` stacks support optional add-on services via Docker Compose profiles:

**AIO Sandbox** — isolated code execution container:

```bash
# Dev
docker compose -f docker/docker-compose-dev.yaml --profile sandbox up -d
# Prod
make prod-sandbox

# Then add to .env:
# SANDBOX_MODE=remote
# SANDBOX_URL=http://sandbox:8080
```

**K8s Provisioner** — creates per-request sandbox Pods on Kubernetes:

```bash
# Dev
make dev-provisioner
# Prod
make prod-provisioner

# Then add to .env:
# SANDBOX_MODE=remote
# SANDBOX_PROVISIONER_URL=http://provisioner:8002
```

**MongoDB Express** (prod only) — web UI for MongoDB:

```bash
docker compose -f docker/docker-compose.yaml --profile mongo-express up -d
# UI: http://localhost:8081  (MONGO_USER/MONGO_PASS)
```

**Monitoring tools** (prod only) — Redis Commander + RabbitMQ Management UI:

```bash
docker compose -f docker/docker-compose.yaml --profile tools up -d
# Redis Commander:  http://localhost:8083        — browse keys, values, TTL, memory stats
# RabbitMQ UI:      http://localhost:15672       — queues, bindings, message rates
```

> In **dev**, both UIs are always on — no profile flag needed.
> The RabbitMQ Management plugin is built into the `rabbitmq:3-management-alpine` image used by both stacks.

### Services overview

| Service | Dev port | Prod port | Description |
| :--- | :--- | :--- | :--- |
| App (via Nginx) | 2026 | 2026 | Main entry point |
| Backend API | internal:8000 | internal:8000 | FastAPI |
| Frontend | internal:8080 | internal:8080 | React (Vite dev / `serve`) |
| MongoDB | 27017 | internal | Database |
| Redis | internal | internal | Distributed lock backend |
| RabbitMQ | 5672, **15672** | 5672, **15672** | Task queue + Management UI |
| Mongo Express | **8081** | **8081** (profile) | MongoDB web UI |
| Redis Commander | **8083** | **8083** (profile: tools) | Redis browser UI |
| Nginx status | **2026/nginx_status** | **2026/nginx_status** | Connection & request stats |
| Sandbox | 8081 (profile) | — (profile) | Code execution |
| Provisioner | 8002 (profile) | — (profile) | K8s sandbox manager |

> Ports in **bold** are browser-accessible UI endpoints.

-----

## 🛠️ System Components

  * **Skill System**: The DNA of agents. Supports both cognitive (logic) and tool-based (API) skills.
  * **Communication Layer**: Manages message passing, state synchronization, and streaming (SSE).
  * **Monitoring**: A transparent log system to "watch your team work" in real-time.

## 🧪 Use Cases

  * **Financial Analysis**: Team of analysts debating market trends based on real-time news.
  * **Content Pipeline**: Strategy → Drafting → Critiquing → Final Polish.
  * **Software Research**: Automated vulnerability detection and documentation generation.

## 🤝 Contributing

We welcome contributions! Please follow the Clean Architecture patterns established in the backend and ensure all frontend components are modular.

## 👨‍💻 Author

**SuZeAI (SuzeNith)** - AI Research Engineer focused on autonomous multi-agent systems.

-----

<p align="center">
Released under the <a href="LICENSE">MIT License</a>.
</p>
