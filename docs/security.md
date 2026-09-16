# Security Model

This document describes the backend's security controls and the operational
settings that govern them.

## Authentication

- Passwords are hashed with **bcrypt** (`server/api/security.py`).
- Sessions use **JWT** access tokens (`HS256` by default). Tokens are created on
  login / registration / OAuth and validated by the `current_user_dep`
  dependency, which returns 401 for missing, expired, malformed, or
  unknown-user tokens.
- **Google OAuth** sign-in links accounts by `(provider, provider_id)` first,
  then email. Profile/password updates use `dataclasses.replace`, so they no
  longer wipe `provider`/`provider_id`/`avatar` (which previously unlinked the
  OAuth account).

### Production JWT enforcement

With `ENVIRONMENT=production`, startup fails fast if `JWT_SECRET_KEY` is the
default placeholder or shorter than 32 characters. Generate a strong key:

```bash
openssl rand -hex 32
```

## CORS

`server/api/main.py` configures CORS with an explicit origin list
(`CORS_ORIGINS`) and **explicit method/header allow-lists** (no wildcards).
With `allow_credentials=True`, wildcards are both insecure and ignored by
browsers, so they are avoided.

## SSRF protection

LLM/agent tools can be told to fetch arbitrary URLs. `server/domain/tools/_ssrf.py`
guards every outbound request:

- Only `http`/`https` schemes are allowed.
- The hostname is resolved and **rejected** if any resolved address is private,
  loopback, link-local, reserved, multicast, or unspecified — blocking cloud
  metadata (`169.254.169.254`), `localhost`, internal services, and `file://`.
- `http.request` re-validates the target of **every redirect** to stop
  redirect-based SSRF.
- The `browser_navigate` / `browser_restart` tools validate before navigating.

Set `security.allow_private_http: true` to disable the guard (local development against
internal hosts only).

## Webhook verification

Inbound platform webhooks are authenticated before any work is done. See
[webhooks.md](webhooks.md) for the per-platform mechanism. The WeChat XML path
is parsed with **defusedxml** to prevent XXE / billion-laughs attacks.

## Secret hygiene

- `User.hashed_password` and `User.provider_id` are excluded from the dataclass
  `repr`, so logging a `User` or a traceback never leaks the hash.
- Outbound credentials for Meta platforms are sent in the `Authorization`
  header rather than the URL query string (which leaks into proxy/access logs).
- Knowledge-graph logging no longer emits raw user queries or full-graph dumps
  (verbatim conversation content) at INFO; only counts/IDs are logged, with the
  full dump gated behind DEBUG.

## Logging

Logs use a `RotatingFileHandler` (`LOG_MAX_BYTES` / `LOG_BACKUP_COUNT`) so the
log file cannot grow without bound. `LOG_LEVEL` is validated against a known
level allow-list.

## Ownership scoping

Every entity carries an `owner_id` (`server/domain/models.py`); routers
resolve the caller's scope via `current_owner_id_dep` and gate reads/writes
through the `is_visible_to` / `is_owned_by` / `can_modify` / `can_delete`
helpers (also in `models.py`). Non-admin users see the shared `"default"`
scope plus their own records; guest sessions get an isolated `"guest"` scope.
This is wired into nearly every resource router (staff, departments,
companies, tasks, projects, epics, sprints, meetings, recruiting, skills,
documents, office_builder, planner, activity_feed, analytics) — not just
`auth.py`.

## Known limitations / follow-ups

- **Rate limiting:** auth endpoints (`/login`, `/register`, OAuth) are not rate
  limited. Add a limiter (e.g. SlowAPI) for brute-force resistance.
- **OAuth state store:** the CSRF `state` is kept in a per-process dict; use a
  shared/signed store when running multiple workers.
