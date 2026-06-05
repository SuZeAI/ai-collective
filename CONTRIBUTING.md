# Contributing to AI – Collective

Thanks for your interest in improving AI – Collective! This guide explains how
to set up the project, the conventions we follow, and how to submit changes.

> **License note.** AI – Collective is released under a **Non-Commercial /
> Academic License** (see [LICENSE](LICENSE)), not an OSI open-source license.
> By submitting a contribution you agree that your contribution is provided
> under the same license and that the copyright holder (SuZeAI) may use,
> relicense, and offer it commercially. For anything beyond non-commercial use,
> contact **suzeai545@gmail.com**.

## Project layout

- `backend/` — FastAPI service (ports-and-adapters). See
  [docs/architecture.md](docs/architecture.md).
- `src/` — React + TypeScript frontend.
- `docs/` — backend documentation (architecture, configuration, security,
  webhooks, deployment, API reference).

## Development setup

Requires **Node.js 18+**, **Python 3.11+**, and [**uv**](https://github.com/astral-sh/uv).

```bash
git clone https://github.com/SuZeAI/ai-collective.git
cd ai-collective

uv sync --all-extras      # Python deps (includes optional extras)
npm ci                    # Frontend deps

cp .env.template .env      # then set LLM_PROVIDER + an API key
```

Run locally:

```bash
make backend     # uvicorn with hot-reload on :8000
make frontend    # Vite dev server on :8080
```

See the [README](README.md) for the full local/Docker workflows.

## Conventions

- **Backend:** respect the layer boundaries — `domain` imports nothing from
  `application`/`api`/`infrastructure`; application services depend on
  `application.ports.*` Protocols, not concrete adapters. Keep functions async
  where they touch I/O; never block the event loop with sync network/file calls.
- **Frontend:** keep components modular and fully typed (TypeScript).
- **Style:** match the surrounding code; prefer small, focused functions.
- **Security:** never commit secrets. `.env` is git-ignored — use
  `.env.template` for new keys. Review [docs/security.md](docs/security.md)
  before touching auth, webhooks, or outbound HTTP.

## Commits & pull requests

- Use clear, scoped commit messages (Conventional Commits style is appreciated:
  `feat(...)`, `fix(...)`, `docs(...)`, `refactor(...)`).
- Keep PRs focused on a single concern; describe the motivation and any
  behavioral changes.
- Ensure the project still builds and, where applicable, that tests pass:

```bash
uv run pytest test/      # backend tests
npm run test             # frontend tests (vitest)
```

## Reporting bugs & requesting features

Open a GitHub issue with steps to reproduce (for bugs) or a clear use case (for
features). For **security issues**, do not open a public issue — follow
[SECURITY.md](SECURITY.md).

## Questions

Reach out via GitHub [@SuZeAI](https://github.com/SuZeAI) or
**suzeai545@gmail.com**.
