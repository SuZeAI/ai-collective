# ============================================================================
# AI Collective — Makefile
# ============================================================================
# Usage:  make <target>
# Run     make help   for a full list of available targets.
# ============================================================================

# ── Load .env (non-fatal if missing) ─────────────────────────────────────
ifneq (,$(wildcard .env))
    include .env
    export
endif

# ── Project configuration ─────────────────────────────────────────────────
SHELL     := /bin/bash
.DEFAULT_GOAL := help

# Optional Docker Compose profiles to enable, space-separated.
# Works with any target (dev/up/down/ps/logs…). Examples:
#   make dev PROFILES=router
#   make dev PROFILES="provisioner router"
#   make up  PROFILES="router provisioner"
# Available profiles: provisioner · router · mongo-express · tools · minio · qdrant · neo4j
PROFILES ?=
COMPOSE_PROFILES := $(foreach p,$(PROFILES),--profile $(p))

COMPOSE_DEV  := docker compose -f docker/docker-compose-dev.yaml $(COMPOSE_PROFILES)
COMPOSE_PROD := docker compose -f docker/docker-compose.yaml $(COMPOSE_PROFILES)

# All-profiles variants — used by teardown targets so `make down`/`make dev-down`
# stop EVERY service (including profile-gated ones: provisioner, router),
# regardless of which PROFILES were used to start them.
COMPOSE_DEV_ALL  := docker compose -f docker/docker-compose-dev.yaml --profile "*"
COMPOSE_PROD_ALL := docker compose -f docker/docker-compose.yaml --profile "*"

BACKEND_PORT  ?= 8000
FRONTEND_PORT ?= 8080
BACKEND_WORKERS ?= 1

# Credential fallbacks (overridden by .env if defined there)
MONGO_USER    ?= admin
MONGO_PASS    ?= admin
RABBITMQ_USER ?= guest
RABBITMQ_PASS ?= guest

# Services whose stdout/stderr are collected into .artifact/logs/<service>.log by dev-log-collect
COMPOSE_DEV_SERVICES := mongodb mongo-express redis redis-commander rabbitmq nginx frontend backend
LOG_DIR              := .artifact/logs

# Colour helpers (no-op if terminal does not support them)
C_RESET  := \033[0m
C_BOLD   := \033[1m
C_GREEN  := \033[32m
C_CYAN   := \033[36m
C_YELLOW := \033[33m

# ── Phony declarations ────────────────────────────────────────────────────
.PHONY: help \
        dev dev-down dev-stop dev-start dev-build dev-logs dev-ps dev-log-collect \
        dev-provisioner dev-router dev-full \
        up down stop start build restart ps logs logs-backend logs-frontend \
        prod-provisioner prod-router prod-all \
        backend frontend \
        infra infra-down \
        install install-backend install-frontend \
        env setup dirs \
        test test-backend test-frontend \
        lint lint-backend lint-frontend \
        check check-install \
        clean clean-docker clean-venv \
        storage-reset

# ============================================================================
# HELP
# ============================================================================

help: ## Show this help message
	@printf "\n\033[1m\033[36m  AI Collective — available targets\033[0m\n"
	@awk 'BEGIN {FS = ":.*##"} \
	    /^##@ / { \
	        sub(/^##@ /, ""); \
	        printf "\n\033[1m  %s\033[0m\n  %s\n", $$0, "------------------------------------------------------------"; \
	    } \
	    /^[a-zA-Z_-]+:.*##/ { \
	        printf "  \033[32m%-28s\033[0m %s\n", $$1, $$2 \
	    }' $(MAKEFILE_LIST)
	@printf "\n\033[1m\033[33m  Examples\033[0m\n"
	@printf "  make dev                          # Start full dev stack (Docker, hot-reload)\n"
	@printf "  make dev PROFILES=router          # Dev stack + 9Router LLM proxy\n"
	@printf "  make dev PROFILES=\"provisioner router\" # Dev stack + k3s sandbox provisioner + 9Router\n"
	@printf "  make up  PROFILES=router          # Prod stack + 9Router\n"
	@printf "  make backend                      # Run backend locally (needs infra running)\n"
	@printf "\n\033[1m\033[33m  Profiles$(C_RESET) (PROFILES=…)  provisioner · router · mongo-express · tools · minio · qdrant · neo4j\n"
	@printf "\n"

# ============================================================================
# DEVELOPMENT — full Docker stack (hot-reload)
# ============================================================================

##@ Development (Docker — hot-reload)

dev: dirs env ## Start full development stack (hot-reload, all services)
	@printf "$(C_CYAN)Starting dev stack…$(C_RESET)\n"
	@printf "$(C_YELLOW)Clearing old logs…$(C_RESET)\n"
	@rm -f $(LOG_DIR)/*.log
	$(COMPOSE_DEV) up --build -d
	@$(MAKE) --no-print-directory dev-log-collect
	@printf "\n"
	@printf "$(C_BOLD)$(C_CYAN)  AI COLLECTIVE$(C_RESET)  —  Development Stack\n"
	@printf "  Multi-agent platform · React + FastAPI · Hot-reload\n"
	@printf "  LLM: $(LLM_PROVIDER) / $(LLM_MODEL)   Storage: $(STORAGE_BACKEND)   Log: $(LOG_LEVEL)\n"
	@printf "\n"
	@printf "$(C_BOLD)  Application$(C_RESET)\n"
	@printf "    App       →  $(C_GREEN)http://localhost:2026$(C_RESET)\n"
	@printf "    REST API  →  $(C_GREEN)http://localhost:2026/api/v1$(C_RESET)\n"
	@printf "    API Docs  →  $(C_GREEN)http://localhost:2026/api/docs$(C_RESET)\n"
	@printf "\n"
	@printf "$(C_BOLD)  Admin UIs$(C_RESET)\n"
	@printf "    MongoDB   →  $(C_YELLOW)http://localhost:8081$(C_RESET)   $(MONGO_USER)/$(MONGO_PASS)\n"
	@printf "    Redis     →  $(C_YELLOW)http://localhost:8083$(C_RESET)\n"
	@printf "    RabbitMQ  →  $(C_YELLOW)http://localhost:15672$(C_RESET)  $(RABBITMQ_USER)/$(RABBITMQ_PASS)\n"
	@printf "\n"
	@printf "$(C_BOLD)  Logs$(C_RESET)  →  $(LOG_DIR)/<service>.log\n"
	@printf "    make dev-logs              tail all\n"
	@printf "    make dev-logs-backend      tail backend\n"
	@printf "    make dev-logs-frontend     tail frontend\n"
	@printf "\n"
	@printf "$(C_BOLD)  Commands$(C_RESET)\n"
	@printf "    make dev-ps                container status\n"
	@printf "    make dev-restart-backend   hot-restart backend\n"
	@printf "    make dev-down              stop & remove all\n"
	@printf "\n"

dev-build: ## Rebuild all dev images without cache
	$(COMPOSE_DEV) build --no-cache

dev-down: ## Stop and remove ALL dev containers incl. profiles (provisioner/router) + networks
	@if [ -f $(LOG_DIR)/.collector.pids ]; then \
	    xargs -r kill < $(LOG_DIR)/.collector.pids 2>/dev/null || true; \
	    rm -f $(LOG_DIR)/.collector.pids; \
	fi
	$(COMPOSE_DEV_ALL) down --remove-orphans

dev-stop: ## Stop ALL dev containers incl. profiles without removing them (preserves state)
	@if [ -f $(LOG_DIR)/.collector.pids ]; then \
	    xargs -r kill < $(LOG_DIR)/.collector.pids 2>/dev/null || true; \
	    rm -f $(LOG_DIR)/.collector.pids; \
	fi
	$(COMPOSE_DEV_ALL) stop

dev-start: ## Start stopped dev containers (use after dev-stop)
	$(COMPOSE_DEV) start
	@$(MAKE) --no-print-directory dev-log-collect

dev-log-collect: ## Start per-service log collectors → .artifact/logs/<service>.log
	@mkdir -p $(LOG_DIR)
	@if [ -f $(LOG_DIR)/.collector.pids ]; then \
	    xargs -r kill < $(LOG_DIR)/.collector.pids 2>/dev/null || true; \
	    rm -f $(LOG_DIR)/.collector.pids; \
	fi
	@for svc in $(COMPOSE_DEV_SERVICES); do \
	    $(COMPOSE_DEV) logs -f --timestamps $$svc >> $(LOG_DIR)/$$svc.log 2>&1 & echo $$! >> $(LOG_DIR)/.collector.pids; \
	done
	@printf "$(C_CYAN)Log collectors started$(C_RESET) → $(LOG_DIR)/*.log\n"

dev-logs: ## Tail all dev container logs (Ctrl-C to stop)
	$(COMPOSE_DEV) logs -f

dev-logs-backend: ## Tail only backend dev logs
	$(COMPOSE_DEV) logs -f backend

dev-logs-frontend: ## Tail only frontend dev logs
	$(COMPOSE_DEV) logs -f frontend

dev-ps: ## Show status of dev containers
	$(COMPOSE_DEV) ps

dev-restart: ## Restart all dev containers
	$(COMPOSE_DEV) restart

dev-restart-backend: ## Restart only the backend container
	$(COMPOSE_DEV) restart backend

# ── Dev with optional profiles (shortcuts for `make dev PROFILES=…`) ──────

dev-provisioner: ## Dev stack + K8s provisioner (sandbox runs as a k3s Pod)
	@$(MAKE) --no-print-directory dev PROFILES="$(PROFILES) provisioner"
	@printf "  Provisioner: http://localhost:8002/health\n"
	@printf "$(C_YELLOW)  Tip: set SANDBOX_MODE=k8s and SANDBOX_PROVISIONER_URL=http://provisioner:8002 in .env (see docs/k3s.md)$(C_RESET)\n"

dev-router: ## Dev stack + 9Router multi-provider LLM proxy
	@$(MAKE) --no-print-directory dev PROFILES="$(PROFILES) router"
	@printf "  9Router dashboard: $(C_GREEN)http://localhost:$${ROUTER_PORT:-20128}/dashboard$(C_RESET)\n"
	@printf "$(C_YELLOW)  Tip: set LLM_PROVIDER=openai, LLM_API_BASE=http://nine-router:20128/v1,$(C_RESET)\n"
	@printf "$(C_YELLOW)       OPENAI_API_KEY=<dashboard key> in .env (see docs/9router-setup.md)$(C_RESET)\n"

dev-full: ## Dev stack + ALL profiles at once (provisioner/router/minio/qdrant/neo4j) — sandboxes run as k3s Pods via provisioner
	@$(MAKE) --no-print-directory dev PROFILES="provisioner router minio qdrant neo4j"
	@printf "  Provisioner  → http://localhost:8002/health\n"
	@printf "  9Router      → http://localhost:$${ROUTER_PORT:-20128}/dashboard\n"
	@printf "  MinIO console→ http://localhost:$${MINIO_CONSOLE_PORT:-9001}\n"
	@printf "  Qdrant       → http://localhost:$${QDRANT_HTTP_PORT:-6333}/dashboard\n"
	@printf "  Neo4j        → http://localhost:$${NEO4J_HTTP_PORT:-7474}\n"

# ============================================================================
# PRODUCTION
# ============================================================================

##@ Production (Docker)

up: dirs env ## Start production stack (detached)
	@printf "$(C_CYAN)Starting production stack…$(C_RESET)\n"
	$(COMPOSE_PROD) up -d
	@printf "$(C_GREEN)✓ Production stack up:$(C_RESET) http://localhost:2026\n"

down: ## Stop and remove ALL production containers incl. profiles (provisioner/router) + networks
	$(COMPOSE_PROD_ALL) down --remove-orphans

stop: ## Stop ALL production containers incl. profiles without removing them (preserves state)
	$(COMPOSE_PROD_ALL) stop

start: ## Start stopped production containers (use after stop)
	$(COMPOSE_PROD) start

build: ## Build production images (no cache)
	$(COMPOSE_PROD) build --no-cache

restart: ## Restart all production containers
	$(COMPOSE_PROD) restart

ps: ## Show status of production containers
	$(COMPOSE_PROD) ps

logs: ## Tail all production logs
	$(COMPOSE_PROD) logs -f

logs-backend: ## Tail only backend production logs
	$(COMPOSE_PROD) logs -f backend

logs-frontend: ## Tail only frontend production logs
	$(COMPOSE_PROD) logs -f frontend

# ── Production with optional profiles (shortcuts for `make up PROFILES=…`) ─

prod-provisioner: ## Production stack + K8s provisioner (needs kubeconfig)
	@$(MAKE) --no-print-directory up PROFILES="$(PROFILES) provisioner"
	@printf "$(C_GREEN)✓ Provisioner running.$(C_RESET)  Set sandbox.mode: k8s and sandbox.provisioner_url: http://provisioner:8002 in .config/config.yml\n"

prod-router: ## Production stack + 9Router multi-provider LLM proxy
	@$(MAKE) --no-print-directory up PROFILES="$(PROFILES) router"
	@printf "$(C_GREEN)✓ 9Router running.$(C_RESET)  Dashboard: http://localhost:$${ROUTER_PORT:-20128}/dashboard\n"
	@printf "  Set LLM_PROVIDER=openai, LLM_API_BASE=http://nine-router:20128/v1, OPENAI_API_KEY=<key> in .env (docs/9router-setup.md)\n"

prod-all: ## Production stack + provisioner (sandboxes run as k3s Pods)
	@$(MAKE) --no-print-directory up PROFILES="$(PROFILES) provisioner"

# ============================================================================
# LOCAL DEVELOPMENT (without Docker — runs directly on host)
# ============================================================================

##@ Local Development (no Docker)

backend: dirs env ## Run backend locally with hot-reload (needs: make infra)
	@printf "$(C_CYAN)Starting backend on port $(BACKEND_PORT)…$(C_RESET)\n"
	uv run uvicorn server.api.main:app \
	    --host 0.0.0.0 \
	    --port $(BACKEND_PORT) \
	    --reload \
	    --log-level $${LOG_LEVEL:-info}

backend-prod: dirs env ## Run backend locally in production mode (multi-worker)
	uv run uvicorn server.api.main:app \
	    --host 0.0.0.0 \
	    --port $(BACKEND_PORT) \
	    --workers $(BACKEND_WORKERS)

frontend: ## Run frontend dev server locally
	@printf "$(C_CYAN)Starting frontend on port $(FRONTEND_PORT)…$(C_RESET)\n"
	npm --prefix ui run dev -- --host 0.0.0.0 --port $(FRONTEND_PORT)

frontend-build: ## Build frontend for production
	npm --prefix ui run build

frontend-preview: frontend-build ## Preview the production frontend build
	npm --prefix ui run preview

# ── Infrastructure only (redis + rabbitmq for local backend dev) ──────────

infra: dirs ## Start only redis + rabbitmq (for running backend locally)
	@printf "$(C_CYAN)Starting infra services (redis, rabbitmq)…$(C_RESET)\n"
	$(COMPOSE_DEV) up -d redis rabbitmq
	@printf "$(C_GREEN)✓ Redis:    localhost:6379$(C_RESET)\n"
	@printf "$(C_GREEN)✓ RabbitMQ: localhost:5672  (mgmt: http://localhost:15672)$(C_RESET)\n"

infra-down: ## Stop infra services
	$(COMPOSE_DEV) stop redis rabbitmq

# ============================================================================
# SETUP & INSTALL
# ============================================================================

##@ Setup & Install

install: install-backend install-frontend ## Install all dependencies

install-backend: ## Install Python dependencies (uv)
	uv sync --all-extras

install-frontend: ## Install Node.js dependencies (npm)
	npm --prefix ui ci

env: ## Create .env from .env.example if it does not exist
	@if [ ! -f .env ]; then \
	    if [ -f .env.example ]; then \
	        cp .env.example .env; \
	        printf "$(C_YELLOW)⚠  Created .env from .env.example — edit it before starting.$(C_RESET)\n"; \
	    else \
	        printf "$(C_YELLOW)⚠  No .env file found. Create one at the project root.$(C_RESET)\n"; \
	    fi \
	fi

dirs: ## Create required runtime directories
	@mkdir -p storage/runtime .artifact/logs .artifact/sandbox_workspace

setup: install dirs env ## Full first-time project setup
	@printf "$(C_GREEN)✓ Setup complete.$(C_RESET)  Edit .env then run:  make dev\n"

# ============================================================================
# TESTING & LINTING
# ============================================================================

##@ Testing & Linting

test: test-backend test-frontend ## Run all tests

test-backend: ## Run backend tests (pytest)
	uv run pytest server/ -v

test-frontend: ## Run frontend tests (vitest)
	npm --prefix ui run test

test-frontend-watch: ## Run frontend tests in watch mode
	npm --prefix ui run test:watch

lint: lint-backend lint-frontend ## Lint all code

lint-backend: ## Lint backend (ruff / flake8 if available)
	@uv run ruff check server/ 2>/dev/null || \
	 uv run flake8 server/ 2>/dev/null || \
	 printf "$(C_YELLOW)No Python linter found (install ruff: uv add ruff)$(C_RESET)\n"

lint-frontend: ## Lint frontend (eslint)
	npm --prefix ui run lint

check: ## Run all pre-commit checks against the whole repo (lint + file hygiene)
	uv run pre-commit run --all-files

check-install: ## Install the pre-commit git hook (runs check on `git commit`)
	uv run pre-commit install

# ============================================================================
# STORAGE
# ============================================================================

##@ Storage

storage-reset: ## ⚠ Delete all runtime storage JSON files (agents, tasks, conversations…)
	@printf "$(C_YELLOW)⚠  This will delete all data in storage/runtime/$(C_RESET)\n"
	@read -p "Type 'yes' to continue: " confirm && [ "$$confirm" = "yes" ] || exit 1
	rm -f storage/runtime/*.json
	@printf "$(C_GREEN)✓ Storage cleared.$(C_RESET)\n"

# ============================================================================
# CLEANUP
# ============================================================================

##@ Cleanup

clean: clean-docker ## Remove build artefacts and cache files
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .ruff_cache -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	rm -rf dist/ 2>/dev/null || true
	@printf "$(C_GREEN)✓ Clean complete.$(C_RESET)\n"

clean-docker: ## Remove stopped containers and dangling images
	$(COMPOSE_DEV_ALL) down --remove-orphans 2>/dev/null || true
	$(COMPOSE_PROD_ALL) down --remove-orphans 2>/dev/null || true
	docker image prune -f 2>/dev/null || true

clean-venv: ## Remove the .venv directory
	rm -rf .venv
