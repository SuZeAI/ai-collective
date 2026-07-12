# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AI – Collective: a multi-agent orchestration platform ("programmable AI workforce"). React 18 + TypeScript frontend (`/src`) talking to a FastAPI backend (`/backend`) that runs LangGraph-based multi-agent topologies. Source-available, non-commercial license (see `LICENSE`/`NOTICE`).

## Commands

### Setup
```bash
make install          # uv sync --all-extras + npm ci
cp .env.template .env # then set LLM_PROVIDER + matching API key at minimum
```

### Run locally (no Docker)
```bash
make backend                        # uvicorn --reload on :8000 (needs `make infra` for redis/rabbitmq if used)
make frontend                       # vite dev server on :8080
make infra / make infra-down        # redis + rabbitmq only, for local backend dev
```
Default local config needs no infra: `STORAGE_BACKEND=json`, `TASK_QUEUE_BACKEND=memory`, `LOCK_BACKEND=threading`.

### Run with Docker
```bash
make dev            # full dev stack, hot-reload, all services -> http://localhost:2026
make dev-down       # stop + remove (incl. profile services)
make dev-logs / make dev-logs-backend / make dev-logs-frontend
make up / make down # production stack
```
Optional compose profiles via `PROFILES=` (e.g. `make dev PROFILES=router`): `sandbox`, `provisioner`, `router`, `mongo-express`, `tools`, `minio`.

### Tests
```bash
# Backend — tests live in test/ at repo root, NOT backend/ (backend/ has no test files despite the Makefile target name)
PYTHONPATH=. uv run pytest test/ -v
PYTHONPATH=. uv run pytest test/test_foo.py -v            # single file
PYTHONPATH=. uv run pytest test/test_foo.py -k name -vv   # single test, verbose

# Frontend
npm run test          # vitest run (jsdom, tests under src/**/*.{test,spec}.{ts,tsx})
npm run test:watch
npx vitest run src/path/to/file.test.ts   # single file
```
CI (`.github/workflows/ci.yml`) runs `pytest test/ -v` and `npm run test` + `npm run build` on every push to `main`; frontend lint is non-blocking there.

### Lint / build
```bash
make lint            # ruff (backend) + eslint (frontend)
npm run build         # vite build
```

## Architecture

### Backend: ports-and-adapters (hexagonal), dependencies point inward

```
backend/
├── api/            # FastAPI app, routers, Pydantic schemas, DI (deps.py), auth, settings
├── application/    # Use-case services; ports/ holds Protocols (repositories, llm, agent_graph)
├── domain/         # Framework-free business logic + models.py (frozen dataclasses)
├── infrastructure/ # Adapters implementing application.ports (repos, LLM providers, queues, locks, sandbox)
└── log/            # Logging setup
```
- `domain` imports nothing from `application`/`api`/`infrastructure`.
- `application` depends only on `application.ports.*` Protocols, never concrete adapters.
- `api/deps.py` is the composition root wiring concrete adapters into services.
- Domain errors (`NotFoundError`, `ValidationError`) → HTTP 404/422 via handlers in `api/main.py`.

**`backend/api/settings.py` is the single source of truth for config.** Layering: code defaults < `config.yml` < `.env` < OS environment. Settings are nested by section (`settings.llm.provider`, `settings.staff.context_token_limit`, `settings.security.allow_private_http`), with flat `@property` delegates kept for older call-sites. Env var names themselves were kept for backward compatibility (e.g. `AGENT_CONTEXT_TOKEN_LIMIT` still backs `settings.staff.context_token_limit`) even where the Python identifiers were renamed. Per-tool credentials are *not* here — they live in each skill's `config` dict (DB-stored, edited via UI).

### Terminology unification (rename reached code identifiers too, not just UI text)

The user-facing vocabulary was renamed: **Agent → Staff, Team → Department, Workspace → Company, Conversation → Meeting, Marketplace → Recruiting**. Unlike an earlier pass of this file claimed, this rename was **not** display-text-only — it was carried through to file names, routes, and most Python/TypeScript identifiers. Current (verified) names: `backend/domain/staff/` (topologies live here; `backend/domain/agent/` does not exist), `backend/api/routers/staff.py`, `departments.py`, `companies.py`, `meetings.py`, `recruiting.py` (not `agents.py`/`teams.py`/`workspaces.py`/`conversations.py`/`marketplace.py`); frontend `StaffBuilder.tsx`, `DepartmentBuilder.tsx`, `Companies.tsx`, `Meetings.tsx`, `Recruiting.tsx` (not `AgentBuilder.tsx`/`TeamBuilder.tsx`/`Workspaces.tsx`/`Conversations.tsx`/`Marketplace.tsx`). Settings are under `settings.staff` (`StaffSettings`), not `settings.agent`. The domain model is `class Company` (`backend/domain/models.py`), not `Workspace`. When editing code, use these current names — only a few things still use the old vocabulary: env var strings (see above), the LangGraph "subagent" concept (`subagents.py`, `SUBAGENT_MAX_*`, distinct from the persistent Staff entity), and SSE event-type wire identifiers (e.g. `agent_start`, `subagent_complete` in `docs/STREAMING_GUIDE.md`). `docs/company-model.md` has the label mapping and explains the "All"/company scope split.

`PlatformHook` and `ThirdPartyConnection` have been merged into a single `Connection` model (`backend/domain/models.py`, `kind="inbound_webhook"` for what was `PlatformHook`, `kind="outbound"` for what was `ThirdPartyConnection`), used by both `backend/api/routers/webhook.py` and `connections.py`.

### Staff execution (LangGraph)

Five topologies in `backend/domain/staff/`, selected via `api/deps.get_staff_graph_service(mode=...)`:

| Mode | File |
|------|------|
| `sequential` | `langgraph_orchestrator.py` |
| `ring` | `langgraph_ring.py` |
| `supervisor` | `langgraph_supervisor.py` |
| `tree` | `langgraph_tree.py` |
| `mesh` | `langgraph_mesh.py` |

Each exposes `run(...)` (→ `GraphRunResult`) and `run_stream(...)` (SSE events). Shared helpers in `_graph_runtime.py`: `recursion_config`, `run_to_final_state` (returns latest partial state instead of discarding on recursion-limit/error), `safe_chat` (timeout + retry wrapper around `llm.chat`). LangGraph state must never be mutated in place — build new containers when updating collections in state.

Token budgeting (`token_budget.py`) trims context to `AGENT_CONTEXT_TOKEN_LIMIT - AGENT_OUTPUT_TOKEN_RESERVE`; it only estimates system+user text, not bound tool-schema tokens. Subagents (`subagents.py`) are bounded by `SUBAGENT_MAX_CONCURRENT`/`SUBAGENT_MAX_TURNS` and treat the sandbox as the security boundary.

Restarting a completed/stopped task (`PUT /tasks/{id}/status` → `in-progress`) preserves message history and the knowledge graph (appends a session-divider message) rather than wiping it; `DELETE /tasks/{id}/history` is the explicit owner/admin-gated full wipe.

Full topology/reliability details: `docs/agent-orchestration.md`. Streaming event types: `docs/STREAMING_GUIDE.md`.

### Storage, queue, lock backends (swap via env, no code changes)

- Storage: `STORAGE_BACKEND=json` (default, files under `STORAGE_DIR`, loaded into memory and rewritten on update) or `mongo`.
- Task queue: `TASK_QUEUE_BACKEND=memory` (ThreadPoolExecutor) or `rabbitmq`.
- Distributed lock: `LOCK_BACKEND=threading` or `redis`.
- Sandbox code execution: `SANDBOX_MODE=local` | `docker` | `k8s` (k8s via a separate provisioner service).

### Frontend structure

```
src/
├── pages/       # One file per route (Dashboard, StaffBuilder, DepartmentBuilder, TaskManager, Recruiting, ...)
├── components/  # Reusable UI (Radix UI-based), incl. AppLayout.tsx (nav)
├── contexts/    # AuthContext, LanguageContext (i18n), RunEngineContext (task streaming/run-state)
├── hooks/       # use-company-scope.ts and other custom hooks
├── lib/         # api.ts (API client), company-types.ts, staff-role-ui.ts, platforms.ts
└── locales/     # en/vi/zh/ja
```

Two navigation scopes, switched via `setActiveCompanyId()` (`src/hooks/use-company-scope.ts`), persisted in `localStorage.activeCompanyId` (`__overall__` sentinel = "All", broadcast via the `activeCompanyChanged` event):
- **"All" (Overall)** — create/monitor all companies; `useCompanyScope().isOverall === true`.
- **Inside a company** — operate one company; create tasks/projects/staff here.

`AppLayout.tsx`'s `NAV_GROUPS` declares `visibleIn: "overall" | "company" | "both"` per group; `src/App.tsx` guards routes to match (`WithCompanyLayout` vs `WithLayout`). See `docs/company-model.md` for the full nav map, company types (`software`/`marketing`/`research`/`general`), and where `company_type` is threaded end-to-end (UI → `src/lib/api.ts` → `backend/api/schemas/company.py` → `backend/domain/models.py` → repositories).

`RunEngineContext` lives above the router so in-flight task runs (streaming, state) survive navigation — `TaskManager`/`VirtualOffice` are just views over it, not owners of run state.

## Where to look for more

`docs/README.md` indexes backend docs: `architecture.md`, `configuration.md` (full env-var reference), `security.md`, `webhooks.md`, `agent-orchestration.md`, `AGENT_MEMORY.md` (working memory), `LONG_TERM_MEMORY.md` (cross-conversation memory, embeddings/RAG, vector stores), `LLM_MIDDLEWARE.md` (middleware stack: limits/retries/summary/LTM/cache/cost-guard/guardrail/PII), `MCP_GUIDE.md`, `deployment.md`, `api-reference.md`.
