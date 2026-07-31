# Hardening Changelog

A security/reliability/quality pass on the backend, delivered on branch
`fix/backend-hardening` as nine focused commits. This summarizes what changed
and why.

## Security

- **Webhook signature verification enforced.** `verify_request` is now called by
  the router (403 on failure); implemented for Slack (HMAC v0), LINE (HMAC),
  Meta/WhatsApp/Messenger/Instagram (`X-Hub-Signature-256`), and Discord
  (Ed25519). Constant-time comparison throughout. New optional config fields
  `app_secret` (Meta) and `public_key` (Discord). _Commit: webhook security._
- **XXE fixed.** WeChat XML is parsed with `defusedxml`. _Commit: webhook security._
- **SSRF guard** for LLM-driven HTTP and browser tools: scheme + resolved-IP
  checks, redirect re-validation, `ALLOW_PRIVATE_HTTP` escape hatch.
  _Commit: SSRF guard._
- **JWT production gate** — refuses to boot in production with a default/weak
  secret. **CORS** uses explicit method/header allow-lists. _Commit: infra hardening._
- **Secret hygiene** — Meta tokens moved to `Authorization` header; `User`
  secrets excluded from `repr`; raw queries/full graph removed from INFO logs.

## Reliability

- **Agent orchestration** — shared `_graph_runtime` adds a derived
  `recursion_limit`, partial-result recovery (`run_to_final_state`), and a
  timeout+retry `safe_chat` wrapper around every `llm.chat`. Mesh state
  deep-copy bug fixed. _Commit: agent reliability._
- **Task queue** — RabbitMQ acks after task completion (thread-safe), graceful
  shutdown, interruptible reconnect; queue drained on app shutdown.
  _Commit: infra hardening._
- **Bounded memory** — `aio_sandbox` output map is LRU-capped; task-run registry
  warns past a soft cap. _Commit: infra hardening._
- **`RobustJsonParser.invoke()`** no longer crashes inside a running event loop.
  _Commit: observability._

## Correctness

- **OAuth field loss fixed** — `UserService` uses `dataclasses.replace`, so
  profile/password updates keep `avatar`/`provider`/`provider_id`.
  _Commit: architecture._
- **LINE routing** prefers push-by-userId (reply tokens expire during async
  processing). _Commit: webhook security._
- **Timezone-aware datetimes** in meetings/departments routers (named conversations/teams at the time).
- **Consistent 404s** — connection/company services raise `NotFoundError` (named workspace at the time).

## Performance

- **N+1 removed** in `list_staff` (`list_agents` at the time; batch skill load); **skill-tool cache** keyed
  by skill id + kwargs digest. _Commit: performance._

## Observability

- Rotating file logs (`LOG_MAX_BYTES`/`LOG_BACKUP_COUNT`), validated `LOG_LEVEL`,
  and logging instead of silent `except: pass` in several services.

## Maintainability

- Shared `_messaging_http.request_json` removed duplicated transport across 8
  messaging toolkits. Dead code removed (`_build_agent_defs`, `_expand_nodes`,
  placeholder auth stubs). Application services depend on repository **Protocols**
  rather than concrete JSON adapters.

## Docker

- Multi-stage build (build cache kept out of the final image), `HEALTHCHECK`,
  and a new `.dockerignore`. `uv` is retained in the runtime image and the
  container runs as root, because both compose files drive the backend via
  `uv run` (dev also runs `uv sync` at startup). Non-root execution is a
  follow-up that requires compose changes. _Commit: docker hardening (+ fix)._

## New dependency

- `defusedxml` — run `uv sync` after pulling.

## Verification status

All changed modules pass `python -m compileall`. The SSRF guard and `User`
model were unit-checked directly. The full test suite and a runtime smoke test
should be run in an environment with dependencies installed (`uv sync`).
