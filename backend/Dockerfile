ARG UV_IMAGE=ghcr.io/astral-sh/uv:0.7.20

# ---------------------------------------------------------------------------
# Stage 1: builder — resolve and install dependencies into a self-contained venv
# ---------------------------------------------------------------------------
FROM ${UV_IMAGE} AS uv

FROM python:3.11-slim-bookworm AS builder

ARG APT_MIRROR
ARG UV_INDEX_URL
# Optional dependency extras to install (e.g. "rabbitmq,redis"). Empty by default
# so the image ships only runtime deps; override for queue/lock backends.
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
      uv sync --frozen --no-install-project --extra "${UV_EXTRAS}"; \
    else \
      uv sync --frozen --no-install-project; \
    fi

# ---------------------------------------------------------------------------
# Stage 2: runtime — minimal image with only the venv + application code
# ---------------------------------------------------------------------------
FROM python:3.11-slim-bookworm AS runtime

ARG APT_MIRROR

RUN if [ -n "${APT_MIRROR}" ]; then \
      sed -i "s|deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list.d/debian.sources 2>/dev/null || true; \
      sed -i "s|deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list 2>/dev/null || true; \
    fi

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    bash \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Bring in the prebuilt virtualenv (no uv / build toolchain in the final image).
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:${PATH}"
# Make the `backend` package importable without `uv run`'s project context.
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

COPY backend/ ./backend/

# Create a non-root user and hand over ownership of the writable runtime dirs.
RUN useradd --create-home --uid 1000 appuser \
    && mkdir -p /app/storage /app/logs /app/sandbox_workspace /app/static \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8000/api/v1/health || exit 1

# Invoke uvicorn directly so it is PID 1 and receives SIGTERM for graceful shutdown.
CMD ["uvicorn", "backend.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
