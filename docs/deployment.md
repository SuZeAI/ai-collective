# Deployment

## Docker image

`backend/Dockerfile` is a multi-stage build:

- **Builder stage** resolves dependencies with `uv` into `/app/.venv` (the
  build cache and intermediate layers stay here and are not shipped).
- **Runtime stage** copies the prebuilt venv + application code and keeps `uv`
  on `PATH`. `uv` is required at runtime because both compose files invoke the
  backend via `uv run uvicorn ...`, and the dev stack runs `uv sync` at startup
  into a mounted venv volume. `PYTHONPATH=/app` makes `backend` importable.
- A `HEALTHCHECK` hits `/api/v1/health`.

> The default `CMD` is overridden by compose (dev: `--reload`, prod:
> `--workers`). The container currently runs as **root** to match the compose
> contract (dev writes to `/root/.cache/uv`; prod mounts the Docker socket).
> Running as a non-root user is a possible follow-up but requires coordinated
> changes to the compose `command`s and host volume ownership.

### Build

```bash
# Default: installs every optional extra (queue/lock backends, neo4j, faiss, qdrant, ...)
docker build -f backend/Dockerfile -t ai-collective-backend .

# Restrict to specific extras only (smaller image)
docker build -f backend/Dockerfile \
  --build-arg UV_EXTRAS=rabbitmq,redis \
  -t ai-collective-backend .
```

`.dockerignore` keeps secrets (`.env`, `secrets/`), logs, storage, the venv,
and the frontend out of the build context.

### Runtime directories

`/app/storage`, `/app/logs`, `/app/sandbox_workspace`, and `/app/static` are
created by the Dockerfile at build time. The container runs as **root** (see
note above, no `USER` directive), so these are root-owned; mount volumes there
for persistence.

## Backends

### Task queue (`task_queue.backend`)

- `memory` (default) — bounded-concurrency `ThreadPoolExecutor`, single
  instance. `task_queue.max_concurrent` caps simultaneous tasks.
- `rabbitmq` — requires the `rabbitmq` extra and `task_queue.rabbitmq_url`.
  Messages are acknowledged **after** the task completes (scheduled onto the
  connection thread via `add_callback_threadsafe`), so a crash mid-task
  redelivers rather than loses the message. A background consumer reconnects
  on failure.

Both backends implement `shutdown()`; the FastAPI shutdown event calls
`task_queue.shutdown()` to drain the executor and stop the consumer cleanly.

> Note: the RabbitMQ backend stores the task callable in-process (not
> serialized), so full cross-process durability also requires a persistent
> worker architecture — see the docstring in `infrastructure/task_queue.py`.

### Locks (`lock.backend`)

- `threading` (default, single instance) or `redis` (multi-instance, needs
  `lock.redis_url` and the `redis` extra).

### Sandbox (`sandbox.mode`)

- `local` (dev only — runs on the host) or `k8s` (needs
  `sandbox.provisioner_url`; see [k3s.md](k3s.md)). There is no `docker` mode.

## Graceful shutdown

On `SIGTERM`, uvicorn stops accepting connections and the registered shutdown
handler drains the task queue. Running the venv's uvicorn directly (not via
`uv run`) ensures the signal reaches uvicorn as PID 1.

## Production checklist

- [ ] Set a strong `auth.jwt_secret_key` (`openssl rand -hex 32`, via `${JWT_SECRET_KEY}`) and `app.environment=production`.
- [ ] Set explicit `app.cors_origins`.
- [ ] Enable at least one entry in `models:` with a valid API key.
- [ ] Choose durable `storage.backend` / `task_queue.backend` / `lock.backend` for multi-instance.
- [ ] Configure webhook secrets (`signing_secret`, `channel_secret`, `app_secret`, `public_key`).
- [ ] Do **not** set `security.allow_private_http: true`.
- [ ] Run `uv sync` (adds `defusedxml`).
