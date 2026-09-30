# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report privately to:

- **Email:** suzeai545@gmail.com
- **GitHub:** [@SuZeAI](https://github.com/SuZeAI)

Include, where possible:

- A description of the issue and its impact.
- Steps to reproduce (proof of concept, affected endpoint/component).
- The commit or version affected.
- Any suggested remediation.

We will acknowledge your report, investigate, and keep you informed of progress
toward a fix. Please allow reasonable time to address the issue before any
public disclosure.

## Scope

This project handles authentication (JWT, OAuth), inbound platform webhooks,
LLM-driven outbound HTTP, and sandboxed code execution. Areas of particular
interest include: authentication/authorization, webhook signature
verification, SSRF, secret handling, and sandbox escape. See
[docs/security.md](docs/security.md) for the implemented controls and known
limitations.

## Hardening guidance for operators

`.config/config.yml` is the single source of truth for these settings — env vars only
take effect where the shipped config explicitly references them via `${VAR}` (see
[docs/configuration.md](docs/configuration.md)).

- Set a strong `auth.jwt_secret_key` (`openssl rand -hex 32`, via `${JWT_SECRET_KEY}`
  in `.env`) and `app.environment: production` (boot is blocked otherwise).
- Set explicit `app.cors_origins`.
- Configure webhook secrets so signature verification is enforced
  (`signing_secret`, `channel_secret`, `app_secret`, `public_key`).
- Do **not** set `security.allow_private_http: true` in production (it disables the
  SSRF guard).
- Keep dependencies up to date (`uv sync`).

See [docs/deployment.md](docs/deployment.md) for the full production checklist.
