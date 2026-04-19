import { useState, useCallback } from "react";
import {
  ChevronRight, Cpu, Wrench, Users, CheckCircle2, MessageSquare,
  Check, Copy, Info, Lightbulb, AlertTriangle, Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Translations } from "@/locales";

// ─── Shared typography ─────────────────────────────────────────────────────────

export function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-3 mt-0">{children}</h1>;
}
export function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return <h2 id={id} className="text-xl font-bold tracking-tight text-foreground mt-10 mb-3 pt-2 border-t border-border/50 scroll-mt-20">{children}</h2>;
}
export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-foreground/75 leading-relaxed mb-4">{children}</p>;
}
export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-none space-y-1.5 mb-4 pl-0">{children}</ul>;
}
export function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[15px] text-foreground/75">
      <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
export function Pill({ children, color = "blue" }: { children: React.ReactNode; color?: "blue" | "green" | "orange" | "purple" }) {
  const c = {
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25",
    green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
    orange: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
    purple: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25",
  }[color];
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border", c)}>{children}</span>;
}
export function InlineCode({ children }: { children: React.ReactNode }) {
  return <code className="px-1.5 py-0.5 rounded-md bg-muted text-[13px] font-mono text-foreground/90 border border-border/50">{children}</code>;
}

export function CodeBlock({ code, lang = "bash", title }: { code: string; lang?: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);
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
        <button onClick={copy} className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded hover:bg-white/5">
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

export function Callout({ type = "info", children }: { type?: "info" | "tip" | "warning" | "danger"; children: React.ReactNode }) {
  const cfg = {
    info:    { icon: Info, bg: "bg-blue-500/10 border-blue-500/25", icon_cls: "text-blue-500" },
    tip:     { icon: Lightbulb, bg: "bg-emerald-500/10 border-emerald-500/25", icon_cls: "text-emerald-500" },
    warning: { icon: AlertTriangle, bg: "bg-amber-500/10 border-amber-500/25", icon_cls: "text-amber-500" },
    danger:  { icon: Flame, bg: "bg-rose-500/10 border-rose-500/25", icon_cls: "text-rose-500" },
  }[type];
  const Icon = cfg.icon;
  return (
    <div className={cn("my-5 flex gap-3 rounded-xl border p-4", cfg.bg)}>
      <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", cfg.icon_cls)} />
      <div className="text-sm leading-relaxed text-foreground/80">{children}</div>
    </div>
  );
}

export function ApiRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  const colors: Record<string, string> = {
    GET: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    POST: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    PUT: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    DELETE: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    PATCH: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  };
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0">
      <span className={cn("flex-shrink-0 text-[11px] font-black px-2 py-0.5 rounded-md w-16 text-center", colors[method] ?? "bg-muted text-muted-foreground")}>{method}</span>
      <code className="text-[13px] font-mono text-foreground/80 flex-1">{path}</code>
      <span className="text-[13px] text-muted-foreground text-right hidden sm:block">{desc}</span>
    </div>
  );
}

// ─── Content builder ───────────────────────────────────────────────────────────

const CONCEPT_ICONS = [
  { icon: Cpu, color: "text-sky-500 bg-sky-500/10" },
  { icon: Wrench, color: "text-amber-500 bg-amber-500/10" },
  { icon: Users, color: "text-violet-500 bg-violet-500/10" },
  { icon: CheckCircle2, color: "text-emerald-500 bg-emerald-500/10" },
  { icon: MessageSquare, color: "text-cyan-500 bg-cyan-500/10" },
];

export function getDocContent(t: Translations): Record<string, React.ReactNode> {
  const c = t.docs.content;

  return {
    "what-is": (
      <div>
        <H1>{c["what-is"].h1}</H1>
        <P><strong>AI Collective</strong> — {c["what-is"].p1}</P>
        <P>{c["what-is"].p2}</P>
        <Callout type="tip">{c["what-is"].callout}</Callout>
        <H2>{c["what-is"].keyFeaturesH2}</H2>
        <UL>{c["what-is"].features.map((f, i) => <LI key={i}>{f}</LI>)}</UL>
        <H2>{c["what-is"].whoForH2}</H2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-5">
          {c["what-is"].audience.map((a) => (
            <div key={a.title} className="p-4 rounded-xl border border-border/70 bg-muted/30">
              <div className="font-bold text-sm mb-1">{a.title}</div>
              <div className="text-xs text-muted-foreground leading-relaxed">{a.desc}</div>
            </div>
          ))}
        </div>
      </div>
    ),

    "architecture": (
      <div>
        <H1>{c.architecture.h1}</H1>
        <P>{c.architecture.p1}</P>
        <CodeBlock lang="text" title="System Overview" code={`┌─────────────────────────────────────────────────┐
│                  React Frontend                  │
│         (Vite + TypeScript + shadcn/ui)          │
└───────────────────────┬─────────────────────────┘
                        │ REST API / WebSocket
┌───────────────────────▼─────────────────────────┐
│              FastAPI Backend                     │
│  Agent Manager ─── LangGraph Orchestrator        │
│  Skill Registry        Task Runner               │
│  Tool Executor     RabbitMQ Event Bus            │
└───────────────────────┬─────────────────────────┘
                        │
          ┌─────────────▼──────────────┐
          │  Anthropic · OpenAI · etc  │
          └────────────────────────────┘`} />
        <H2>{c.architecture.lifecycleH2}</H2>
        <P>{c.architecture.lifecycleP}</P>
        <UL>{c.architecture.lifecycle.map((item, i) => <LI key={i}>{item}</LI>)}</UL>
      </div>
    ),

    "key-concepts": (
      <div>
        <H1>{c["key-concepts"].h1}</H1>
        <P>{c["key-concepts"].p1}</P>
        <div className="space-y-4 my-5">
          {c["key-concepts"].concepts.map(({ title, desc }, i) => {
            const { icon: Icon, color } = CONCEPT_ICONS[i];
            return (
              <div key={title} className="flex items-start gap-4 p-4 rounded-xl border border-border/60 bg-muted/20">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", color)}>
                  <Icon className="w-4 h-4" strokeWidth={2} />
                </div>
                <div>
                  <div className="font-bold text-sm mb-1">{title}</div>
                  <div className="text-[13px] text-muted-foreground leading-relaxed">{desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ),

    "quickstart": (
      <div>
        <H1>{c.quickstart.h1}</H1>
        <P>{c.quickstart.p1}</P>
        <Callout type="info">{c.quickstart.callout}</Callout>
        <H2>{c.quickstart.cloneH2}</H2>
        <CodeBlock lang="bash" code={`git clone https://github.com/SuZeAI/ai-collective.git\ncd ai-collective`} />
        <H2>{c.quickstart.backendH2}</H2>
        <CodeBlock lang="bash" code={`python -m venv .venv\nsource .venv/bin/activate\npip install -e .`} />
        <H2>{c.quickstart.envH2}</H2>
        <CodeBlock lang="bash" code={`cp .env.example .env`} />
        <CodeBlock lang="bash" title=".env" code={`ANTHROPIC_API_KEY=sk-ant-...\nOPENAI_API_KEY=sk-...`} />
        <H2>{c.quickstart.startBackendH2}</H2>
        <CodeBlock lang="bash" code={`uvicorn backend.main:app --reload --port 8000`} />
        <H2>{c.quickstart.startFrontendH2}</H2>
        <CodeBlock lang="bash" code={`npm install\nnpm run dev`} />
        <Callout type="tip">{c.quickstart.tipCallout}</Callout>
      </div>
    ),

    "installation": (
      <div>
        <H1>{c.installation.h1}</H1>
        <H2>{c.installation.requirementsH2}</H2>
        <div className="overflow-x-auto my-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                {c.installation.tableHeaders.map((h) => (
                  <th key={h} className="text-left py-2 pr-6 font-semibold text-foreground/80">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-muted-foreground divide-y divide-border/40">
              {[["Python","3.11","3.12+"],["Node.js","18.x","20.x LTS"],["RAM","2 GB","4 GB+"],["Disk","500 MB","2 GB+"]].map(([c2,m,r]) => (
                <tr key={c2}>
                  <td className="py-2 pr-6 font-mono text-foreground/70">{c2}</td>
                  <td className="py-2 pr-6">{m}</td>
                  <td className="py-2">{r}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <H2>{c.installation.pythonH2}</H2>
        <P>{c.installation.pythonP}</P>
        <CodeBlock lang="toml" title="pyproject.toml" code={`dependencies = [\n  "fastapi>=0.115",\n  "uvicorn[standard]",\n  "langchain-anthropic",\n  "langgraph",\n  "pydantic>=2",\n]`} />
        <H2>{c.installation.frontendH2}</H2>
        <P>{c.installation.frontendP}</P>
        <CodeBlock lang="bash" code={`npm install`} />
        <H2>{c.installation.rabbitH2}</H2>
        <P>{c.installation.rabbitP}</P>
        <CodeBlock lang="bash" code={`docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management`} />
      </div>
    ),

    "configuration": (
      <div>
        <H1>{c.configuration.h1}</H1>
        <P>{c.configuration.p1}</P>
        <H2>{c.configuration.apiKeysH2}</H2>
        <CodeBlock lang="bash" title=".env" code={`ANTHROPIC_API_KEY=sk-ant-api03-...\nOPENAI_API_KEY=sk-proj-...\nDEFAULT_LLM=anthropic\nRABBITMQ_URL=amqp://guest:guest@localhost:5672/`} />
        <H2>{c.configuration.frontendH2}</H2>
        <P>{c.configuration.frontendP}</P>
        <CodeBlock lang="ts" title="vite.config.ts" code={`server: {\n  port: 8080,\n  proxy: { "/api": "http://localhost:8000" },\n}`} />
      </div>
    ),

    "agents": (
      <div>
        <H1>{c.agents.h1}</H1>
        <P>{c.agents.p1}</P>
        <H2>{c.agents.schemaH2}</H2>
        <CodeBlock lang="typescript" title="types/Agent" code={`type Agent = {\n  id: string;\n  name: string;\n  role: string;\n  description: string;\n  system_prompt?: string;\n  skill_ids: string[];\n  status: "active" | "idle" | "thinking" | string;\n  avatar: string;\n}`} />
        <H2>{c.agents.rolesH2}</H2>
        <P>{c.agents.rolesP}</P>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 my-4">
          {["Project Manager","Research Agent","Developer Agent","Marketing Agent","Reviewer Agent","Support Agent","Data Analyst Agent","QA Agent","Legal Advisor Agent"].map((r) => (
            <div key={r} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/50 text-xs font-medium text-foreground/70">
              <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />{r}
            </div>
          ))}
        </div>
        <Callout type="tip">{c.agents.callout}</Callout>
        <H2>{c.agents.lifecycleH2}</H2>
        <CodeBlock lang="text" code={`idle ──▶ thinking ──▶ active ──▶ idle\n                          │\n                          └──▶ error`} />
        <H2>{c.agents.restH2}</H2>
        <CodeBlock lang="bash" code={`curl -X POST http://localhost:8000/api/agents \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"Alice","role":"Research Agent","skill_ids":[],"status":"idle","avatar":"A"}'`} />
      </div>
    ),

    "skills": (
      <div>
        <H1>{c.skills.h1}</H1>
        <P>{c.skills.p1}</P>
        <H2>{c.skills.typesH2}</H2>
        <div className="space-y-3 my-4">
          {([["integration","green"],["custom-js","orange"]] as const).map(([type, color], i) => (
            <div key={type} className="flex items-start gap-3 p-4 rounded-xl border border-border/60 bg-muted/20">
              <Pill color={color}>{type}</Pill>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{c.skills.types[i]?.desc}</p>
            </div>
          ))}
        </div>
        <H2>{c.skills.toolsH2}</H2>
        <CodeBlock lang="text" code={`Web & Search:    web_search · web_scrape · browser_use\nGoogle Suite:    sheet · drive · docs · slides\nProductivity:    slack · notion · airtable\nDev:             code_exec · terminal · github`} />
        <H2>{c.skills.schemaH2}</H2>
        <CodeBlock lang="typescript" code={`type Skill = {\n  id: string;\n  name: string;\n  description: string;\n  kind: "integration" | "custom-js";\n  tool_name?: string;\n  config: Record<string, unknown>;\n}`} />
      </div>
    ),

    "teams": (
      <div>
        <H1>{c.teams.h1}</H1>
        <P>{c.teams.p1}</P>
        <H2>{c.teams.modesH2}</H2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-5">
          <div className="p-5 rounded-xl border-2 border-primary/20 bg-primary/5">
            <div className="font-bold mb-2 flex items-center gap-2"><Pill color="blue">mesh</Pill> {c.teams.mesh.title}</div>
            <p className="text-[13px] text-muted-foreground leading-relaxed">{c.teams.mesh.desc}</p>
          </div>
          <div className="p-5 rounded-xl border-2 border-violet-200 bg-violet-500/5">
            <div className="font-bold mb-2 flex items-center gap-2"><Pill color="purple">sequential</Pill> {c.teams.sequential.title}</div>
            <p className="text-[13px] text-muted-foreground leading-relaxed">{c.teams.sequential.desc}</p>
          </div>
        </div>
        <H2>{c.teams.schemaH2}</H2>
        <CodeBlock lang="typescript" code={`type Team = {\n  id: string;\n  name: string;\n  description: string;\n  agents: string[];\n  mode: "mesh" | "sequential";\n  activeTasks: number;\n}`} />
      </div>
    ),

    "tasks": (
      <div>
        <H1>{c.tasks.h1}</H1>
        <P>{c.tasks.p1}</P>
        <H2>{c.tasks.lifecycleH2}</H2>
        <CodeBlock lang="text" code={`pending ──▶ in-progress ──▶ completed\n                 │\n                 ├──▶ paused ──▶ in-progress\n                 └──▶ stopped`} />
        <H2>{c.tasks.schemaH2}</H2>
        <CodeBlock lang="typescript" code={`type Task = {\n  id: string;\n  title: string;\n  description: string;\n  status: "pending" | "in-progress" | "paused" | "stopped" | "completed";\n  progress: number;\n  team_id?: string;\n  result?: string;\n}`} />
        <H2>{c.tasks.graphH2}</H2>
        <P>{c.tasks.graphP}</P>
        <Callout type="info">{c.tasks.graphCallout}</Callout>
      </div>
    ),

    "conversations": (
      <div>
        <H1>{c.conversations.h1}</H1>
        <P>{c.conversations.p1}</P>
        <H2>{c.conversations.formatH2}</H2>
        <CodeBlock lang="typescript" code={`type Message = {\n  id: string;\n  role: "user" | "assistant" | "system" | "tool";\n  content: string;\n  agent_id?: string;\n  task_id?: string;\n  timestamp: string;\n}`} />
        <H2>{c.conversations.filterH2}</H2>
        <P>{c.conversations.filterP}</P>
      </div>
    ),

    "guide-first-agent": (
      <div>
        <H1>{c["guide-first-agent"].h1}</H1>
        <P>{c["guide-first-agent"].p1}</P>
        <H2>{c["guide-first-agent"].step1H2}</H2>
        <P>{c["guide-first-agent"].step1P}</P>
        <H2>{c["guide-first-agent"].step2H2}</H2>
        <CodeBlock lang="text" code={`Name:        Alice\nRole:        Research Agent\nDescription: Expert at web research, data extraction, and summarization.`} />
        <H2>{c["guide-first-agent"].step3H2}</H2>
        <P>{c["guide-first-agent"].step3P}</P>
        <H2>{c["guide-first-agent"].step4H2}</H2>
        <P>{c["guide-first-agent"].step4P}</P>
        <H2>{c["guide-first-agent"].step5H2}</H2>
        <P>{c["guide-first-agent"].step5P}</P>
        <Callout type="tip">{c["guide-first-agent"].callout}</Callout>
      </div>
    ),

    "guide-build-team": (
      <div>
        <H1>{c["guide-build-team"].h1}</H1>
        <P>{c["guide-build-team"].p1}</P>
        <H2>{c["guide-build-team"].compositionH2}</H2>
        <div className="space-y-2 my-4">
          {c["guide-build-team"].teamRoles.map(({ role, purpose }) => (
            <div key={role} className="flex items-start gap-3 px-4 py-3 rounded-lg border border-border/50 bg-muted/20">
              <span className="text-sm font-bold text-foreground/80 w-40 flex-shrink-0">{role}</span>
              <span className="text-sm text-muted-foreground">{purpose}</span>
            </div>
          ))}
        </div>
        <H2>{c["guide-build-team"].createH2}</H2>
        <P>{c["guide-build-team"].createP}</P>
      </div>
    ),

    "guide-run-task": (
      <div>
        <H1>{c["guide-run-task"].h1}</H1>
        <P>{c["guide-run-task"].p1}</P>
        <H2>{c["guide-run-task"].uiH2}</H2>
        <P>{c["guide-run-task"].uiP}</P>
        <H2>{c["guide-run-task"].restH2}</H2>
        <CodeBlock lang="bash" code={`curl -X POST http://localhost:8000/api/tasks \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"Market research","team_id":"team_abc"}'`} />
        <H2>{c["guide-run-task"].monitorH2}</H2>
        <P>{c["guide-run-task"].monitorP}</P>
        <CodeBlock lang="bash" code={`curl http://localhost:8000/api/tasks/{task_id}`} />
      </div>
    ),

    "guide-skills": (
      <div>
        <H1>{c["guide-skills"].h1}</H1>
        <P>{c["guide-skills"].p1}</P>
        <H2>{c["guide-skills"].webSearchH2}</H2>
        <P>{c["guide-skills"].webSearchP}</P>
        <CodeBlock lang="text" code={`Name:        Web Search\nKind:        integration\nTool:        web_search`} />
        <H2>{c["guide-skills"].sheetsH2}</H2>
        <CodeBlock lang="text" code={`Name:        Google Sheets Writer\nKind:        integration\nTool:        sheet\nThird-party: Google Sheets`} />
        <Callout type="warning">{c["guide-skills"].sheetsCallout}</Callout>
        <H2>{c["guide-skills"].customH2}</H2>
        <CodeBlock lang="javascript" title="custom skill" code={`function run(input) {\n  const data = JSON.parse(input);\n  return data.filter(item => item.score > 0.8).map(item => item.name).join("\\n");\n}`} />
      </div>
    ),

    "api-agents": (
      <div>
        <H1>{c["api-agents"].h1}</H1>
        <P>{c["api-agents"].p1}</P>
        <H2>{c["api-agents"].endpointsH2}</H2>
        <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
          <ApiRow method="GET" path="/agents" desc="List all agents" />
          <ApiRow method="POST" path="/agents" desc="Create an agent" />
          <ApiRow method="GET" path="/agents/:id" desc="Get agent by ID" />
          <ApiRow method="PUT" path="/agents/:id" desc="Update agent" />
          <ApiRow method="DELETE" path="/agents/:id" desc="Delete agent" />
        </div>
        <H2>{c["api-agents"].createH2}</H2>
        <CodeBlock lang="json" title="POST /api/agents" code={`{\n  "name": "Alice",\n  "role": "Research Agent",\n  "skill_ids": [],\n  "status": "idle",\n  "avatar": "A"\n}`} />
      </div>
    ),

    "api-skills": (
      <div>
        <H1>{c["api-skills"].h1}</H1>
        <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
          <ApiRow method="GET" path="/skills" desc="List all skills" />
          <ApiRow method="POST" path="/skills" desc="Create a skill" />
          <ApiRow method="GET" path="/skills/:id" desc="Get skill by ID" />
          <ApiRow method="PUT" path="/skills/:id" desc="Update skill" />
          <ApiRow method="DELETE" path="/skills/:id" desc="Delete skill" />
        </div>
        <H2>{c["api-skills"].presetsH2}</H2>
        <CodeBlock lang="bash" code={`curl http://localhost:8000/api/skills/tools`} />
      </div>
    ),

    "api-teams": (
      <div>
        <H1>{c["api-teams"].h1}</H1>
        <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
          <ApiRow method="GET" path="/teams" desc="List all teams" />
          <ApiRow method="POST" path="/teams" desc="Create a team" />
          <ApiRow method="GET" path="/teams/:id" desc="Get team by ID" />
          <ApiRow method="PUT" path="/teams/:id" desc="Update team" />
          <ApiRow method="DELETE" path="/teams/:id" desc="Delete team" />
        </div>
      </div>
    ),

    "api-tasks": (
      <div>
        <H1>{c["api-tasks"].h1}</H1>
        <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
          <ApiRow method="GET" path="/tasks" desc="List all tasks" />
          <ApiRow method="POST" path="/tasks" desc="Create & start a task" />
          <ApiRow method="GET" path="/tasks/:id" desc="Get task status" />
          <ApiRow method="PATCH" path="/tasks/:id/pause" desc="Pause running task" />
          <ApiRow method="PATCH" path="/tasks/:id/resume" desc="Resume paused task" />
          <ApiRow method="PATCH" path="/tasks/:id/stop" desc="Stop task" />
          <ApiRow method="DELETE" path="/tasks/:id" desc="Delete task" />
        </div>
      </div>
    ),

    "api-chat": (
      <div>
        <H1>{c["api-chat"].h1}</H1>
        <P>{c["api-chat"].p1}</P>
        <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
          <ApiRow method="POST" path="/chat" desc="Send prompt to a specific agent" />
        </div>
        <CodeBlock lang="json" title="POST /api/chat" code={`{\n  "prompt": "What are the top Python web frameworks?",\n  "agentId": "agent_abc123"\n}`} />
      </div>
    ),

    "deploy-docker": (
      <div>
        <H1>{c["deploy-docker"].h1}</H1>
        <P>{c["deploy-docker"].p1}</P>
        <CodeBlock lang="yaml" title="docker-compose.yml" code={`version: "3.9"\nservices:\n  backend:\n    build: .\n    ports: ["8000:8000"]\n    environment:\n      - ANTHROPIC_API_KEY=\${ANTHROPIC_API_KEY}\n  frontend:\n    build: { context: ., dockerfile: Dockerfile.frontend }\n    ports: ["80:80"]\n  rabbitmq:\n    image: rabbitmq:3-management\n    ports: ["5672:5672","15672:15672"]`} />
        <CodeBlock lang="bash" code={`docker compose up -d\ndocker compose logs -f backend`} />
      </div>
    ),

    "deploy-env": (
      <div>
        <H1>{c["deploy-env"].h1}</H1>
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
              {[["ANTHROPIC_API_KEY","Yes*","Anthropic Claude API key"],["OPENAI_API_KEY","Yes*","OpenAI API key"],["DEFAULT_LLM","No","anthropic or openai"],["RABBITMQ_URL","No","RabbitMQ connection string"],["PORT","No","Backend port (default: 8000)"]].map(([v,r,d]) => (
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
        <H1>{c["contributing-guide"].h1}</H1>
        <P>{c["contributing-guide"].p1}</P>
        <H2>{c["contributing-guide"].waysH2}</H2>
        <UL>{c["contributing-guide"].ways.map((w, i) => <LI key={i}>{w}</LI>)}</UL>
        <H2>{c["contributing-guide"].prH2}</H2>
        <CodeBlock lang="bash" code={`git clone https://github.com/YOUR_USERNAME/ai-collective.git\ncd ai-collective\ngit checkout -b feat/my-feature\ngit commit -m "feat: add my feature"\ngit push origin feat/my-feature`} />
        <Callout type="info">{c["contributing-guide"].callout}</Callout>
      </div>
    ),

    "contributing-dev": (
      <div>
        <H1>{c["contributing-dev"].h1}</H1>
        <H2>{c["contributing-dev"].hooksH2}</H2>
        <CodeBlock lang="bash" code={`pip install pre-commit\npre-commit install`} />
        <P>{c["contributing-dev"].hooksP}</P>
        <H2>{c["contributing-dev"].testsH2}</H2>
        <CodeBlock lang="bash" code={`npm run test\nnpm run test:e2e\npytest`} />
        <H2>{c["contributing-dev"].styleH2}</H2>
        <UL>{c["contributing-dev"].style.map((s, i) => <LI key={i}>{s}</LI>)}</UL>
      </div>
    ),
  };
}
