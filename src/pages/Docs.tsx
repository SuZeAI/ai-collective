import { useState, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ChevronRight, ChevronDown, Copy, Check, ExternalLink,
  BookOpen, Cpu, Users, CheckCircle2, MessageSquare, Wrench,
  ArrowRight, Menu, X, ArrowLeft, ArrowUpRight,
  Terminal, Package, Layers, GitBranch, Rocket, Heart,
  AlertTriangle, Info, Lightbulb, Flame,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const GITHUB_URL = "https://github.com/SuZeAI/ai-collective";

// ─── Navigation structure ─────────────────────────────────────────────────────

interface NavItem { id: string; title: string; badge?: string }
interface NavSection { id: string; title: string; icon: React.ElementType; items: NavItem[] }

const NAV: NavSection[] = [
  {
    id: "intro", title: "Introduction", icon: BookOpen,
    items: [
      { id: "what-is", title: "What is AI Collective?" },
      { id: "architecture", title: "Architecture" },
      { id: "key-concepts", title: "Key Concepts" },
    ],
  },
  {
    id: "getting-started", title: "Getting Started", icon: Rocket,
    items: [
      { id: "quickstart", title: "Quick Start" },
      { id: "installation", title: "Installation" },
      { id: "configuration", title: "Configuration" },
    ],
  },
  {
    id: "concepts", title: "Core Concepts", icon: Layers,
    items: [
      { id: "agents", title: "Agents" },
      { id: "skills", title: "Skills" },
      { id: "teams", title: "Teams" },
      { id: "tasks", title: "Tasks" },
      { id: "conversations", title: "Conversations" },
    ],
  },
  {
    id: "guides", title: "Guides", icon: Lightbulb,
    items: [
      { id: "guide-first-agent", title: "Create Your First Agent" },
      { id: "guide-build-team", title: "Build a Team" },
      { id: "guide-run-task", title: "Run a Task" },
      { id: "guide-skills", title: "Add Skills & APIs" },
    ],
  },
  {
    id: "api-reference", title: "API Reference", icon: Terminal,
    items: [
      { id: "api-agents", title: "Agents API" },
      { id: "api-skills", title: "Skills API" },
      { id: "api-teams", title: "Teams API" },
      { id: "api-tasks", title: "Tasks API" },
      { id: "api-chat", title: "Chat API" },
    ],
  },
  {
    id: "deployment", title: "Deployment", icon: Package,
    items: [
      { id: "deploy-docker", title: "Docker" },
      { id: "deploy-env", title: "Environment Variables" },
    ],
  },
  {
    id: "contributing", title: "Contributing", icon: Heart,
    items: [
      { id: "contributing-guide", title: "How to Contribute" },
      { id: "contributing-dev", title: "Development Setup" },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap((s) => s.items.map((i) => ({ ...i, section: s.title })));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);
  return { copied, copy };
}

function CodeBlock({ code, lang = "bash", title }: { code: string; lang?: string; title?: string }) {
  const { copied, copy } = useCopy(code);
  return (
    <div className="my-5 rounded-xl overflow-hidden border border-[hsl(222,44%,20%)] bg-[hsl(222,47%,8%)] text-sm font-mono">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[hsl(222,44%,16%)] bg-[hsl(222,47%,10%)]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          </div>
          {title && <span className="text-[11px] text-slate-400 ml-1">{title}</span>}
          {!title && lang && <span className="text-[11px] text-slate-500 uppercase tracking-wider ml-1">{lang}</span>}
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded hover:bg-white/5"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <pre className="px-5 py-4 text-slate-200 leading-relaxed whitespace-pre text-[13px]">{code}</pre>
      </div>
    </div>
  );
}

function Callout({ type = "info", children }: { type?: "info" | "tip" | "warning" | "danger"; children: React.ReactNode }) {
  const cfg = {
    info:    { icon: Info,          bg: "bg-blue-500/10 border-blue-500/25",    icon_cls: "text-blue-500",    title: "Note" },
    tip:     { icon: Lightbulb,     bg: "bg-emerald-500/10 border-emerald-500/25", icon_cls: "text-emerald-500", title: "Tip" },
    warning: { icon: AlertTriangle, bg: "bg-amber-500/10 border-amber-500/25",  icon_cls: "text-amber-500",   title: "Warning" },
    danger:  { icon: Flame,         bg: "bg-rose-500/10 border-rose-500/25",    icon_cls: "text-rose-500",    title: "Danger" },
  }[type];
  const Icon = cfg.icon;
  return (
    <div className={cn("my-5 flex gap-3 rounded-xl border p-4", cfg.bg)}>
      <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", cfg.icon_cls)} />
      <div className="text-sm leading-relaxed text-foreground/80">{children}</div>
    </div>
  );
}

function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-3 mt-0">{children}</h1>;
}
function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return <h2 id={id} className="text-xl font-bold tracking-tight text-foreground mt-10 mb-3 pt-2 border-t border-border/50 scroll-mt-20">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-foreground/75 leading-relaxed mb-4">{children}</p>;
}
function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-none space-y-1.5 mb-4 pl-0">{children}</ul>;
}
function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[15px] text-foreground/75">
      <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
function Pill({ children, color = "blue" }: { children: React.ReactNode; color?: "blue" | "green" | "orange" | "purple" }) {
  const c = { blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25", green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25", orange: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25", purple: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25" }[color];
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border", c)}>{children}</span>;
}
function InlineCode({ children }: { children: React.ReactNode }) {
  return <code className="px-1.5 py-0.5 rounded-md bg-muted text-[13px] font-mono text-foreground/90 border border-border/50">{children}</code>;
}

function ApiRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  const colors: Record<string, string> = { GET: "bg-sky-500/10 text-sky-600 dark:text-sky-400", POST: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", PUT: "bg-amber-500/10 text-amber-600 dark:text-amber-400", DELETE: "bg-rose-500/10 text-rose-600 dark:text-rose-400", PATCH: "bg-violet-500/10 text-violet-600 dark:text-violet-400" };
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0">
      <span className={cn("flex-shrink-0 text-[11px] font-black px-2 py-0.5 rounded-md w-16 text-center", colors[method] ?? "bg-muted text-muted-foreground")}>{method}</span>
      <code className="text-[13px] font-mono text-foreground/80 flex-1">{path}</code>
      <span className="text-[13px] text-muted-foreground text-right hidden sm:block">{desc}</span>
    </div>
  );
}

// ─── Doc sections content ─────────────────────────────────────────────────────

const CONTENT: Record<string, React.ReactNode> = {
  "what-is": (
    <div>
      <H1>What is AI Collective?</H1>
      <P>
        <strong>AI Collective</strong> is an open-source multi-agent orchestration platform that lets you build teams of
        specialized AI agents which collaborate autonomously to complete complex tasks — just like a real project team.
      </P>
      <P>
        Instead of using a single monolithic AI, AI Collective distributes work across purpose-built agents: a
        Project Manager agent that plans, a Research agent that gathers information, a Developer agent that writes
        code, and a Reviewer agent that validates every output before delivery.
      </P>
      <Callout type="tip">
        AI Collective is self-hosted and fully open source (MIT License). You can run it locally in minutes or
        deploy it on any cloud provider.
      </Callout>
      <H2>Key Features</H2>
      <UL>
        <LI><strong>Multi-agent collaboration</strong> — agents communicate through an event-driven message bus (RabbitMQ)</LI>
        <LI><strong>Customizable roles</strong> — 40+ built-in role templates from PM to Doctor to Lawyer, or define your own</LI>
        <LI><strong>Skill system</strong> — attach integrations (Google Sheets, APIs, web browsing) to individual agents</LI>
        <LI><strong>Team modes</strong> — choose between <InlineCode>mesh</InlineCode> (all agents collaborate) or <InlineCode>sequential</InlineCode> (pipeline) execution</LI>
        <LI><strong>Real-time task graph</strong> — visualize agent activity with pan & zoom graph view</LI>
        <LI><strong>LangChain / LangGraph backend</strong> — powered by battle-tested AI orchestration primitives</LI>
        <LI><strong>React + FastAPI stack</strong> — modern, maintainable codebase with TypeScript and Python</LI>
      </UL>
      <H2>Who is it for?</H2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-5">
        {[
          { title: "Developers", desc: "Build AI-powered workflows without managing complex agent infrastructure." },
          { title: "Teams", desc: "Automate research, writing, coding, and review pipelines with AI specialists." },
          { title: "Researchers", desc: "Experiment with multi-agent architectures and collaboration strategies." },
        ].map((c) => (
          <div key={c.title} className="p-4 rounded-xl border border-border/70 bg-muted/30">
            <div className="font-bold text-sm mb-1">{c.title}</div>
            <div className="text-xs text-muted-foreground leading-relaxed">{c.desc}</div>
          </div>
        ))}
      </div>
    </div>
  ),

  "architecture": (
    <div>
      <H1>Architecture</H1>
      <P>AI Collective is split into two layers: a <strong>FastAPI backend</strong> that runs the AI agents, and a <strong>React frontend</strong> that provides the visual management interface.</P>
      <CodeBlock lang="text" title="System Overview" code={`┌─────────────────────────────────────────────────┐
│                  React Frontend                  │
│         (Vite + TypeScript + shadcn/ui)          │
│                                                  │
│  Landing  Dashboard  Agents  Teams  Tasks  Docs  │
└───────────────────────┬─────────────────────────┘
                        │ REST API / WebSocket
┌───────────────────────▼─────────────────────────┐
│              FastAPI Backend                     │
│                                                  │
│  Agent Manager ─── LangGraph Orchestrator        │
│       │                     │                    │
│  Skill Registry        Task Runner               │
│       │                     │                    │
│  Tool Executor     RabbitMQ Event Bus            │
└───────────────────────┬─────────────────────────┘
                        │
          ┌─────────────▼──────────────┐
          │    LLM Providers           │
          │  Anthropic · OpenAI · etc  │
          └────────────────────────────┘`} />
      <H2>Request Lifecycle</H2>
      <P>When you submit a task, this is what happens:</P>
      <UL>
        <LI>Frontend sends a <InlineCode>POST /api/tasks</InlineCode> request with the task description and assigned team</LI>
        <LI>The <strong>Task Runner</strong> spins up a LangGraph graph with each agent as a node</LI>
        <LI>Agents receive messages, process them via the LLM provider, and emit events to RabbitMQ</LI>
        <LI>The <strong>Event Bus</strong> routes agent outputs to dependent agents (e.g., PM → Developer)</LI>
        <LI>Each agent's tool calls (web search, code execution, API calls) are handled by the Skill Executor</LI>
        <LI>Final output is collected by the Reviewer agent and returned to the frontend via REST</LI>
      </UL>
    </div>
  ),

  "key-concepts": (
    <div>
      <H1>Key Concepts</H1>
      <P>Before diving in, here are the five primitives that make up every AI Collective deployment:</P>
      <div className="space-y-4 my-5">
        {[
          { icon: Cpu, color: "text-sky-500 bg-sky-500/10", title: "Agent", desc: "An AI worker with a defined role, personality, and set of skills. Each agent has its own system prompt and tool access." },
          { icon: Wrench, color: "text-amber-500 bg-amber-500/10", title: "Skill", desc: "A capability you attach to an agent — a web search tool, a Google Sheets integration, a custom JavaScript function, or a REST API call." },
          { icon: Users, color: "text-violet-500 bg-violet-500/10", title: "Team", desc: "A named group of agents that collaborate on tasks. Teams can run in mesh mode (all-to-all) or sequential mode (pipeline)." },
          { icon: CheckCircle2, color: "text-emerald-500 bg-emerald-500/10", title: "Task", desc: "A unit of work assigned to a team. Tasks have a lifecycle: pending → in-progress → completed (or paused / stopped)." },
          { icon: MessageSquare, color: "text-cyan-500 bg-cyan-500/10", title: "Conversation", desc: "The full message history of every agent interaction during a task. Browse and replay any agent conversation." },
        ].map(({ icon: Icon, color, title, desc }) => (
          <div key={title} className="flex items-start gap-4 p-4 rounded-xl border border-border/60 bg-muted/20">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", color)}>
              <Icon className="w-4.5 h-4.5" strokeWidth={2} />
            </div>
            <div>
              <div className="font-bold text-sm mb-1">{title}</div>
              <div className="text-[13px] text-muted-foreground leading-relaxed">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  ),

  "quickstart": (
    <div>
      <H1>Quick Start</H1>
      <P>Get AI Collective running locally in under 5 minutes.</P>
      <Callout type="info">
        Prerequisites: <strong>Python 3.11+</strong>, <strong>Node.js 18+</strong>, and an <strong>Anthropic or OpenAI API key</strong>.
      </Callout>
      <H2>1. Clone the repository</H2>
      <CodeBlock lang="bash" code={`git clone https://github.com/SuZeAI/ai-collective.git
cd ai-collective`} />
      <H2>2. Set up the backend</H2>
      <CodeBlock lang="bash" code={`# Create a virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate

# Install Python dependencies
pip install -e .`} />
      <H2>3. Configure environment</H2>
      <CodeBlock lang="bash" code={`cp .env.example .env
# Edit .env and add your API keys`} />
      <CodeBlock lang="bash" title=".env" code={`ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...          # optional
RABBITMQ_URL=amqp://localhost  # optional, used for multi-agent events`} />
      <H2>4. Start the backend</H2>
      <CodeBlock lang="bash" code={`uvicorn backend.main:app --reload --port 8000`} />
      <H2>5. Start the frontend</H2>
      <CodeBlock lang="bash" code={`npm install
npm run dev
# Open http://localhost:8080`} />
      <Callout type="tip">
        The frontend development server proxies API requests to <InlineCode>localhost:8000</InlineCode> automatically. No CORS configuration needed.
      </Callout>
    </div>
  ),

  "installation": (
    <div>
      <H1>Installation</H1>
      <H2>System Requirements</H2>
      <div className="overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-6 font-semibold text-foreground/80">Component</th>
              <th className="text-left py-2 pr-6 font-semibold text-foreground/80">Minimum</th>
              <th className="text-left py-2 font-semibold text-foreground/80">Recommended</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground divide-y divide-border/40">
            {[["Python", "3.11", "3.12+"], ["Node.js", "18.x", "20.x LTS"], ["RAM", "2 GB", "4 GB+"], ["Disk", "500 MB", "2 GB+"]].map(([c, m, r]) => (
              <tr key={c}>
                <td className="py-2 pr-6 font-mono text-foreground/70">{c}</td>
                <td className="py-2 pr-6">{m}</td>
                <td className="py-2">{r}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <H2>Python dependencies</H2>
      <P>The backend is managed with <InlineCode>pyproject.toml</InlineCode>. Key dependencies:</P>
      <CodeBlock lang="toml" title="pyproject.toml (excerpt)" code={`[project]
dependencies = [
  "fastapi>=0.115",
  "uvicorn[standard]",
  "langchain",
  "langchain-anthropic",
  "langchain-openai",
  "langgraph",
  "pydantic>=2",
  "browser-use>=0.12",
  "playwright",
]`} />
      <H2>Frontend dependencies</H2>
      <P>The frontend uses React 18, Vite, shadcn/ui, and Tailwind CSS.</P>
      <CodeBlock lang="bash" code={`npm install   # or: pnpm install / yarn install`} />
      <H2>Optional: RabbitMQ</H2>
      <P>For multi-agent event broadcasting, you can run RabbitMQ locally via Docker:</P>
      <CodeBlock lang="bash" code={`docker run -d --name rabbitmq \\
  -p 5672:5672 -p 15672:15672 \\
  rabbitmq:3-management`} />
    </div>
  ),

  "configuration": (
    <div>
      <H1>Configuration</H1>
      <P>All configuration is done through environment variables in a <InlineCode>.env</InlineCode> file at the project root.</P>
      <H2>API Keys</H2>
      <CodeBlock lang="bash" title=".env" code={`# LLM Providers (at least one required)
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-proj-...

# Default model to use
DEFAULT_LLM=anthropic          # or: openai

# Message Bus (optional)
RABBITMQ_URL=amqp://guest:guest@localhost:5672/`} />
      <H2>Frontend configuration</H2>
      <P>The Vite dev server runs on port <InlineCode>8080</InlineCode> and expects the backend at <InlineCode>localhost:8000</InlineCode>. To change these:</P>
      <CodeBlock lang="ts" title="vite.config.ts" code={`export default defineConfig({
  server: {
    port: 8080,          // change frontend port
    proxy: {
      "/api": "http://localhost:8000",   // backend URL
    },
  },
})`} />
    </div>
  ),

  "agents": (
    <div>
      <H1>Agents</H1>
      <P>
        An <strong>agent</strong> is an AI worker with a defined role, a personality expressed through its system prompt,
        and a set of skills (tools) it can use to complete work.
      </P>
      <H2>Agent schema</H2>
      <CodeBlock lang="typescript" title="types/Agent" code={`type Agent = {
  id: string;
  name: string;               // Display name, e.g. "Alice"
  role: string;               // Role label, e.g. "Research Agent"
  description: string;        // What this agent specializes in
  system_prompt?: string;     // Custom LLM system prompt (optional)
  skill_ids: string[];        // IDs of attached skills
  skills: Skill[];            // Resolved skill objects
  status: "active" | "idle" | "thinking" | string;
  avatar: string;             // Initial letter fallback
  avatar_icon?: string;       // Lucide icon key
  avatar_color?: string;      // Hex color for avatar background
  avatar_url?: string;        // Custom image URL
}`} />
      <H2>Agent roles</H2>
      <P>AI Collective ships with 40+ built-in role templates. Here are the most common ones:</P>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 my-4">
        {["Project Manager", "Research Agent", "Developer Agent", "Marketing Agent", "Reviewer Agent", "Support Agent", "Data Analyst Agent", "QA Agent", "UI/UX Designer Agent", "Content Creator Agent", "Legal Advisor Agent", "Sales Agent"].map((r) => (
          <div key={r} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/50 text-xs font-medium text-foreground/70">
            <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
            {r}
          </div>
        ))}
      </div>
      <Callout type="tip">
        You can type any custom role name — the built-in list is just a starting suggestion.
      </Callout>
      <H2>Agent status lifecycle</H2>
      <CodeBlock lang="text" code={`idle ──▶ thinking ──▶ active ──▶ idle
                            │
                            └──▶ error`} />
      <H2>Create via REST API</H2>
      <CodeBlock lang="bash" code={`curl -X POST http://localhost:8000/api/agents \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Alice",
    "role": "Research Agent",
    "description": "Expert at web research and summarization",
    "skill_ids": [],
    "status": "idle",
    "avatar": "A"
  }'`} />
    </div>
  ),

  "skills": (
    <div>
      <H1>Skills</H1>
      <P>
        A <strong>skill</strong> is a capability you attach to an agent — it can be a third-party API integration,
        a browser automation tool, a custom JavaScript function, or any other action the agent can invoke.
      </P>
      <H2>Skill types</H2>
      <div className="space-y-3 my-4">
        {[
          { type: "integration", color: "green" as const, desc: "Connect to external services: Google Sheets, Slack, Notion, Airtable, REST APIs, and more." },
          { type: "custom-js", color: "orange" as const, desc: "Write custom JavaScript code that runs server-side. Great for data transformation or business logic." },
        ].map(({ type, color, desc }) => (
          <div key={type} className="flex items-start gap-3 p-4 rounded-xl border border-border/60 bg-muted/20">
            <Pill color={color}>{type}</Pill>
            <p className="text-[13px] text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
      <H2>Available built-in tools</H2>
      <CodeBlock lang="text" code={`Web & Search:    web_search · web_scrape · browser_use
Google Suite:    sheet · drive · docs · slides · calendar
Productivity:    slack · notion · airtable
Data:            sql · database
Dev:             code_exec · terminal · github
Communication:   email · webhook`} />
      <H2>Skill schema</H2>
      <CodeBlock lang="typescript" code={`type Skill = {
  id: string;
  name: string;
  description: string;
  kind: "integration" | "custom-js";
  tool_name?: string;          // built-in tool key (e.g. "web_search")
  third_party?: string;        // e.g. "Google Sheets"
  config: Record<string, unknown>; // tool-specific configuration
  code?: string;               // custom-js source code
}`} />
    </div>
  ),

  "teams": (
    <div>
      <H1>Teams</H1>
      <P>A <strong>team</strong> is a named group of agents that collaborate on tasks. Teams are the unit of execution — you assign tasks to a team, not to individual agents.</P>
      <H2>Team modes</H2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-5">
        <div className="p-5 rounded-xl border-2 border-primary/20 bg-primary/5">
          <div className="font-bold mb-2 flex items-center gap-2"><Pill color="blue">mesh</Pill> Mesh mode</div>
          <p className="text-[13px] text-muted-foreground leading-relaxed">All agents can communicate with each other. Best for creative or research tasks where agents need to debate and refine ideas together.</p>
        </div>
        <div className="p-5 rounded-xl border-2 border-violet-200 bg-violet-500/5">
          <div className="font-bold mb-2 flex items-center gap-2"><Pill color="purple">sequential</Pill> Sequential mode</div>
          <p className="text-[13px] text-muted-foreground leading-relaxed">Agents run in a defined pipeline order. Best for structured workflows: Research → Write → Review → Publish.</p>
        </div>
      </div>
      <H2>Team schema</H2>
      <CodeBlock lang="typescript" code={`type Team = {
  id: string;
  name: string;
  description: string;
  agents: string[];           // ordered list of agent IDs
  mode: "mesh" | "sequential";
  activeTasks: number;
}`} />
    </div>
  ),

  "tasks": (
    <div>
      <H1>Tasks</H1>
      <P>A <strong>task</strong> is a unit of work you submit to a team. It has a title, description, and a lifecycle that progresses from pending to completed.</P>
      <H2>Task lifecycle</H2>
      <CodeBlock lang="text" code={`pending ──▶ in-progress ──▶ completed
                 │
                 ├──▶ paused ──▶ in-progress
                 └──▶ stopped`} />
      <H2>Task schema</H2>
      <CodeBlock lang="typescript" code={`type Task = {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "paused" | "stopped" | "completed";
  progress: number;           // 0–100
  team_id?: string;
  agent_ids?: string[];
  created_at?: string;
  updated_at?: string;
  result?: string;            // final output from the team
}`} />
      <H2>Task graph visualization</H2>
      <P>The Task Manager page shows a real-time SVG graph of agent interactions. Each node is an agent, and edges show message flow between them. You can pan and zoom to explore large agent networks.</P>
      <Callout type="info">
        The graph uses a force-directed layout powered by a custom SVG renderer — no third-party graph library required.
      </Callout>
    </div>
  ),

  "conversations": (
    <div>
      <H1>Conversations</H1>
      <P>Every message exchanged between agents during a task is recorded as a <strong>conversation</strong>. The Conversations page lets you browse, filter, and replay all agent communications.</P>
      <H2>Message format</H2>
      <CodeBlock lang="typescript" code={`type Message = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  agent_id?: string;
  task_id?: string;
  timestamp: string;
}`} />
      <H2>Filtering</H2>
      <P>Filter conversations by agent name, role, task, or date range. Messages support full-text search and are rendered with Markdown formatting.</P>
    </div>
  ),

  "guide-first-agent": (
    <div>
      <H1>Create Your First Agent</H1>
      <P>This guide walks you through creating a Research Agent from scratch using the UI.</P>
      <H2>Step 1: Open Agent Builder</H2>
      <P>Navigate to <strong>Agents</strong> in the sidebar, then click <strong>New Agent</strong> in the top right.</P>
      <H2>Step 2: Fill in the details</H2>
      <CodeBlock lang="text" code={`Name:        Alice
Role:        Research Agent
Description: Expert at web research, data extraction, and summarization.`} />
      <H2>Step 3: Choose an avatar</H2>
      <P>Select <InlineCode>icon</InlineCode> mode and pick the <InlineCode>search</InlineCode> icon. Choose a teal background color to match the Research Agent role.</P>
      <H2>Step 4: Assign skills</H2>
      <P>Check <strong>Web Search</strong> and <strong>Web Scrape</strong> skills from the skill panel. If you don't have skills yet, go to the Skills page first.</P>
      <H2>Step 5: Save</H2>
      <P>Click <strong>Create Agent</strong>. Alice will now appear in your agent roster with an <InlineCode>idle</InlineCode> status.</P>
      <Callout type="tip">
        Test Alice immediately by clicking the <strong>Test</strong> button on her card and entering a research question.
      </Callout>
    </div>
  ),

  "guide-build-team": (
    <div>
      <H1>Build a Team</H1>
      <P>Teams combine multiple agents into a collaborative unit. Let's build a research & writing team.</P>
      <H2>Recommended team composition</H2>
      <div className="space-y-2 my-4">
        {[
          { role: "Project Manager", purpose: "Coordinates task breakdown and delegates to other agents" },
          { role: "Research Agent", purpose: "Gathers information from the web and synthesizes findings" },
          { role: "Developer Agent", purpose: "Writes code or technical documentation" },
          { role: "Reviewer Agent", purpose: "Validates all outputs before delivery" },
        ].map(({ role, purpose }) => (
          <div key={role} className="flex items-start gap-3 px-4 py-3 rounded-lg border border-border/50 bg-muted/20">
            <span className="text-sm font-bold text-foreground/80 w-40 flex-shrink-0">{role}</span>
            <span className="text-sm text-muted-foreground">{purpose}</span>
          </div>
        ))}
      </div>
      <H2>Create the team</H2>
      <P>Go to <strong>Teams → New Team</strong>, add all four agents in order, select <InlineCode>mesh</InlineCode> mode for collaborative tasks, then save.</P>
    </div>
  ),

  "guide-run-task": (
    <div>
      <H1>Run a Task</H1>
      <P>With a team built, submit your first task.</P>
      <H2>Via the UI</H2>
      <P>Navigate to <strong>Tasks → New Task</strong>, fill in a title and description, assign your team, and click <strong>Create Task</strong>. The task will move to <InlineCode>in-progress</InlineCode> status and you can watch the agent graph animate in real time.</P>
      <H2>Via REST API</H2>
      <CodeBlock lang="bash" code={`curl -X POST http://localhost:8000/api/tasks \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Market research: AI productivity tools",
    "description": "Research the top 10 AI productivity tools, compare their pricing, and write a 500-word summary with recommendations.",
    "team_id": "team_abc123"
  }'`} />
      <H2>Monitor progress</H2>
      <P>Poll the task status endpoint, or watch the live graph in the Tasks UI:</P>
      <CodeBlock lang="bash" code={`curl http://localhost:8000/api/tasks/{task_id}`} />
    </div>
  ),

  "guide-skills": (
    <div>
      <H1>Add Skills & APIs</H1>
      <P>Skills extend what agents can do. Here's how to add a web search skill.</P>
      <H2>Create a web search skill</H2>
      <P>Navigate to <strong>Skills → New Skill</strong>:</P>
      <CodeBlock lang="text" code={`Name:        Web Search
Kind:        integration
Tool:        web_search
Description: Search the web for up-to-date information`} />
      <H2>Create a Google Sheets integration</H2>
      <CodeBlock lang="text" code={`Name:        Google Sheets Writer
Kind:        integration
Tool:        sheet
Third-party: Google Sheets
Config:
  auth_email:           your@gmail.com
  token_path:           ./tokens/sheets_token.json
  credentials_path:     ./credentials.json`} />
      <Callout type="warning">
        Google OAuth requires setting up a project in Google Cloud Console and downloading <InlineCode>credentials.json</InlineCode>. See the Google integration guide for details.
      </Callout>
      <H2>Custom JavaScript skill</H2>
      <CodeBlock lang="javascript" title="custom skill example" code={`// Transform JSON data before passing to an agent
function run(input) {
  const data = JSON.parse(input);
  return data
    .filter(item => item.score > 0.8)
    .map(item => \`\${item.name}: \${item.score}\`)
    .join("\\n");
}`} />
    </div>
  ),

  "api-agents": (
    <div>
      <H1>Agents API</H1>
      <P>Base URL: <InlineCode>http://localhost:8000/api</InlineCode></P>
      <H2>Endpoints</H2>
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="GET"    path="/agents"         desc="List all agents" />
        <ApiRow method="POST"   path="/agents"         desc="Create an agent" />
        <ApiRow method="GET"    path="/agents/:id"     desc="Get agent by ID" />
        <ApiRow method="PUT"    path="/agents/:id"     desc="Update agent" />
        <ApiRow method="DELETE" path="/agents/:id"     desc="Delete agent" />
      </div>
      <H2>Create agent</H2>
      <CodeBlock lang="json" title="POST /api/agents — Request body" code={`{
  "name": "Alice",
  "role": "Research Agent",
  "description": "Web research specialist",
  "skill_ids": ["skill_123", "skill_456"],
  "status": "idle",
  "avatar": "A",
  "avatar_icon": "search",
  "avatar_color": "#0d9488"
}`} />
      <CodeBlock lang="json" title="Response" code={`{
  "id": "agent_abc123",
  "name": "Alice",
  "role": "Research Agent",
  "status": "idle",
  "skill_ids": ["skill_123", "skill_456"],
  "skills": [{ "id": "skill_123", "name": "Web Search", ... }],
  "created_at": "2026-04-18T10:00:00Z"
}`} />
    </div>
  ),

  "api-skills": (
    <div>
      <H1>Skills API</H1>
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="GET"    path="/skills"         desc="List all skills" />
        <ApiRow method="POST"   path="/skills"         desc="Create a skill" />
        <ApiRow method="GET"    path="/skills/:id"     desc="Get skill by ID" />
        <ApiRow method="PUT"    path="/skills/:id"     desc="Update skill" />
        <ApiRow method="DELETE" path="/skills/:id"     desc="Delete skill" />
        <ApiRow method="GET"    path="/skills/tools"   desc="List available tool presets" />
      </div>
      <H2>Get tool presets</H2>
      <CodeBlock lang="bash" code={`curl http://localhost:8000/api/skills/tools`} />
      <CodeBlock lang="json" title="Response" code={`[
  { "tool_name": "web_search",  "label": "Web Search",     "third_party": "Search" },
  { "tool_name": "sheet",       "label": "Google Sheets",  "third_party": "Google" },
  { "tool_name": "browser_use", "label": "Browser Agent",  "third_party": "Browser" }
]`} />
    </div>
  ),

  "api-teams": (
    <div>
      <H1>Teams API</H1>
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="GET"    path="/teams"      desc="List all teams" />
        <ApiRow method="POST"   path="/teams"      desc="Create a team" />
        <ApiRow method="GET"    path="/teams/:id"  desc="Get team by ID" />
        <ApiRow method="PUT"    path="/teams/:id"  desc="Update team" />
        <ApiRow method="DELETE" path="/teams/:id"  desc="Delete team" />
      </div>
      <CodeBlock lang="json" title="POST /api/teams — Request body" code={`{
  "name": "Research & Write",
  "description": "Research, draft, and review pipeline",
  "agents": ["agent_pm", "agent_research", "agent_writer", "agent_reviewer"],
  "mode": "sequential"
}`} />
    </div>
  ),

  "api-tasks": (
    <div>
      <H1>Tasks API</H1>
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="GET"    path="/tasks"             desc="List all tasks" />
        <ApiRow method="POST"   path="/tasks"             desc="Create & start a task" />
        <ApiRow method="GET"    path="/tasks/:id"         desc="Get task status" />
        <ApiRow method="PATCH"  path="/tasks/:id/pause"   desc="Pause running task" />
        <ApiRow method="PATCH"  path="/tasks/:id/resume"  desc="Resume paused task" />
        <ApiRow method="PATCH"  path="/tasks/:id/stop"    desc="Stop task" />
        <ApiRow method="DELETE" path="/tasks/:id"         desc="Delete task" />
        <ApiRow method="GET"    path="/tasks/:id/graph"   desc="Get agent interaction graph" />
      </div>
    </div>
  ),

  "api-chat": (
    <div>
      <H1>Chat API</H1>
      <P>Test individual agents directly without creating a full task.</P>
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="POST" path="/chat" desc="Send prompt to a specific agent" />
      </div>
      <CodeBlock lang="json" title="POST /api/chat — Request" code={`{
  "prompt": "What are the top 3 Python web frameworks in 2026?",
  "agentId": "agent_abc123"
}`} />
      <CodeBlock lang="json" title="Response" code={`{
  "response": "The top 3 Python web frameworks in 2026 are:\\n1. FastAPI...",
  "agent_id": "agent_abc123",
  "tokens_used": 412
}`} />
    </div>
  ),

  "deploy-docker": (
    <div>
      <H1>Docker Deployment</H1>
      <P>Deploy the entire stack with Docker Compose.</P>
      <CodeBlock lang="yaml" title="docker-compose.yml" code={`version: "3.9"
services:
  backend:
    build: .
    ports: ["8000:8000"]
    environment:
      - ANTHROPIC_API_KEY=\${ANTHROPIC_API_KEY}
      - RABBITMQ_URL=amqp://rabbitmq:5672
    depends_on: [rabbitmq]

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports: ["80:80"]
    depends_on: [backend]

  rabbitmq:
    image: rabbitmq:3-management
    ports: ["5672:5672", "15672:15672"]`} />
      <CodeBlock lang="bash" code={`# Build and start all services
docker compose up -d

# View logs
docker compose logs -f backend`} />
    </div>
  ),

  "deploy-env": (
    <div>
      <H1>Environment Variables</H1>
      <div className="overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-4 font-semibold text-foreground/80">Variable</th>
              <th className="text-left py-2 pr-4 font-semibold text-foreground/80">Required</th>
              <th className="text-left py-2 font-semibold text-foreground/80">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 text-[13px]">
            {[
              ["ANTHROPIC_API_KEY", "Yes*", "Anthropic Claude API key"],
              ["OPENAI_API_KEY", "Yes*", "OpenAI API key (*one of these required)"],
              ["DEFAULT_LLM", "No", "Default provider: anthropic or openai"],
              ["RABBITMQ_URL", "No", "RabbitMQ connection string"],
              ["HOST", "No", "Backend host (default: 0.0.0.0)"],
              ["PORT", "No", "Backend port (default: 8000)"],
            ].map(([v, r, d]) => (
              <tr key={v}>
                <td className="py-2 pr-4 font-mono text-primary/80">{v}</td>
                <td className="py-2 pr-4 text-muted-foreground">{r}</td>
                <td className="py-2 text-muted-foreground">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ),

  "contributing-guide": (
    <div>
      <H1>How to Contribute</H1>
      <P>AI Collective welcomes contributions of all kinds: bug fixes, new features, documentation improvements, and more.</P>
      <H2>Ways to contribute</H2>
      <UL>
        <LI>⭐ <strong>Star the repo</strong> on GitHub to help others discover the project</LI>
        <LI>🐛 <strong>Report bugs</strong> by opening a GitHub issue with a reproduction case</LI>
        <LI>💡 <strong>Request features</strong> by opening a discussion in the GitHub Discussions tab</LI>
        <LI>🔧 <strong>Fix bugs</strong> by submitting a pull request</LI>
        <LI>📝 <strong>Improve docs</strong> — even fixing typos is valuable!</LI>
      </UL>
      <H2>Pull request process</H2>
      <CodeBlock lang="bash" code={`# 1. Fork the repo on GitHub

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/ai-collective.git
cd ai-collective

# 3. Create a feature branch
git checkout -b feat/my-feature

# 4. Make changes, then run pre-commit checks
pre-commit run --all-files

# 5. Commit and push
git commit -m "feat: add my feature"
git push origin feat/my-feature

# 6. Open a Pull Request on GitHub`} />
      <Callout type="info">
        All PRs run through CI: backend linting (ruff), frontend type-checking (tsc), and tests (vitest).
        Make sure all checks pass before requesting review.
      </Callout>
    </div>
  ),

  "contributing-dev": (
    <div>
      <H1>Development Setup</H1>
      <H2>Pre-commit hooks</H2>
      <CodeBlock lang="bash" code={`pip install pre-commit
pre-commit install`} />
      <P>This installs hooks for: Python formatting (ruff), trailing whitespace, end-of-file newlines, and YAML/TOML validation.</P>
      <H2>Run tests</H2>
      <CodeBlock lang="bash" code={`# Frontend unit tests
npm run test

# Frontend E2E tests
npm run test:e2e

# Backend tests (if present)
pytest`} />
      <H2>Code style</H2>
      <UL>
        <LI>Python: <strong>ruff</strong> for linting and formatting</LI>
        <LI>TypeScript: <strong>ESLint</strong> + <strong>TypeScript strict mode</strong></LI>
        <LI>Commits: conventional commits format (<InlineCode>feat:</InlineCode>, <InlineCode>fix:</InlineCode>, <InlineCode>docs:</InlineCode>)</LI>
      </UL>
    </div>
  ),
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({
  activeId, onSelect, searchQuery, onSearch, mobile, onClose,
}: {
  activeId: string;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearch: (q: string) => void;
  mobile?: boolean;
  onClose?: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const active = NAV.find((s) => s.items.some((i) => i.id === activeId));
    return new Set(active ? [active.id] : [NAV[0].id]);
  });

  const filtered = searchQuery.trim()
    ? ALL_ITEMS.filter((i) => i.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  const toggle = (id: string) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className={cn("flex flex-col h-full", mobile && "pt-2")}>
      {/* Search */}
      <div className="px-3 pb-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search docs..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border/60 bg-background/60 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          />
        </div>
      </div>

      {/* Nav tree */}
      <div className="flex-1 overflow-y-auto px-2 pb-6 scrollbar-thin">
        {filtered ? (
          <div className="space-y-0.5">
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-4 text-center">No results found</p>
            )}
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => { onSelect(item.id); onClose?.(); }}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                  activeId === item.id
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <div className="font-medium">{item.title}</div>
                <div className="text-[11px] text-muted-foreground/60 mt-0.5">{item.section}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {NAV.map((section) => {
              const isExpanded = expanded.has(section.id);
              const hasActive = section.items.some((i) => i.id === activeId);
              const Icon = section.icon;
              return (
                <div key={section.id}>
                  <button
                    onClick={() => toggle(section.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors",
                      hasActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="flex-1 text-left">{section.title}</span>
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <div className="pl-3 ml-1 border-l border-border/50 space-y-0.5 mb-1">
                          {section.items.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => { onSelect(item.id); onClose?.(); }}
                              className={cn(
                                "w-full text-left px-3 py-1.5 rounded-lg text-sm transition-all duration-150",
                                activeId === item.id
                                  ? "bg-primary/10 text-primary font-semibold"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                              )}
                            >
                              {item.title}
                              {item.badge && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">{item.badge}</span>}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Docs component ──────────────────────────────────────────────────────

export default function Docs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const activeId = searchParams.get("page") ?? "what-is";

  const setPage = useCallback((id: string) => {
    setSearchParams({ page: id });
    setSearch("");
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [setSearchParams]);

  // Flat nav for prev/next
  const flatItems = ALL_ITEMS;
  const currentIdx = flatItems.findIndex((i) => i.id === activeId);
  const prev = currentIdx > 0 ? flatItems[currentIdx - 1] : null;
  const next = currentIdx < flatItems.length - 1 ? flatItems[currentIdx + 1] : null;

  const content = CONTENT[activeId] ?? (
    <div className="py-20 text-center text-muted-foreground">
      <p className="text-lg font-semibold mb-2">Page not found</p>
      <p className="text-sm">This section is coming soon.</p>
    </div>
  );

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col">
      {/* Top navbar */}
      <nav className="h-14 flex-shrink-0 flex items-center border-b border-border/60 bg-background/90 backdrop-blur-xl z-50 shadow-sm">
        <div className="w-full flex items-center px-4 gap-3">
          {/* Mobile sidebar toggle */}
          <button
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Brand */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0 group">
            <img src="/spider.png" alt="" className="h-7 w-7 object-contain" />
            <span className="font-bold text-sm text-foreground/80 group-hover:text-foreground transition-colors hidden sm:block">AI Collective</span>
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 hidden sm:block" />
          <span className="text-sm font-semibold text-foreground hidden sm:block">Docs</span>

          <div className="flex-1" />

          {/* Links */}
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Back to site</span>
              </Button>
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border/60 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <ThemeToggle />
            <Link to="/dashboard">
              <Button size="sm" className="h-8 text-xs shadow-sm shadow-primary/15">
                Open App
                <ArrowUpRight className="ml-1.5 w-3 h-3" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar — fixed, scrolls independently */}
        <aside className="hidden lg:flex flex-col w-64 xl:w-72 flex-shrink-0 border-r border-border/60 bg-background/60 overflow-y-auto scrollbar-thin">
          <div className="pt-4">
            <Sidebar activeId={activeId} onSelect={setPage} searchQuery={search} onSearch={setSearch} />
          </div>
        </aside>

        {/* Mobile sidebar drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm lg:hidden"
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 24, stiffness: 280 }}
                className="fixed left-0 top-0 bottom-0 z-50 w-72 bg-background border-r border-border/60 lg:hidden flex flex-col shadow-2xl"
              >
                <div className="flex items-center justify-between px-4 h-14 border-b border-border/60 flex-shrink-0">
                  <span className="font-bold text-sm">Documentation</span>
                  <button onClick={() => setMobileOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <Sidebar activeId={activeId} onSelect={setPage} searchQuery={search} onSearch={setSearch} mobile onClose={() => setMobileOpen(false)} />
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main content */}
        <main ref={contentRef} className="flex-1 min-w-0 overflow-y-auto scrollbar-thin">
          <motion.div
            key={activeId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="max-w-3xl mx-auto px-6 md:px-10 py-10"
          >
            {content}

            {/* Prev / Next */}
            <div className="mt-16 pt-8 border-t border-border/60 grid grid-cols-2 gap-4">
              {prev ? (
                <button
                  onClick={() => setPage(prev.id)}
                  className="flex flex-col items-start p-4 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
                >
                  <span className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1">
                    <ArrowLeft className="w-3 h-3" /> Previous
                  </span>
                  <span className="text-sm font-semibold group-hover:text-primary transition-colors">{prev.title}</span>
                </button>
              ) : <div />}
              {next ? (
                <button
                  onClick={() => setPage(next.id)}
                  className="flex flex-col items-end p-4 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all text-right group ml-auto w-full"
                >
                  <span className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1">
                    Next <ArrowRight className="w-3 h-3" />
                  </span>
                  <span className="text-sm font-semibold group-hover:text-primary transition-colors">{next.title}</span>
                </button>
              ) : <div />}
            </div>

            {/* Footer */}
            <div className="mt-10 pt-6 border-t border-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-foreground/60">
              <span>AI Collective Docs · MIT License</span>
              <a
                href={`${GITHUB_URL}/edit/main/docs/${activeId}.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Edit this page on GitHub
              </a>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
