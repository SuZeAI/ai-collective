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

- Set a strong `JWT_SECRET_KEY` and `ENVIRONMENT=production` (boot is blocked
  otherwise).
- Configure explicit `CORS_ORIGINS`.
- Configure webhook secrets so signature verification is enforced
  (`signing_secret`, `channel_secret`, `app_secret`, `public_key`).
- Do **not** set `ALLOW_PRIVATE_HTTP` in production (it disables the SSRF guard).
- Keep dependencies up to date (`uv sync`).

See [docs/deployment.md](docs/deployment.md) for the full production checklist.
