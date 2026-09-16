# AI Collective — Backend Documentation

AI Collective is a platform for creating and managing AI-powered companies — virtual
organizations of any type (software, marketing, research, or general), built from
Departments and Staff and run as multi-agent LangGraph topologies. It has a React
frontend (`/ui`) and a FastAPI backend (`/server`). This directory documents the
**backend**: its architecture, configuration, security model, and deployment.

## Contents

| Document | What it covers |
|----------|----------------|
| [architecture.md](architecture.md) | Layered (ports-and-adapters) design, package layout, request lifecycle |
| [configuration.md](configuration.md) | Full environment-variable reference |
| [security.md](security.md) | Auth, JWT, CORS, SSRF guard, webhook signatures, logging hygiene |
| [webhooks.md](webhooks.md) | Inbound messaging webhooks and per-platform verification |
| [agent-orchestration.md](agent-orchestration.md) | LangGraph topologies, reliability controls, conversation persistence on restart |
| [agent-memory.md](agent-memory.md) | Shared working memory — anti-context-loss layer for multi-agent runs |
| [long-term-memory.md](long-term-memory.md) | Cross-conversation long-term memory, embeddings/RAG, FAISS/Qdrant vector stores, Neo4j graph backend |
| [llm-middleware.md](llm-middleware.md) | The agent middleware stack (limits, retries, summary, LTM, cache, cost guard, guardrail, PII) |
| [mcp-guide.md](mcp-guide.md) | Connecting MCP servers to agents as skills |
| [deployment.md](deployment.md) | Docker image, task-queue/lock/sandbox backends, graceful shutdown |
| [sandbox.md](sandbox.md) | Sandbox execution modes (`local`, `k8s`) for agent-issued shell/file commands |
| [api-reference.md](api-reference.md) | REST surface grouped by router |
| [company-model.md](company-model.md) | The "All"/company scope split, company types, and nav visibility rules |
| [dashboard-navigation.md](dashboard-navigation.md) | Frontend dual-sidebar nav layout and what each nav group/item does |
| [hardening-changelog.md](hardening-changelog.md) | The security/reliability hardening pass (branch `fix/backend-hardening`) |
| [tool.md](tool.md) | Checklist of completed skill/tool integrations |

## Quick start

```bash
# Install dependencies (uv)
uv sync

# Run the API (development)
uv run uvicorn server.api.main:app --host 0.0.0.0 --port 8000 --reload

# Health check
curl http://localhost:8000/api/v1/health
```

The API is served under the prefix `/api/v1` by default (`API_PREFIX`).

## Related docs

- [llm-key-rotation.md](llm-key-rotation.md) — multi-key rotation & failover (RPM/TPM budgets); `rotate` vs `9router`
- [9router-setup.md](9router-setup.md) — 9Router multi-provider LLM proxy setup
- [google-login-setup.md](google-login-setup.md) — Google OAuth sign-in setup
- [streaming-guide.md](streaming-guide.md) — server-sent event streaming
- [k3s.md](k3s.md) — Kubernetes / k3s sandbox provisioner
