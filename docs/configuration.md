# Configuration

All settings are environment variables, loaded from `.env` (see
`backend/api/settings.py`). Names are case-insensitive; the column below uses
the canonical upper-case form.

## Application

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_NAME` | `ai-collective-backend` | FastAPI app title |
| `ENVIRONMENT` | `development` | `production` enables safety checks (see below) |
| `API_PREFIX` | `/api/v1` | Prefix for all routers |
| `CORS_ORIGINS` | localhost dev origins | Comma-separated allowed origins |
| `FRONTEND_URL` | `http://localhost:8080` | Used for OAuth redirects |
| `LOG_LEVEL` | `info` | One of CRITICAL/ERROR/WARNING/INFO/DEBUG (invalid values ignored) |

### Production safety check

When `ENVIRONMENT=production`, the app **refuses to start** unless
`JWT_SECRET_KEY` is non-default and ≥ 32 chars. Generate one with:

```bash
openssl rand -hex 32
```

## Authentication / JWT

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET_KEY` | dev placeholder | HMAC signing key — **must** be overridden in production |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` (7 days) | Access-token lifetime |

### Google sign-in

| Variable | Description |
|----------|-------------|
| `GOOGLE_LOGIN_CLIENT_ID` / `GOOGLE_LOGIN_CLIENT_SECRET` | OAuth client credentials |
| `GOOGLE_LOGIN_REDIRECT_URI` | Login callback URL |
| `GOOGLE_OAUTH_REDIRECT_URI` | Tool/workspace integration callback URL |

## LLM providers

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `google` | `google` \| `anthropic` \| `openai` \| open-weight |
| `LLM_MODEL` | — | Model id (provider default if unset) |
| `LLM_API_BASE` | — | Custom base URL |
| `GOOGLE_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | — | Provider keys |
| `OPEN_WEIGHT_API_KEY` (alias `OPENROUTER_API_KEY`) | — | Open-weight / OpenRouter key |

## Agent / tools

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_MAX_TOOL_ROUNDS` | `6` | Max LLM↔tool rounds per agent turn |
| `TOOL_TIMEOUT_SECONDS` | `0` | Per-tool timeout (0 = disabled) |
| `SUBAGENT_MAX_CONCURRENT` | `3` | Max concurrent subagents |
| `SUBAGENT_MAX_TURNS` | `6` | Subagent tool-round budget |
| `AGENT_CONTEXT_TOKEN_LIMIT` | `12000` | Context-token budget per agent prompt |
| `AGENT_OUTPUT_TOKEN_RESERVE` | `2000` | Tokens reserved for output |
| `AGENT_LLM_TIMEOUT_SECONDS` | `120` | Per `llm.chat` call timeout (`safe_chat`) |
| `AGENT_LLM_MAX_RETRIES` | `2` | Retries on transient LLM failures |

## Storage

| Variable | Default | Description |
|----------|---------|-------------|
| `STORAGE_BACKEND` | `json` | `json` \| `mongo` |
| `STORAGE_DIR` | `<root>/storage` | JSON storage directory |
| `MONGO_URI` / `MONGO_DB` | local defaults | MongoDB connection |

## Task queue / locks / sandbox

| Variable | Default | Description |
|----------|---------|-------------|
| `TASK_QUEUE_BACKEND` | `memory` | `memory` \| `rabbitmq` |
| `TASK_QUEUE_MAX_CONCURRENT` | `3` | Max concurrent tasks |
| `RABBITMQ_URL` | — | Required when backend is `rabbitmq` |
| `LOCK_BACKEND` | `threading` | `threading` \| `redis` |
| `REDIS_URL` | — | Required when lock backend is `redis` |
| `SANDBOX_MODE` | `local` | `local` \| `docker` \| `k8s` |
| `SANDBOX_PROVISIONER_URL` | — | Required when sandbox mode is `k8s` |
| `SANDBOX_TIMEOUT` | `120` | Command timeout (seconds) |

## Knowledge graph

| Variable | Default | Description |
|----------|---------|-------------|
| `GRAPH_BUILD_MODE` | `static` | `static` (spaCy/rules) \| `llm` (richer, costs tokens) |
| `GRAPH_LLM_PROVIDER` / `GRAPH_LLM_MODEL` | — | Optional dedicated extraction LLM |

## Security / networking knobs

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOW_PRIVATE_HTTP` | unset | `1` disables the SSRF guard (local dev only) |

## Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_CONSOLE` | enabled | `false` disables console logging |
| `LOG_FILE` | enabled | `false` disables file logging |
| `LOG_MAX_BYTES` | `10485760` (10 MB) | Rotating file size before rollover |
| `LOG_BACKUP_COUNT` | `5` | Number of rotated log files kept |
