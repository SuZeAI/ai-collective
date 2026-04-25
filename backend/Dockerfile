ARG UV_IMAGE=ghcr.io/astral-sh/uv:0.7.20
FROM ${UV_IMAGE} AS uv

FROM python:3.11-slim-bookworm

ARG APT_MIRROR
ARG UV_INDEX_URL

RUN if [ -n "${APT_MIRROR}" ]; then \
      sed -i "s|deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list.d/debian.sources 2>/dev/null || true; \
      sed -i "s|deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list 2>/dev/null || true; \
    fi

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=uv /uv /bin/uv

WORKDIR /app

ENV UV_LINK_MODE=copy
ENV UV_COMPILE_BYTECODE=1
ENV UV_PYTHON=/usr/local/bin/python

ARG UV_INDEX_URL
ENV UV_INDEX_URL=${UV_INDEX_URL}

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --all-extras

COPY backend/ ./backend/

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "backend.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
