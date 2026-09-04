# MCP Configuration Guide

AI Collective can connect any **MCP (Model Context Protocol) server** to your
agents. An MCP server is configured exactly like every other skill: you create
a skill with `tool_name = mcp`, and at run time the platform connects to the
server, discovers its tools, and exposes them to the agent alongside the
built-in toolkits.

```
Agent ──▶ Skill (tool_name = "mcp") ──▶ MCPToolkit ──▶ MCP server
                                          │  discovers tools at bind time
                                          │  (name + description + JSON schema)
                                          └─ one short-lived session per call
```

## 1. Create an MCP skill (UI)

1. Open **Skills → New Skill**.
2. Pick **MCP Server (Model Context Protocol)** as the tool.
3. Give the skill a clear name (e.g. `GitHub MCP`). The name is appended to
   every discovered tool name (`search_issues_github_mcp`) so agents and logs
   can tell servers apart.
4. Fill in the config fields (below) and save.
5. Open **Agent Builder** and attach the skill to any agent.

The same can be done via API: `POST /api/v1/skills` with
`{"tool_name": "mcp", "config": {...}}`.

## 2. Config fields

| Field | Used by | Description |
|-------|---------|-------------|
| `transport` | all | `stdio` (local process), `streamable_http` (remote, recommended), or `sse` (legacy remote). |
| `command` | stdio | Executable that starts the server: `npx`, `uvx`, `python`, a binary path. **Required for stdio.** |
| `args` | stdio | Arguments, space-separated (`-y @modelcontextprotocol/server-filesystem /tmp`) or a JSON array (`["-y", "..."]`). |
| `env` | stdio | Extra environment variables for the server process. One `KEY=VALUE` per line, or a JSON object. Merged over a minimal default environment. |
| `url` | http/sse | Server endpoint, e.g. `http://localhost:8931/mcp`. **Required for streamable_http / sse.** |
| `headers` | http/sse | HTTP headers (auth tokens). One `Authorization=Bearer xxx` per line, or a JSON object. |
| `allowed_tools` | all | Optional comma-separated whitelist. Empty = expose every tool the server offers. |
| `timeout_seconds` | all | Per-tool-call timeout (default `60`, env fallback `MCP_CALL_TIMEOUT_SECONDS`). |

## 3. Examples

### Filesystem server (stdio, npx)

```
transport = stdio
command   = npx
args      = -y @modelcontextprotocol/server-filesystem /home/me/workspace
```

### GitHub server (stdio with a token)

```
transport = stdio
command   = npx
args      = -y @modelcontextprotocol/server-github
env       = GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxx
allowed_tools = search_repositories, get_file_contents, create_issue
```

### Remote server (streamable HTTP with auth)

```
transport = streamable_http
url       = https://mcp.example.com/mcp
headers   = Authorization=Bearer eyJhbGci...
```

### Python server (uvx)

```
transport = stdio
command   = uvx
args      = mcp-server-fetch
```

## 4. Behavior and limits

- **Discovery at bind time.** When an agent run starts, the toolkit performs
  the MCP handshake and `list_tools` once (timeout
  `MCP_DISCOVERY_TIMEOUT_SECONDS`, default 30s). If the server is unreachable
  or exposes no tools, the run fails fast with a clear error — fix the skill
  config and rerun.
- **One session per call.** Each tool call opens a fresh session. For
  `stdio` this spawns the server process per call — fine for occasional
  calls; prefer `streamable_http` for chatty servers.
- **Tool name sanitization.** Remote names are lowercased, special characters
  become `_`, and the skill name is appended as a suffix.
- **Errors never kill a run.** Timeouts and server errors come back to the
  LLM as `[mcp error] ...` / `[mcp timeout] ...` tool results so the agent can
  adapt.

## 5. Environment variables

```bash
# .env
MCP_DISCOVERY_TIMEOUT_SECONDS=30   # list_tools handshake ceiling at bind time
MCP_CALL_TIMEOUT_SECONDS=60        # default per-call timeout (per-skill override wins)
```

## 6. Security notes

- Treat `env` / `headers` values as secrets — they are stored in the skill
  config (scoped to the skill owner, like all skill credentials).
- A `stdio` MCP server runs as a child process of the backend with the
  backend's OS permissions. Only configure servers you trust, and prefer
  narrowly-scoped servers (e.g. filesystem server pointed at one directory).
- Use `allowed_tools` to limit what agents can reach on powerful servers.

## 7. Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| `Could not connect to MCP server (stdio:...)` | `command` not installed / not on PATH for the backend process. |
| `... exposed no usable tools after whitelist filter` | `allowed_tools` names don't match the server's tool names (check exact spelling). |
| `[mcp timeout]` on every call | Server too slow for `timeout_seconds`; raise it, or move from stdio to streamable_http. |
| Discovery hangs then fails at ~30s | Server starts but never completes the MCP handshake — run it manually and check stderr. |
