# API Reference

All routes are served under `API_PREFIX` (default `/api/v1`). Paths below omit
the prefix. Request/response bodies are defined in `backend/api/schemas/`.

> Authentication: `/auth/me`, `/auth/profile`, `/auth/avatar`, `/auth/password`
> require a Bearer token (`current_user_dep`). Most other resource endpoints are
> currently open — see the limitations note in [security.md](security.md).

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness probe (used by the Docker HEALTHCHECK) |

## Auth (`/auth`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Create a local account |
| POST | `/login` | Authenticate, returns a JWT |
| GET | `/me` | Current user |
| PATCH | `/profile` | Update name/email/avatar |
| POST | `/avatar` | Upload avatar image (JPEG/PNG/GIF/WebP, ≤5 MB) |
| PATCH | `/password` | Change password |
| POST | `/logout` | Log out |
| GET | `/google/login` · `/google/callback` | Google sign-in flow |
| POST | `/oauth/start`, GET `/oauth/status`, `/oauth/callback` | Per-tool OAuth integration (e.g. Google Sheets) |

## Staff (`/staff`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `` | List staff (with resolved skills, batch-loaded) |
| POST | `` | Create or update a staff member |
| DELETE | `/{staff_id}` | Delete a staff member |

## Skills (`/skills`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `` | List skills |
| GET | `/tools` · `/tool-presets` | Available tools / presets |
| POST | `` | Create or update a skill |
| DELETE | `/{skill_id}` | Delete a skill |

## Departments (`/departments`)

| Method | Path | Description |
|--------|------|-------------|
| GET / POST | `` | List / upsert departments |
| DELETE | `/{department_id}` | Delete a department |

## Tasks (`/tasks`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `` | List tasks |
| POST | `` | Create or update a task (queues a department run when active) |
| DELETE | `/{task_id}` | Delete / cancel a task |
| DELETE | `/{task_id}/history` | Owner/admin-gated full message + graph wipe |
| GET | `/queue/status` | Task-queue snapshot |
| GET | `/{task_id}/graph-context` | Knowledge-graph context for a task |

## Projects (`/projects`), Epics (`/epics`), Sprints (`/sprints`)

Jira-like hierarchy: Project → Epic/Sprint → Task.

| Method | Path | Description |
|--------|------|-------------|
| GET / POST | `/projects` | List / upsert projects |
| DELETE | `/projects/{project_id}` | Delete a project |
| GET / POST | `/epics` | List / upsert epics |
| DELETE | `/epics/{epic_id}` | Delete an epic |
| GET / POST | `/sprints` | List / upsert sprints |
| DELETE | `/sprints/{sprint_id}` | Delete a sprint |

## Planner (`/planner`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/decompose` | AI-decompose a goal into a task plan |
| POST | `/commit` | Commit a decomposed plan as real tasks |

## Meetings (`/meetings`)

| Method | Path | Description |
|--------|------|-------------|
| GET / POST | `` | List / append messages |
| GET | `/{task_id}/files` | List files attached to a meeting |
| GET | `/{task_id}/files/download` | Download an attached file |
| POST | `/{task_id}/files` | Attach a file to a meeting |

## Recruiting (`/recruiting`)

Cross-company template gallery — read-only listings plus a copy action.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/skills` · `/staff` · `/departments` · `/tasks` · `/documents` | List shareable templates of each kind |
| POST | `/copy` | Copy a template into the current company |

## LLM (`/llm`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/models` | Available LLM models |
| POST | `/chat` | Single-model chat |
| POST | `/staff-graph/run` | Run a multi-agent staff graph |
| POST | `/staff-graph/run-stream` | Stream a staff graph (SSE) — see [STREAMING_GUIDE.md](STREAMING_GUIDE.md) |
| POST | `/staff-graph/pause` · `/resume` | Pause / resume a running graph |
| POST | `/staff-graph/interject` | Human-in-the-loop interjection into a running graph |
| POST | `/staff-graph/respond` | Respond to a pending interjection |

## Companies (`/companies`)

| Method | Path | Description |
|--------|------|-------------|
| GET / POST | `` | List / upsert companies |
| GET | `/{company_id}` | Get a company |
| DELETE | `/{company_id}` | Delete a company |
| GET | `/platforms` | Supported webhook platforms + config fields |

## Connections (`/connections`)

Unified inbound-webhook / outbound third-party connections (see [webhooks.md](webhooks.md)).

| Method | Path | Description |
|--------|------|-------------|
| GET / POST | `` | List / upsert connections |
| DELETE | `/{conn_id}` | Delete a connection |

## Document Library (`/library`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/documents` | List library documents |
| POST | `/documents` | Upload a document |
| POST | `/documents/ingest-url` | Ingest a document from a URL |
| GET | `/documents/{doc_id}/download` | Download a document |
| POST | `/documents/{doc_id}/attach` | Attach a document to a staff/department/task |
| DELETE | `/documents/{doc_id}` | Delete a document |

## Office Builder (`/office-builder`)

AI-assisted virtual-office layout planning.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/plan` · `/plan-stream` | Generate (or stream) an office layout plan |
| POST | `/apply` | Apply a generated plan |
| GET | `/sessions` · `/sessions/{session_id}` | List / get builder sessions |
| POST | `/sessions` | Save a builder session |
| DELETE | `/sessions/{session_id}` | Delete a builder session |

## Simulations (`/simulations`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/plan` | Generate a multi-agent simulation plan |

## Activity, Analytics, Consumption

| Method | Path | Description |
|--------|------|-------------|
| GET | `/activity-feed` | Recent activity items |
| GET | `/analytics` | Aggregate analytics |
| GET | `/consumption` | Token/cost usage summary |

## Admin Monitoring (`/admin/monitoring`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/usage` | Usage summary |
| GET / PUT | `/pricing` | List / upsert model pricing |
| DELETE | `/pricing` | Reset pricing to defaults |
| PUT | `/active-model` | Set the active LLM model |
| GET | `/users` | Per-user activity |
| GET | `/file-storage` | File storage backend stats |
| GET | `/health` | System health snapshot |

## Webhooks

| Method | Path | Description |
|--------|------|-------------|
| GET / POST | `/webhook/{platform}/{company_id}/{hook_id}` | Inbound webhooks — see [webhooks.md](webhooks.md) |
