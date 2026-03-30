# AI Collective

AI Collective is a multi-agent collaboration platform designed to model how high-performing teams operate in real production environments. Rather than treating AI as a single assistant, the platform enables organizations to assemble specialized agents, orchestrate them as coordinated teams, and execute structured workflows that move from planning to delivery with measurable outcomes.

## 🚀 Introduction

This project is built for product teams, AI engineers, and researchers who want to develop and validate AI workforce patterns in a practical system. Each agent can be configured with a dedicated role, behavior prompt, and connected toolset, allowing teams to distribute responsibilities across planning, research, execution, and review. The result is a transparent collaboration model where progress is visible through tasks, conversations, activity streams, and analytics.

## ✨ Core Capabilities

AI Collective provides end-to-end lifecycle management for agents, skills, teams, tasks, and communication flows. Teams can be run with sequential coordination for deterministic execution or mesh-style collaboration for parallel reasoning and iteration. Inference is supported through direct LLM chat as well as agent-graph orchestration, with streaming responses available through server-sent events for real-time interaction.

The skill ecosystem is intentionally extensible and integration-friendly. Through reusable tool presets and configurable skill presets, agents can access web search, browser automation, social intelligence pipelines, HTTP workflows, and Google Workspace capabilities. OAuth-based authorization is available for Google services, including Sheets, Drive, Docs, Slides, and Calendar, which enables secure access to third-party workflows during local and staged development.

## 🏗️ Architecture

The frontend stack combines React, TypeScript, and Vite with Tailwind CSS, Radix UI, Framer Motion, and React Query to deliver a responsive, state-driven interface for complex agent interactions. The backend is implemented in FastAPI and follows Clean Architecture principles, where domain models remain independent, application services define use-case boundaries, infrastructure adapts external systems, and API layers expose stable contracts. Local persistence currently uses JSON-based storage, giving teams a lightweight development setup without sacrificing inspectability.

## ⚙️ Installation

To get started, prepare an environment with Node.js 18+, Python 3.11+, and npm. Clone the repository and move into the project root.

```bash
git clone https://github.com/your-org/ai-collective.git
cd ai-collective
```

Install frontend dependencies with npm, then resolve backend dependencies with uv.

```bash
npm install
uv sync
```

If you are using a virtual environment, activate it before running backend commands.

```bash
source .venv/bin/activate
```

## 🔐 Environment Configuration

Create a `.env` file in the project root and define runtime variables for both backend and frontend integration. LLM features require a valid Gemini API key, while frontend-to-backend routing is controlled through a configurable base URL.

```env
GEMINI_API_KEY=<YOUR_GEMINI_API_KEY_HERE>
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent
GEMINI_API_MODEL=gemini-2.5-flash

LOG_CONSOLE=true
LOG_FILE=true
LOG_LEVEL=DEBUG

GOOGLE_OAUTH_CLIENT_SECRET_PATH=<PATH_TO_YOUR_GOOGLE_OAUTH_CLIENT_SECRET_JSON_FILE_HERE>
```

Keep backend credentials outside variables prefixed with `VITE_`, since Vite-prefixed values are exposed to frontend bundles. When `VITE_API_BASE_URL` is not explicitly set, the frontend defaults to `http://localhost:8000/api/v1`.

## ▶️ Running The Project

Start the frontend development server with Vite.

```bash
npm run dev
```

Then launch the backend API service in a separate terminal.

```bash
uvicorn backend.api.main:app --reload --port 8000
```

By default, the frontend is available at `http://localhost:8080`. Backend documentation is available at `http://localhost:8000/docs`.

## 🔌 API Overview

All API routes are exposed under the `/api/v1` prefix. The service includes endpoints for health checks, agents, skills, teams, tasks, conversations, analytics, activity feeds, simulation planning, LLM chat, agent-graph execution in both streaming and non-streaming modes, and OAuth authorization state management. This surface is designed to support both UI-first interaction patterns and external orchestration clients.

## 👨‍💻 Author

AI Collective is created by SuZeAI (SuzeNith), an AI Research Engineer focused on autonomous agent systems and practical multi-agent product architecture.

## 🤝 Contributing

Contributions are welcome and highly appreciated. The recommended workflow is to fork the repository, create a focused branch for your feature or fix, keep commits concise and descriptive, run linting and tests before submission, and open a pull request that clearly explains implementation scope and validation results. Please avoid committing credentials or secret material, and keep architectural consistency with the existing backend Clean Architecture boundaries.

## 📄 License

This project is released under the MIT License.
