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
| POST | `/oauth/start`, GET `/oauth/status`, `/oauth/callback` | Tool/workspace OAuth integration |

## Agents (`/agents`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `` | List agents (with resolved skills, batch-loaded) |
| POST | `` | Create or update an agent |
| DELETE | `/{agent_id}` | Delete an agent |

## Skills (`/skills`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `` | List skills |
| GET | `/tools` · `/tool-presets` | Available tools / presets |
| POST | `` | Create or update a skill |
| DELETE | `/{skill_id}` | Delete a skill |

## Teams (`/teams`)

| Method | Path | Description |
|--------|------|-------------|
| GET / POST | `` | List / upsert teams |
| DELETE | `/{team_id}` | Delete a team |

## Tasks (`/tasks`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `` | List tasks |
| POST | `` | Create or update a task (queues team run when active) |
| DELETE | `/{task_id}` | Delete / cancel a task |
| GET | `/queue/status` | Task-queue snapshot |
| GET | `/{task_id}/graph-context` | Knowledge-graph context for a task |

## Conversations (`/conversations`)

| Method | Path | Description |
|--------|------|-------------|
| GET / POST | `` | List / append messages |

## LLM (`/llm`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat` | Single-model chat |
| POST | `/agent-graph/run` | Run a multi-agent graph |
| POST | `/agent-graph/run-stream` | Stream a multi-agent graph (SSE) — see [STREAMING_GUIDE.md](STREAMING_GUIDE.md) |

## Workspaces (`/workspaces`)

| Method | Path | Description |
|--------|------|-------------|
| GET / POST | `` | List / upsert workspaces |
| GET | `/{workspace_id}` | Get a workspace |
| DELETE | `/{workspace_id}` | Delete a workspace |
| GET | `/platforms` | Supported webhook platforms + config fields |

## Connections (`/connections`)

| Method | Path | Description |
|--------|------|-------------|
| GET / POST | `` | List / upsert third-party connections |
| DELETE | `/{conn_id}` | Delete a connection |

## Other

| Method | Path | Description |
|--------|------|-------------|
| GET | `/activity-feed` | Recent activity items |
| GET | `/analytics` | Aggregate analytics |
| POST | `/simulations/plan` | Generate a multi-agent simulation plan |
| GET/POST | `/webhook/{platform}/{workspace_id}/{hook_id}` | Inbound webhooks — see [webhooks.md](webhooks.md) |
