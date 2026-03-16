# 🤖 AI Team — Multi-Agent Collaboration Platform

AI Team is a modern **multi-agent AI collaboration platform** where intelligent AI agents work together like a real project team.

Instead of using a single AI assistant, this system allows users to create **groups of AI agents** that communicate, discuss tasks, divide responsibilities, and autonomously produce results.

The goal is to simulate an **AI workforce** capable of handling real business workflows.

---

# 🚀 Overview

AI Team enables businesses and developers to build **AI-powered teams** composed of multiple agents with different roles such as:

- Project Manager
- Research Agent
- Developer Agent
- Marketing Agent
- Reviewer Agent

These agents can:

- collaborate together
- communicate with each other
- split tasks
- generate results automatically

The platform simulates how an **AI project team** works in real-world scenarios.

---

# 🧠 Core Concept

Instead of one AI model doing everything, tasks are solved by **a team of specialized AI agents**.

Example workflow:

```
User Task
   ↓
Manager Agent (planning)
   ↓
Research Agent (collect data)
Developer Agent (build solution)
Marketing Agent (create content)
   ↓
Reviewer Agent (quality check)
   ↓
Final Result
```

Agents communicate through simulated conversations and collaborate to complete tasks.

---

# ✨ Features

## 1️⃣ AI Agent Creation

Users can create specialized AI agents.

Example roles:

- Manager Agent
- Research Agent
- Developer Agent
- Marketing Agent
- Reviewer Agent

Each agent has:

- role
- description
- status
- activity logs

---

## 2️⃣ Agent Teams

Users can create **teams of agents**.

Example:

Startup Launch Team

Agents:

- Manager Agent
- Research Agent
- Developer Agent
- Marketing Agent
- Reviewer Agent

Teams collaborate to complete tasks together.

---

## 3️⃣ Role System

Agents inside teams can have roles:

| Role | Responsibility |
|-----|-----|
Leader | Coordinates the team |
Worker | Executes tasks |
Analyst | Collects information |
Reviewer | Evaluates results |

This allows agents to simulate **real organizational structures**.

---

## 4️⃣ Autonomous Task Execution

Users can assign tasks to teams.

Example task:

```
Create a landing page for an AI startup
```

Agents will:

1. analyze the task  
2. discuss internally  
3. split subtasks  
4. generate output  
5. review results  

---

## 5️⃣ Agent Communication

Agents communicate through simulated messages.

Example conversation:

```
Research Agent:
"I found 5 competitor products."

Developer Agent:
"I will build the website structure."

Marketing Agent:
"I will write landing page content."

Reviewer Agent:
"Please refine the headline."
```

---

## 6️⃣ Task & Automation System

Tasks assigned to teams are tracked through the system.

Example:

| Task | Agent | Status |
|-----|-----|-----|
Analyze competitors | Research Agent | Completed |
Generate UI structure | Developer Agent | Running |
Write marketing copy | Marketing Agent | Pending |

---

## 7️⃣ Agent Activity Feed

The system displays real-time team activity.

Example:

```
Research Agent collected competitor data
Developer Agent generated UI structure
Marketing Agent wrote product copy
Reviewer Agent approved final output
```

---

## 8️⃣ Analytics Dashboard

Monitor team performance with analytics such as:

- tasks completed
- team efficiency
- agent productivity
- automation success rate

---

# 🖥️ Tech Stack

Frontend:

- React
- Tailwind CSS
- Framer Motion

Architecture:

- Component-based design
- Mock data simulation
- Simulated API calls using `setTimeout`

No backend required for this prototype.

---

# 📂 Project Structure

```
src/
 ├── components
 │   ├── Sidebar
 │   ├── DashboardCards
 │   ├── AgentList
 │   ├── TeamBuilder
 │   ├── TaskTable
 │   ├── ConversationPanel
 │   └── AnalyticsCharts
 │
 ├── pages
 │   ├── LandingPage
 │   ├── Dashboard
 │   ├── Agents
 │   ├── Teams
 │   ├── Tasks
 │   ├── Analytics
 │   └── Settings
 │
 ├── data
 │   ├── agents.js
 │   ├── teams.js
 │   ├── tasks.js
 │   └── conversations.js
 │
 └── App.jsx
```

---

# 🎮 Demo Simulation

The platform simulates real AI collaboration:

- agents discuss tasks
- subtasks are assigned
- workflows execute automatically
- results appear in the dashboard

All actions are simulated using mock data.

---

# 🌟 Future Improvements

Potential features for future versions:

- real AI agents with LLM integration
- agent memory system
- workflow builder (like Zapier / n8n)
- autonomous agent planning
- multi-agent orchestration engine
- vector database for knowledge sharing
- real-time collaboration

---

# 📸 Screens

Planned UI pages:

- Landing Page
- AI Agent Dashboard
- Agent Builder
- Team Builder
- Task Manager
- Agent Conversations
- Analytics Dashboard

---

# ⚙️ Installation

Clone the repository:

```bash
git clone https://github.com/yourusername/ai-team.git
```

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

---

# 🧩 Backend (FastAPI + Clean Architecture + LangChain)

Backend được đặt trong thư mục `backend/` theo Clean Architecture:

- `backend/domain`: entity + enum + errors (thuần business)
- `backend/application`: ports (interfaces) + use-case services
- `backend/infrastructure`: adapters (in-memory repo, LangChain Gemini)
- `backend/api`: FastAPI routers + schemas

## Cài deps Python

Tối thiểu cần Python `>= 3.11`.

Nếu bạn dùng `pip`:

```bash
pip install -e .
```

## Chạy API server

```bash
uvicorn backend.api.main:app --reload --port 8000
```

Mở docs:

- Swagger: `http://localhost:8000/docs`
- OpenAPI: `http://localhost:8000/openapi.json`

## Env (Gemini)

Backend đọc các biến sau (server-side):

- `GEMINI_API_KEY` (bắt buộc nếu muốn dùng LLM)
- `GEMINI_API_MODEL` (mặc định: `gemini-flash-latest`)

Lưu ý: không đặt key dưới dạng `VITE_...` để tránh frontend vô tình bundle.

## API endpoints chính

Base prefix: `/api/v1`

- `GET /health`
- `GET/POST /agents`
- `GET/POST /teams`
- `GET/POST /tasks`
- `GET/POST /conversations`
- `GET /analytics`
- `GET /activity-feed`
- `POST /simulations/plan` (frontend Dashboard/Playground dùng để lấy “kịch bản” mô phỏng)
- `POST /llm/chat` (chat trực tiếp với LLM; trả `503` nếu thiếu key)

## Lưu dữ liệu tạm (JSON)

Hiện tại backend đang lưu dữ liệu “thật” (tạm thời) vào thư mục `storage/` dưới dạng JSON:

- `storage/agents.json`
- `storage/teams.json`
- `storage/tasks.json`
- `storage/conversations.json`
- `storage/analytics.json`
- `storage/activity_feed.json`

Bạn có thể chỉnh trực tiếp các file này để thấy frontend cập nhật khi reload.

---

# 🔌 Kết nối Frontend → Backend

Hook mô phỏng trong frontend đã được chỉnh để ưu tiên gọi backend tại:

- `POST {VITE_API_BASE_URL}/simulations/plan`

Bạn có thể cấu hình base URL bằng biến môi trường Vite:

```bash
export VITE_API_BASE_URL="http://localhost:8000/api/v1"
```

Nếu không cấu hình hoặc backend chưa chạy, frontend tự fallback về mô phỏng local.

---

# 💡 Inspiration

This project explores the idea of **AI Workforce Platforms**, where teams of AI agents collaborate autonomously to solve complex problems.

Inspired by modern multi-agent frameworks and AI orchestration systems.

---

# 👨‍💻 Author

**@SuZeAI — SuzeNith**

AI Research Engineer  
Builder of AI systems and autonomous agent platforms.

---

# 📜 License

MIT License

Feel free to use, modify, and build upon this project.
