# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AI – Collective: a platform for creating and managing AI-powered companies — virtual organizations of any type (software, marketing, research, or general) built from Departments staffed by AI, each run as a LangGraph-based multi-agent topology. React 18 + TypeScript frontend (`/ui`) talking to a FastAPI backend (`/server`). Source-available, non-commercial license (see `LICENSE`/`NOTICE`).

**Note:** `README.md` describes an earlier state of the project (pre terminology-rename: mentions `server/domain/agent/`, `AgentBuilder.tsx`/`TeamBuilder.tsx`/`Workspaces.tsx`, only 4 topologies). Trust this file and the codebase over `README.md` for current names and structure.

## Commands

### Setup
```bash
make install          # uv sync --all-extras + npm --prefix ui ci
cp .env.template .env # then fill in at least one provider key (e.g. GOOGLE_API_KEY) referenced by config.yml's models: list
```

### Run locally (no Docker)
```bash
make backend                        # uvicorn --reload on :8000 (needs `make infra` for redis/rabbitmq if used)
make frontend                       # vite dev server on :8080
make infra / make infra-down        # redis + rabbitmq only, for local backend dev
```
Code defaults need no infra: `storage.backend=json`, `task_queue.backend=memory`, `lock.backend=threading` — but the committed `config.yml` may already point at `mongo`/`rabbitmq`/`redis`; check it before assuming which mode is active.

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
# Backend — tests live in test/ at repo root, NOT server/ (server/ has no test files despite the Makefile target name)
# test/api/ — endpoint tests via the shared `client` TestClient fixture; test/unit/ — everything else;
# test/manual/ — ad-hoc debug scripts, not collected by pytest.
PYTHONPATH=. uv run pytest test/ -v
PYTHONPATH=. uv run pytest test/unit/test_foo.py -v            # single file
PYTHONPATH=. uv run pytest test/api/test_foo.py -k name -vv    # single test, verbose

# Frontend (from ui/, or npm --prefix ui ...)
cd ui && npm run test          # vitest run (jsdom, tests under src/**/*.{test,spec}.{ts,tsx})
cd ui && npm run test:watch
cd ui && npx vitest run src/path/to/file.test.ts   # single file
```
`test/conftest.py` provides a session-scoped `client` (FastAPI `TestClient`) plus `admin_headers`/`user_headers` fixtures and a `unique()` helper for collision-free test names; it wipes the test storage dir once per session. CI (`.github/workflows/ci.yml`) runs `pytest test/ -v` and (in `ui/`) `npm run test` + `npm run build` on every push to `main`; frontend lint is non-blocking there.

### Lint / build
```bash
make lint            # ruff (backend) + eslint (frontend)
cd ui && npm run build         # vite build
```

## Architecture

### Backend: ports-and-adapters (hexagonal), dependencies point inward

```
server/
├── api/            # FastAPI app, routers, Pydantic schemas, DI (deps.py), auth, settings
├── app/            # Use-case services; ports/ holds Protocols (repositories, llm, agent_graph)
├── domain/         # Framework-free business logic + models.py (frozen dataclasses)
├── infra/          # Adapters implementing app.ports (repos, LLM providers, queues, locks, sandbox)
└── log/            # Logging setup
```
- `domain` imports nothing from `app`/`api`/`infra`.
- `app` depends only on `app.ports.*` Protocols, never concrete adapters.
- `api/deps.py` is the composition root: it wires concrete adapters into services (`get_staff_service`, `get_task_service`, `get_project_service`, `get_epic_service`, `get_sprint_service`, `get_recruiting_service`, `get_meeting_service`, `get_company_service`, `get_connection_service`, `get_document_library_service`, `get_office_builder_session_service`, `get_simulation_service`, `get_staff_graph_service(mode=...)`, etc.) and also seeds admin user / default data on boot.
- Domain errors (`NotFoundError`, `ValidationError`) → HTTP 404/422 via handlers in `api/main.py`.
- Domain models (`server/domain/models.py`) include `Skill`, `Staff`, `Department`, `Task`, `Project`, `Epic`, `Sprint`, `Message`, `Analytics`, `ActivityFeedItem`, `Company`, `LibraryDocument`, `OfficeBuilderSession`, `Connection`, `ToolResult`, `SimulationStep`, `TokenUsageRecord`, `ModelPricing`, `User`.

**`server/api/settings.py` is the single source of truth for config, and `config.yml` (now at `.config/config.yml`, override with `CONFIG_FILE=/path`) is the single, complete source for every setting — including secrets.** No part of the backend reads a bare OS/`.env` variable to configure itself; the *only* way an env var reaches a setting is an explicit `${VAR}` (or `${VAR:-default}`) reference written inline in `config.yml` (e.g. `auth.jwt_secret_key: ${JWT_SECRET_KEY}`), expanded from `.env`/OS environment by `config_loader.load_config()`. Precedence is simply `code defaults < config.yml (${VAR} resolved from .env/OS env)`. Settings are nested by section matching `config.yml`'s top-level keys (`app`, `logging`, `models`, `middleware`, `router`, `staff`, `storage`, `mongo`, `graph`, `task_queue`, `lock`, `sandbox`, `minio`, `auth`, `working_memory`, `embedding`, `long_term_memory`, `retrieval`, `vector_store`, `mcp`, `admin`, `seed`, `browser`, `tools`, `security`) — e.g. `settings.staff.context_token_limit`, `settings.security.allow_private_http` — with flat `@property` delegates kept on the root `Settings` for older call-sites. `docs/configuration.md` still cross-references the historical `UPPER_CASE` env-var-style names some scripts/docs use, but those names don't configure anything by themselves anymore — only the `config.yml` key path shown does. Per-tool credentials are *not* here — they live in each skill's `config` dict (DB-stored, edited via UI). `models:` is a list of provider entries (`ModelConfig`, each with an `api_key: $GOOGLE_API_KEY`-style secret ref and an `enabled` flag plus its own `failover:` block) — not a single flat provider/model pair.

MCP servers are created as skills (`tool_name = "mcp"`) via the UI/API — no file-based auto-seeding. See `docs/mcp-guide.md`.

### Terminology unification (rename reached code identifiers too, not just UI text)

The user-facing vocabulary was renamed: **Agent → Staff, Team → Department, Workspace → Company, Conversation → Meeting, Marketplace → Recruiting**. This rename was **not** display-text-only — it was carried through to file names, routes, and most Python/TypeScript identifiers. Current (verified) names: `server/domain/staff/` (topologies live here; `server/domain/agent/` does not exist), `server/api/routers/staff.py`, `departments.py`, `companies.py`, `meetings.py`, `recruiting.py` (not `agents.py`/`teams.py`/`workspaces.py`/`conversations.py`/`marketplace.py`); frontend `StaffBuilder.tsx`, `DepartmentBuilder.tsx`, `Companies.tsx`, `Meetings.tsx`, `Recruiting.tsx` (not `AgentBuilder.tsx`/`TeamBuilder.tsx`/`Workspaces.tsx`/`Conversations.tsx`/`Marketplace.tsx`). Settings are under `settings.staff` (`StaffSettings`), not `settings.agent`. The domain model is `class Company` (`server/domain/models.py`), not `Workspace`. When editing code, use these current names — only a few things still use the old vocabulary: env var strings (see above), the LangGraph "subagent" concept (`subagents.py`, `SUBAGENT_MAX_*`, distinct from the persistent Staff entity), and SSE event-type wire identifiers (e.g. `agent_start`, `subagent_complete` in `docs/streaming-guide.md`). `docs/company-model.md` has the label mapping and explains the "All"/company scope split.

`PlatformHook` and `ThirdPartyConnection` have been merged into a single `Connection` model (`server/domain/models.py`, `kind="inbound_webhook"` for what was `PlatformHook`, `kind="outbound"` for what was `ThirdPartyConnection`), used by both `server/api/routers/webhook.py` and `connections.py`.

Other routers beyond the renamed core: `tasks.py`, `projects.py`, `epics.py`, `sprints.py` (Jira-like hierarchy — Project → Epic/Sprint → Task), `planner.py` (AI planning assistance), `office_builder.py` / `simulations.py` (virtual-office visualization), `activity_feed.py`, `analytics.py`, `consumption.py` (token/cost usage), `admin_monitoring.py`, `documents.py` (Document Library), `skills.py`, `connections.py`, `webhook.py`, `auth.py`, `llm.py`, `health.py`.

### Staff execution (LangGraph)

Six topologies in `server/domain/staff/`, selected via `api/deps.get_staff_graph_service(mode=...)`:

| Mode | File |
|------|------|
| `sequential` | `langgraph_orchestrator.py` |
| `ring` | `langgraph_ring.py` |
| `supervisor` | `langgraph_supervisor.py` |
| `tree` | `langgraph_tree.py` |
| `mesh` | `langgraph_mesh.py` |
| `custom` | `langgraph_custom.py` — user-defined DAG via `CustomGraphSpec` |

Each exposes `run(...)` (→ `GraphRunResult`) and `run_stream(...)` (SSE events). Shared helpers in `_graph_runtime.py`: `recursion_config`, `run_to_final_state` (returns latest partial state instead of discarding on recursion-limit/error), `safe_chat` (timeout + retry wrapper around `llm.chat`). LangGraph state must never be mutated in place — build new containers when updating collections in state.

Token budgeting (`token_budget.py`) trims context to `staff.context_token_limit - staff.output_token_reserve`; it only estimates system+user text, not bound tool-schema tokens. Subagents (`subagents.py`) are bounded by `staff.subagent_max_concurrent`/`staff.subagent_max_turns` and treat the sandbox as the security boundary.

Restarting a completed/stopped task (`PUT /tasks/{id}/status` → `in-progress`) preserves message history and the knowledge graph (appends a session-divider message) rather than wiping it; `DELETE /tasks/{id}/history` is the explicit owner/admin-gated full wipe.

Full topology/reliability details: `docs/agent-orchestration.md`. Streaming event types: `docs/streaming-guide.md`.

### Storage, queue, lock backends (swap via `config.yml`, no code changes)

- Storage: `storage.backend=json` (code default, files under `storage.dir`, loaded into memory and rewritten on update) or `mongo`.
- Task queue: `task_queue.backend=memory` (ThreadPoolExecutor, code default) or `rabbitmq`.
- Distributed lock: `lock.backend=threading` (code default) or `redis`.
- Sandbox code execution: `sandbox.mode=local` (code default) or `k8s` (via a separate provisioner service) — there is **no** `docker` mode despite that being a common assumption; `docs/sandbox.md` calls this out explicitly.

### Frontend structure

```
ui/src/
├── pages/           # One file per route (Dashboard, StaffBuilder, DepartmentBuilder, TaskManager, Recruiting, ...)
│   └── marketing/   # Public marketing site (Pricing, Solutions, Resources, Changelog, ContactSales, SupportCenter, MeetCollective)
├── components/      # Reusable UI (Radix UI-based), incl. AppLayout.tsx (nav)
├── contexts/        # AuthContext, LanguageContext (i18n), RunEngineContext (task streaming/run-state)
├── hooks/           # use-company-scope.ts and other custom hooks
├── lib/             # api.ts (API client), company-types.ts, staff-role-ui.ts, platforms.ts
└── locales/         # en/vi/zh/ja
```

Two navigation scopes, switched via `setActiveCompanyId()` (`ui/src/hooks/use-company-scope.ts`), persisted in `localStorage.activeCompanyId` (`__overall__` sentinel = "All", broadcast via the `activeCompanyChanged` event):
- **"All" (Overall)** — create/monitor all companies; `useCompanyScope().isOverall === true`.
- **Inside a company** — operate one company; create tasks/projects/staff here.

`AppLayout.tsx`'s `NAV_GROUPS` declares `visibleIn: "overall" | "company" | "both"` per group; `ui/src/App.tsx` guards routes to match (`WithCompanyLayout` vs `WithLayout`, plus `RequireCompany`/`RequireCompanyOrAdmin`/`RequireAdmin` gates). See `docs/company-model.md` for the full nav map, company types (`software`/`marketing`/`research`/`general`), and where `company_type` is threaded end-to-end (UI → `ui/src/lib/api.ts` → `server/api/schemas/company.py` → `server/domain/models.py` → repositories).

`RunEngineContext` lives above the router so in-flight task runs (streaming, state) survive navigation — `TaskManager`/`VirtualOffice` are just views over it, not owners of run state.

## Where to look for more

`docs/README.md` indexes backend docs: `architecture.md`, `configuration.md` (full `config.yml` reference), `security.md`, `webhooks.md`, `agent-orchestration.md`, `agent-memory.md` (working memory), `long-term-memory.md` (cross-conversation memory, embeddings/RAG, vector stores), `llm-middleware.md` (middleware stack: limits/retries/summary/LTM/cache/cost-guard/guardrail/PII), `mcp-guide.md`, `deployment.md`, `api-reference.md`, `company-model.md`, `dashboard-navigation.md`, `sandbox.md`, `llm-key-rotation.md` (multi-key rotation/failover, now per-`models:`-entry `failover:` blocks, not flat env vars), `9router-setup.md`, `google-login-setup.md`, `k3s.md`.
