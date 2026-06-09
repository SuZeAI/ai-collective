# 9Router Setup

[9Router](https://github.com/decolua/9router) is an open-source, **OpenAI-compatible**
LLM proxy. It routes a single request across 40+ providers (Claude, OpenAI, Gemini,
GLM, MiniMax…) with smart 3-tier fallback (subscription → cheap → free), compresses
tool outputs to save 20–40% tokens, tracks quota, and round-robins between multiple
accounts per provider.

Because it speaks the OpenAI Chat Completions API, AI Collective talks to it through
its existing **`openai`** provider — no backend code changes. You point
`LLM_API_BASE` at 9Router and use a 9Router-issued key as `OPENAI_API_KEY`.

```
AI Collective backend ──(OpenAI API)──► 9Router :20128 ──► Claude / OpenAI / Gemini / …
```

> **9Router vs. built-in key rotation.** 9Router is one of two failover strategies,
> selected by `LLM_FAILOVER_STRATEGY`. The other — `rotate` — cycles multiple keys
> of a *single* provider with no extra service. See
> [LLM_KEY_ROTATION.md](LLM_KEY_ROTATION.md) to compare. To use 9Router, set
> `LLM_FAILOVER_STRATEGY=9router` (this turns the built-in rotation off).
>
> Note: 9Router (`decolua/9router`) is **not** openrouter.ai — the latter is the
> separate `open_weight` provider configured via `OPENROUTER_API_KEY`.

---

## 1. Start the 9Router service

A `nine-router` service is bundled in both compose files under the **`router`**
profile (it stays off unless you enable it):

```bash
# Production compose
docker compose -f docker/docker-compose.yaml --profile router up -d nine-router

# Dev compose
docker compose -f docker/docker-compose-dev.yaml --profile router up -d nine-router
```

To bring the whole stack up *with* 9Router, add `--profile router` to your normal
`up` command (combine with other profiles as needed):

```bash
docker compose -f docker/docker-compose.yaml --profile router up -d
```

### Via the Makefile (recommended)

The `Makefile` exposes a `PROFILES` variable so you can flexibly enable any
combination of profiles on top of `make dev` / `make up`:

```bash
make dev PROFILES=router              # dev stack + 9Router
make dev PROFILES="sandbox router"    # dev stack + sandbox + 9Router
make up  PROFILES=router              # production stack + 9Router

# Shortcuts (equivalent to the above):
make dev-router                       # = make dev PROFILES=router
make prod-router                      # = make up  PROFILES=router
```

Available profiles: `sandbox` · `provisioner` · `router` · `mongo-express` · `tools`.

The service:

| Setting | Value | Override via `.env` |
|---------|-------|---------------------|
| Image | `decolua/9router:latest` | — |
| Port | `20128` (host → container) | `ROUTER_PORT` |
| Data volume | `router_data` → `/app/data` (SQLite DB) | — |
| Public URL | `http://localhost:20128` | `ROUTER_PUBLIC_URL` |
| JWT secret | dev placeholder | `ROUTER_JWT_SECRET` (set in production!) |
| Dashboard login password | `123456` | `ROUTER_INITIAL_PASSWORD` (change it!) |
| In-Docker hostname | `nine-router` | — |

The service binds `0.0.0.0:20128` inside the container and is published to the
host as `localhost:${ROUTER_PORT}`, so the dashboard and API are reachable at
**http://localhost:20128** straight away. A `healthcheck` reports readiness once
the gateway responds.

Before exposing it beyond localhost, change both secrets:

```bash
openssl rand -hex 32          # → ROUTER_JWT_SECRET in .env
# and set a strong ROUTER_INITIAL_PASSWORD (replaces the default 123456)
```

---

## 2. Configure providers in the dashboard

1. Open the dashboard: **http://localhost:20128/dashboard**
2. **Log in** with the first-login password — `ROUTER_INITIAL_PASSWORD` (default
   `123456`). Change it after the first login.
3. Add one or more **provider accounts** (e.g. your Claude subscription, an OpenAI
   key, a free GLM tier). Each provider exposes models as `provider/model-name`,
   e.g. `cc/claude-opus-4-7`, `glm/glm-5.1`, `kr/claude-sonnet-4.5`.
4. *(Optional)* Create a **combo** — a named fallback chain — so a single model id
   tries several providers in order:
   ```
   Combo: premium-coding
     1. cc/claude-opus-4-7   (subscription)
     2. glm/glm-5.1          (cheap backup)
     3. kr/claude-sonnet-4.5 (free fallback)
   ```
4. Generate an **API key** (`sk-…`). This is what AI Collective sends as its bearer
   token — it is *not* one of your upstream provider keys.

---

## 3. Point AI Collective at 9Router (`.env`)

Edit `.env` at the project root (copy from `.env.template` if you haven't):

```dotenv
# Delegate failover to 9Router (turns off the built-in multi-key rotation)
LLM_FAILOVER_STRATEGY=9router

# Route the backend through 9Router using the OpenAI-compatible provider
LLM_PROVIDER=openai
LLM_API_BASE=http://nine-router:20128/v1
OPENAI_API_KEY=sk-...            # the key you generated in the 9router dashboard
LLM_MODEL=premium-coding         # a combo name, or a provider/model like cc/claude-opus-4-7

# 9Router container settings (profile: router)
ROUTER_PORT=20128
ROUTER_PUBLIC_URL=http://localhost:20128
ROUTER_JWT_SECRET=<openssl rand -hex 32>
ROUTER_INITIAL_PASSWORD=<strong-password>   # dashboard login (default 123456)
```

> **Which base URL?**
> - Backend running **inside Docker compose** → `http://nine-router:20128/v1`
>   (Docker DNS resolves the service name on the `ai-collective` network).
> - Backend running **on the host** (e.g. `uv run uvicorn …`) →
>   `http://localhost:20128/v1`.

Restart the backend so it reloads `.env`:

```bash
docker compose -f docker/docker-compose.yaml up -d --force-recreate backend
```

---

## 4. Verify

```bash
# 9Router is up and lists your models / combos
curl http://localhost:20128/v1/models \
  -H "Authorization: Bearer sk-..."

# A direct chat completion through the router
curl http://localhost:20128/v1/chat/completions \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{"model":"premium-coding","messages":[{"role":"user","content":"ping"}]}'

# AI Collective backend is healthy
curl http://localhost:8000/api/v1/health
```

Then send a normal agent/chat request in the app — it now flows through 9Router and
its fallback chain.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| Backend logs `provider returned None` / no LLM | `OPENAI_API_KEY` empty, or `LLM_PROVIDER` not `openai`. |
| `Connection refused` to `nine-router:20128` | Service not started — add `--profile router` to your `up` command. |
| Works from host but not from backend container | Use `http://nine-router:20128/v1` (service hostname), not `localhost`, inside Docker. |
| `401` from 9Router | Bearer key doesn't match a key created in the dashboard. |
| Can't log into the dashboard | Use `ROUTER_INITIAL_PASSWORD` (default `123456`). If changed after data was persisted, the stored password in the `router_data` volume wins — reset by recreating the volume. |
| Model not found | `LLM_MODEL` must be a dashboard combo name or a valid `provider/model` id. |
| Dashboard data lost after recreate | Ensure the `router_data` volume is intact; it holds `db/data.sqlite`. |

## References

- 9Router repo: https://github.com/decolua/9router
- Provider/base-URL reference: [configuration.md](configuration.md#llm-providers)
- General Docker deployment: [deployment.md](deployment.md)
