# AI Collective — Backend Documentation

AI Collective is a multi-agent platform with a React frontend (`/src`) and a
FastAPI backend (`/backend`). This directory documents the **backend**: its
architecture, configuration, security model, and deployment.

## Contents

| Document | What it covers |
|----------|----------------|
| [architecture.md](architecture.md) | Layered (ports-and-adapters) design, package layout, request lifecycle |
| [configuration.md](configuration.md) | Full environment-variable reference |
| [security.md](security.md) | Auth, JWT, CORS, SSRF guard, webhook signatures, logging hygiene |
| [webhooks.md](webhooks.md) | Inbound messaging webhooks and per-platform verification |
| [agent-orchestration.md](agent-orchestration.md) | LangGraph topologies and reliability controls |
| [AGENT_MEMORY.md](AGENT_MEMORY.md) | Shared working memory — anti-context-loss layer for multi-agent runs |
| [MCP_GUIDE.md](MCP_GUIDE.md) | Connecting MCP servers to agents as skills |
| [deployment.md](deployment.md) | Docker image, task-queue/lock/sandbox backends, graceful shutdown |
| [api-reference.md](api-reference.md) | REST surface grouped by router |
| [hardening-changelog.md](hardening-changelog.md) | The security/reliability hardening pass (branch `fix/backend-hardening`) |

## Quick start

```bash
# Install dependencies (uv)
uv sync

# Run the API (development)
uv run uvicorn backend.api.main:app --host 0.0.0.0 --port 8000 --reload

# Health check
curl http://localhost:8000/api/v1/health
```

The API is served under the prefix `/api/v1` by default (`API_PREFIX`).

## Related docs

- [LLM_KEY_ROTATION.md](LLM_KEY_ROTATION.md) — multi-key rotation & failover (RPM/TPM budgets); `rotate` vs `9router`
- [9ROUTER_SETUP.md](9ROUTER_SETUP.md) — 9Router multi-provider LLM proxy setup
- [GOOGLE_LOGIN_SETUP.md](GOOGLE_LOGIN_SETUP.md) — Google OAuth sign-in setup
- [STREAMING_GUIDE.md](STREAMING_GUIDE.md) — server-sent event streaming
- [K3S.md](K3S.md) — Kubernetes / k3s sandbox provisioner
