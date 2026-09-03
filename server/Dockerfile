ARG UV_IMAGE=ghcr.io/astral-sh/uv:0.9.5

# ---------------------------------------------------------------------------
# Stage 1: builder — resolve and install dependencies into a self-contained venv
# ---------------------------------------------------------------------------
FROM ${UV_IMAGE} AS uv

FROM python:3.11-slim-bookworm AS builder

ARG APT_MIRROR
ARG UV_INDEX_URL
# Optional dependency extras. When empty, all extras are installed (queue/lock
# backends etc.) to match the runtime expectations of docker-compose.
ARG UV_EXTRAS=""

RUN if [ -n "${APT_MIRROR}" ]; then \
      sed -i "s|deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list.d/debian.sources 2>/dev/null || true; \
      sed -i "s|deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list 2>/dev/null || true; \
    fi

COPY --from=uv /uv /bin/uv

WORKDIR /app

ENV UV_LINK_MODE=copy
ENV UV_COMPILE_BYTECODE=1
ENV UV_PYTHON=/usr/local/bin/python
ENV UV_PROJECT_ENVIRONMENT=/app/.venv
ENV UV_INDEX_URL=${UV_INDEX_URL}

COPY pyproject.toml uv.lock ./
RUN if [ -n "${UV_EXTRAS}" ]; then \
      uv sync --frozen --extra "${UV_EXTRAS}"; \
    else \
      uv sync --frozen --all-extras; \
    fi

# ---------------------------------------------------------------------------
# Stage 2: runtime — slim image with the prebuilt venv + uv (no build cache)
#
# uv is kept on PATH because docker-compose (dev and prod) invokes the backend
# via `uv run uvicorn ...` and dev additionally runs `uv sync` at startup into
# a mounted venv volume. The build cache and intermediate layers stay in the
# builder stage and are not shipped.
# ---------------------------------------------------------------------------
FROM python:3.11-slim-bookworm AS runtime

ARG APT_MIRROR
ARG UV_INDEX_URL

RUN if [ -n "${APT_MIRROR}" ]; then \
      sed -i "s|deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list.d/debian.sources 2>/dev/null || true; \
      sed -i "s|deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list 2>/dev/null || true; \
    fi

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    bash \
    && rm -rf /var/lib/apt/lists/*

COPY --from=uv /uv /bin/uv

WORKDIR /app

ENV UV_LINK_MODE=copy
ENV UV_COMPILE_BYTECODE=1
ENV UV_PYTHON=/usr/local/bin/python
ENV UV_PROJECT_ENVIRONMENT=/app/.venv
ENV UV_INDEX_URL=${UV_INDEX_URL}
# venv on PATH for direct execution; PYTHONPATH so `server` imports anywhere.
ENV PATH="/app/.venv/bin:${PATH}"
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Prebuilt virtualenv from the builder (prod uses it directly; dev shadows it
# with a named volume that it repopulates via `uv sync`).
COPY --from=builder /app/.venv /app/.venv
# uv needs the project manifest at runtime for `uv run` / `uv sync`.
COPY pyproject.toml uv.lock ./
COPY server/ ./server/

RUN mkdir -p /app/storage /app/.artifact/logs /app/sandbox_workspace /app/static

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8000/api/v1/health || exit 1

# Default command (compose overrides this for dev --reload / prod --workers).
CMD ["uv", "run", "uvicorn", "server.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
