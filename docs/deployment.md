# Deployment

## Docker image

`backend/Dockerfile` is a hardened multi-stage build:

- **Builder stage** resolves dependencies with `uv` into `/app/.venv`.
- **Runtime stage** copies only the venv + application code (no `uv` or build
  cache in the final image), runs as a **non-root** `appuser`, sets
  `PYTHONPATH=/app`, and invokes `uvicorn` directly so it is PID 1 and receives
  `SIGTERM` for graceful shutdown.
- A `HEALTHCHECK` hits `/api/v1/health`.

### Build

```bash
# Runtime deps only
docker build -f backend/Dockerfile -t ai-collective-backend .

# Include optional extras (e.g. queue/lock backends)
docker build -f backend/Dockerfile \
  --build-arg UV_EXTRAS=rabbitmq,redis \
  -t ai-collective-backend .
```

`.dockerignore` keeps secrets (`.env`, `secrets/`), logs, storage, the venv,
and the frontend out of the build context.

### Runtime directories

`/app/storage`, `/app/logs`, `/app/sandbox_workspace`, and `/app/static` are
created and owned by `appuser`. Mount volumes there for persistence.

## Backends

### Task queue (`TASK_QUEUE_BACKEND`)

- `memory` (default) — bounded-concurrency `ThreadPoolExecutor`, single
  instance. `TASK_QUEUE_MAX_CONCURRENT` caps simultaneous tasks.
- `rabbitmq` — requires the `rabbitmq` extra and `RABBITMQ_URL`. Messages are
  acknowledged **after** the task completes (scheduled onto the connection
  thread via `add_callback_threadsafe`), so a crash mid-task redelivers rather
  than loses the message. A background consumer reconnects on failure.

Both backends implement `shutdown()`; the FastAPI shutdown event calls
`task_queue.shutdown()` to drain the executor and stop the consumer cleanly.

> Note: the RabbitMQ backend stores the task callable in-process (not
> serialized), so full cross-process durability also requires a persistent
> worker architecture — see the docstring in `infrastructure/task_queue.py`.

### Locks (`LOCK_BACKEND`)

- `threading` (default, single instance) or `redis` (multi-instance, needs
  `REDIS_URL` and the `redis` extra).

### Sandbox (`SANDBOX_MODE`)

- `local` (dev only — runs on the host), `docker`, or `k8s` (needs
  `SANDBOX_PROVISIONER_URL`; see [K3S.md](K3S.md)).

## Graceful shutdown

On `SIGTERM`, uvicorn stops accepting connections and the registered shutdown
handler drains the task queue. Running the venv's uvicorn directly (not via
`uv run`) ensures the signal reaches uvicorn as PID 1.

## Production checklist

- [ ] Set a strong `JWT_SECRET_KEY` (`openssl rand -hex 32`) and `ENVIRONMENT=production`.
- [ ] Set explicit `CORS_ORIGINS`.
- [ ] Provide LLM provider key(s).
- [ ] Choose durable `STORAGE_BACKEND` / `TASK_QUEUE_BACKEND` / `LOCK_BACKEND` for multi-instance.
- [ ] Configure webhook secrets (`signing_secret`, `channel_secret`, `app_secret`, `public_key`).
- [ ] Do **not** set `ALLOW_PRIVATE_HTTP`.
- [ ] Run `uv sync` (adds `defusedxml`).
