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
  const lang = t.auth.or === "Hoặc" ? "vi" : t.auth.or === "或" ? "zh" : t.auth.or === "または" ? "ja" : "en";

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
│  Staff Manager ─── LangGraph Orchestrator        │
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

    "pricing": (
      <div>
        <H1>{lang === "vi" ? "Bảng giá & Gói dịch vụ" : lang === "zh" ? "定价与计划" : lang === "ja" ? "料金とプラン" : "Pricing & Plans Overview"}</H1>
        <P>
          {lang === "vi"
            ? "AI Collective cung cấp các gói dịch vụ linh hoạt được thiết kế cho các nhà phát triển cá nhân, các đội ngũ đang phát triển và các doanh nghiệp lớn."
            : "AI Collective offers flexible pricing tiers designed for individual developers, growing departments, and large enterprises."}
        </P>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
          <div className="p-5 rounded-xl border border-border bg-card">
            <div className="font-bold text-lg mb-1">{lang === "vi" ? "Gói Cá nhân (Free)" : "Free Plan"}</div>
            <div className="text-2xl font-extrabold mb-3">$0</div>
            <p className="text-xs text-muted-foreground mb-4">
              {lang === "vi" ? "Phù hợp để thử nghiệm và chạy các tác vụ cá nhân cục bộ." : "Ideal for testing, development, and personal projects."}
            </p>
            <UL>
              <LI>{lang === "vi" ? "Chạy tác nhân cục bộ không giới hạn" : "Unlimited local staff executions"}</LI>
              <LI>{lang === "vi" ? "1 không gian làm việc hoạt động" : "1 active company"}</LI>
              <LI>{lang === "vi" ? "Hỗ trợ cộng đồng qua Discord/GitHub" : "Community support"}</LI>
            </UL>
          </div>

          <div className="p-5 rounded-xl border-2 border-primary bg-primary/5 relative">
            <div className="absolute -top-3 right-4 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              {lang === "vi" ? "Phổ biến" : "Popular"}
            </div>
            <div className="font-bold text-lg mb-1">{lang === "vi" ? "Chuyên nghiệp (Pro)" : "Pro Plan"}</div>
            <div className="text-2xl font-extrabold mb-3">$29<span className="text-xs font-normal text-muted-foreground">/user/mo</span></div>
            <p className="text-xs text-muted-foreground mb-4">
              {lang === "vi" ? "Dành cho các nhóm chạy dự án thực tế trên hạ tầng đám mây." : "For departments running production workloads on cloud infrastructures."}
            </p>
            <UL>
              <LI>{lang === "vi" ? "Lên tới 10 không gian làm việc" : "Up to 10 active companies"}</LI>
              <LI>{lang === "vi" ? "Hàng đợi tác vụ RabbitMQ tốc độ cao" : "High-speed RabbitMQ task queue"}</LI>
              <LI>{lang === "vi" ? "Thống kê chi phí & độ trễ chi tiết" : "Advanced cost & telemetry analytics"}</LI>
              <LI>{lang === "vi" ? "Hỗ trợ ưu tiên 24/7" : "Priority 24/7 email & Slack support"}</LI>
            </UL>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card">
            <div className="font-bold text-lg mb-1">{lang === "vi" ? "Doanh nghiệp (Enterprise)" : "Enterprise"}</div>
            <div className="text-2xl font-extrabold mb-3">Custom</div>
            <p className="text-xs text-muted-foreground mb-4">
              {lang === "vi" ? "Hạ tầng dành riêng cho tổ chức lớn với yêu cầu cao về bảo mật." : "Dedicated isolation for large organizations requiring custom SLAs and advanced security."}
            </p>
            <UL>
              <LI>{lang === "vi" ? "Không giới hạn không gian làm việc" : "Unlimited companies"}</LI>
              <LI>{lang === "vi" ? "Triển khai Self-hosted hoặc On-premise" : "Self-hosted / On-premise deployment"}</LI>
              <LI>{lang === "vi" ? "Đăng nhập một lần (SSO / SAML)" : "Single Sign-On (SSO) & SAML"}</LI>
              <LI>{lang === "vi" ? "Kỹ sư hỗ trợ riêng biệt & cam kết SLA" : "Dedicated Support Engineer & Uptime SLAs"}</LI>
            </UL>
          </div>
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

    "staff": (
      <div>
        <H1>{c.staff.h1}</H1>
        <P>{c.staff.p1}</P>
        <H2>{c.staff.schemaH2}</H2>
        <CodeBlock lang="typescript" title="types/Staff" code={`type Staff = {\n  id: string;\n  name: string;\n  role: string;\n  description: string;\n  system_prompt?: string;\n  skill_ids: string[];\n  status: "active" | "idle" | "thinking" | string;\n  avatar: string;\n}`} />
        <H2>{c.staff.rolesH2}</H2>
        <P>{c.staff.rolesP}</P>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 my-4">
          {["Project Manager","Research Staff","Developer Staff","Marketing Staff","Reviewer Staff","Support Staff","Data Analyst Staff","QA Staff","Legal Advisor Staff"].map((r) => (
            <div key={r} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/50 text-xs font-medium text-foreground/70">
              <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />{r}
            </div>
          ))}
        </div>
        <Callout type="tip">{c.staff.callout}</Callout>
        <H2>{c.staff.lifecycleH2}</H2>
        <CodeBlock lang="text" code={`idle ──▶ thinking ──▶ active ──▶ idle\n                          │\n                          └──▶ error`} />
        <H2>{c.staff.restH2}</H2>
        <CodeBlock lang="bash" code={`curl -X POST http://localhost:8000/api/staff \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"Alice","role":"Research Staff","skill_ids":[],"status":"idle","avatar":"A"}'`} />
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

    "departments": (
      <div>
        <H1>{c.departments.h1}</H1>
        <P>{c.departments.p1}</P>
        <H2>{c.departments.modesH2}</H2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-5">
          <div className="p-5 rounded-xl border-2 border-primary/20 bg-primary/5">
            <div className="font-bold mb-2 flex items-center gap-2"><Pill color="blue">mesh</Pill> {c.departments.mesh.title}</div>
            <p className="text-[13px] text-muted-foreground leading-relaxed">{c.departments.mesh.desc}</p>
          </div>
          <div className="p-5 rounded-xl border-2 border-violet-200 bg-violet-500/5">
            <div className="font-bold mb-2 flex items-center gap-2"><Pill color="purple">sequential</Pill> {c.departments.sequential.title}</div>
            <p className="text-[13px] text-muted-foreground leading-relaxed">{c.departments.sequential.desc}</p>
          </div>
        </div>
        <H2>{c.departments.schemaH2}</H2>
        <CodeBlock lang="typescript" code={`type Department = {\n  id: string;\n  name: string;\n  description: string;\n  staff: string[];\n  mode: "mesh" | "sequential";\n  activeTasks: number;\n}`} />
      </div>
    ),

    "tasks": (
      <div>
        <H1>{c.tasks.h1}</H1>
        <P>{c.tasks.p1}</P>
        <H2>{c.tasks.lifecycleH2}</H2>
        <CodeBlock lang="text" code={`pending ──▶ in-progress ──▶ completed\n                 │\n                 ├──▶ paused ──▶ in-progress\n                 └──▶ stopped`} />
        <H2>{c.tasks.schemaH2}</H2>
        <CodeBlock lang="typescript" code={`type Task = {\n  id: string;\n  title: string;\n  description: string;\n  status: "pending" | "in-progress" | "paused" | "stopped" | "completed";\n  progress: number;\n  department_id?: string;\n  result?: string;\n}`} />
        <H2>{c.tasks.graphH2}</H2>
        <P>{c.tasks.graphP}</P>
        <Callout type="info">{c.tasks.graphCallout}</Callout>
      </div>
    ),

    "meetings": (
      <div>
        <H1>{c.meetings.h1}</H1>
        <P>{c.meetings.p1}</P>
        <H2>{c.meetings.formatH2}</H2>
        <CodeBlock lang="typescript" code={`type Message = {\n  id: string;\n  role: "user" | "assistant" | "system" | "tool";\n  content: string;\n  staff_id?: string;\n  task_id?: string;\n  timestamp: string;\n}`} />
        <H2>{c.meetings.filterH2}</H2>
        <P>{c.meetings.filterP}</P>
      </div>
    ),

    "playground": (
      <div>
        <H1>{lang === "vi" ? "Thử nghiệm (Playground)" : lang === "zh" ? "演练场" : lang === "ja" ? "プレイグラウンド" : "Playground"}</H1>
        <P>
          {lang === "vi" 
            ? "Môi trường Thử nghiệm (Playground) cung cấp một giao diện tương tác trực tiếp để thử nghiệm nhanh các tác nhân hoặc nhóm tác nhân AI của bạn mà không cần tạo và quản lý các nhiệm vụ (Tasks) chính thức."
            : "The Playground provides an interactive chat interface to quickly test your AI staff or departments without having to create and monitor formal executing tasks."}
        </P>
        <H2>{lang === "vi" ? "Cách hoạt động" : "How it Works"}</H2>
        <UL>
          <LI>
            {lang === "vi"
              ? "Chọn Tác nhân hoặc Nhóm: Sử dụng trình thả xuống ở góc trên cùng để chọn đối tượng bạn muốn trò chuyện."
              : "Select Staff or Department: Use the dropdown in the header to choose who you want to interact with."}
          </LI>
          <LI>
            {lang === "vi"
              ? "Tương tác thời gian thực: Gửi tin nhắn và xem các câu trả lời dạng truyền dữ liệu (streaming) từ các mô hình ngôn ngữ lớn (LLM)."
              : "Real-time Chatting: Send prompts and watch live streaming token responses from LLMs."}
          </LI>
          <LI>
            {lang === "vi"
              ? "Theo dõi Cuộc gọi Công cụ: Xem trực tiếp cách các tác nhân quyết định gọi các kỹ năng như duyệt web hoặc thực thi mã."
              : "Inspect Tool Calls: Directly view when staff decide to call skills such as web scraping or database read."}
          </LI>
        </UL>
        <H2>{lang === "vi" ? "Mục đích sử dụng" : "When to Use"}</H2>
        <P>
          {lang === "vi"
            ? "Chế độ Thử nghiệm là lựa chọn lý tưởng nhất để tinh chỉnh các câu lệnh hệ thống (system prompts) của tác nhân hoặc kiểm tra xem các kỹ năng (skills) có hoạt động như mong đợi hay không trước khi ghép chúng vào các luồng công việc phức tạp."
            : "The Playground is ideal for refining staff system prompts and verifying whether custom tools and integrations work as intended before deploying them in automated multi-step flows."}
        </P>
      </div>
    ),

    "analytics": (
      <div>
        <H1>{lang === "vi" ? "Phân tích & Thống kê" : lang === "zh" ? "分析" : lang === "ja" ? "分析" : "Analytics"}</H1>
        <P>
          {lang === "vi"
            ? "Trang Phân tích cung cấp các biểu đồ trực quan hóa chi tiết về hiệu năng hoạt động của hệ thống tác nhân và các chỉ số tài nguyên sử dụng."
            : "The Analytics dashboard offers visual charts and detailed telemetry covering staff execution performance and system resources."}
        </P>
        <H2>{lang === "vi" ? "Các chỉ số chính" : "Key Metrics Tracked"}</H2>
        <UL>
          <LI>
            <strong>{lang === "vi" ? "Tiêu thụ Token & Chi phí" : "Token Usage & Cost Tracker"}:</strong>{" "}
            {lang === "vi"
              ? "Theo dõi số lượng token đầu vào/đầu ra và ước tính chi phí thực tế cho từng nhà cung cấp mô hình (OpenAI, Anthropic, Gemini)."
              : "Tracks cumulative input and output tokens consumed and calculates model cost estimation across different providers."}
          </LI>
          <LI>
            <strong>{lang === "vi" ? "Độ trễ và Thời gian phản hồi" : "Execution Latencies"}:</strong>{" "}
            {lang === "vi"
              ? "Đo lường thời gian thực thi của các tác vụ và thời gian phản hồi trung bình từ LLM."
              : "Measures task completion speed and LLM prompt generation times to locate performance bottlenecks."}
          </LI>
          <LI>
            <strong>{lang === "vi" ? "Lưu lượng Hàng đợi Event Bus" : "Event Queue Statistics"}:</strong>{" "}
            {lang === "vi"
              ? "Giám sát số lượng thông điệp chạy qua bus sự kiện RabbitMQ để đảm bảo hệ thống không bị nghẽn."
              : "Monitors active messages routing through RabbitMQ to ensure smooth staff communication."}
          </LI>
        </UL>
      </div>
    ),

    "companies": (
      <div>
        <H1>{lang === "vi" ? "Không gian làm việc (Companies)" : lang === "zh" ? "工作空间" : lang === "ja" ? "ワークスペース" : "Companies"}</H1>
        <P>
          {lang === "vi"
            ? "Không gian làm việc (Companies) cho phép bạn phân tách dự án, nhóm tác nhân và các nhiệm vụ thành các môi trường riêng biệt để dễ dàng quản lý."
            : "Companies allow developers to compartmentalize project environments, keeping staff, departments, tasks, and historical logs completely isolated from one another."}
        </P>
        <H2>{lang === "vi" ? "Tính năng cốt lõi" : "Core Features"}</H2>
        <UL>
          <LI>
            {lang === "vi"
              ? "Phân tách dữ liệu: Mỗi không gian làm việc hoạt động độc lập và không chia sẻ tác nhân hay cấu hình với nhau."
              : "Absolute Data Isolation: Switch between separate scopes where staff and tasks are completely self-contained."}
          </LI>
          <LI>
            {lang === "vi"
              ? "Quản lý Dự án: Đặt tên và tổ chức các không gian làm việc để phù hợp với từng phòng ban hoặc khách hàng khác nhau."
              : "Project Management: Easily name, describe, and filter companies to match different departments or customers."}
          </LI>
          <LI>
            {lang === "vi"
              ? "Cấu hình riêng biệt: Đặt các biến môi trường và thiết lập mô hình mặc định khác nhau cho từng dự án."
              : "Independent Configs: Define different environment setups and defaults based on project requirements."}
          </LI>
        </UL>
      </div>
    ),

    "settings": (
      <div>
        <H1>{lang === "vi" ? "Cài đặt hệ thống" : lang === "zh" ? "设置" : lang === "ja" ? "設定" : "Settings"}</H1>
        <P>
          {lang === "vi"
            ? "Trang Cài đặt là nơi bạn quản lý toàn bộ các thông số hoạt động của hệ thống AI Collective, bảo mật và thông tin tài khoản."
            : "The Settings section provides central controls to manage system credentials, integrations, preferences, and account details."}
        </P>
        <H2>{lang === "vi" ? "Cấu hình có sẵn" : "Available Settings"}</H2>
        <UL>
          <LI>
            <strong>{lang === "vi" ? "Khóa API Nhà cung cấp" : "Provider API Keys"}:</strong>{" "}
            {lang === "vi"
              ? "Cập nhật khóa API cho Anthropic Claude, OpenAI GPT, và Google Gemini để cấp quyền chạy mô hình."
              : "Safely update keys for Anthropic, OpenAI, or Gemini to authorize staff model requests."}
          </LI>
          <LI>
            <strong>{lang === "vi" ? "Cấu hình Hệ thống" : "System Integrations"}:</strong>{" "}
            {lang === "vi"
              ? "Cấu hình địa chỉ RabbitMQ, PostgreSQL hoặc SQLite, và thiết lập chế độ sandbox thực thi mã."
              : "Configure connection URLs for RabbitMQ, persistent database backends, and sandbox runtimes."}
          </LI>
          <LI>
            <strong>{lang === "vi" ? "Hồ sơ người dùng" : "Profile Preferences"}:</strong>{" "}
            {lang === "vi"
              ? "Thay đổi thông tin cá nhân, cài đặt ngôn ngữ mặc định, mật khẩu, và chế độ sáng/tối."
              : "Manage personal parameters, default display languages, passwords, and color scheme."}
          </LI>
        </UL>
      </div>
    ),

    "guide-first-staff": (
      <div>
        <H1>{c["guide-first-staff"].h1}</H1>
        <P>{c["guide-first-staff"].p1}</P>
        <H2>{c["guide-first-staff"].step1H2}</H2>
        <P>{c["guide-first-staff"].step1P}</P>
        <H2>{c["guide-first-staff"].step2H2}</H2>
        <CodeBlock lang="text" code={`Name:        Alice\nRole:        Research Staff\nDescription: Expert at web research, data extraction, and summarization.`} />
        <H2>{c["guide-first-staff"].step3H2}</H2>
        <P>{c["guide-first-staff"].step3P}</P>
        <H2>{c["guide-first-staff"].step4H2}</H2>
        <P>{c["guide-first-staff"].step4P}</P>
        <H2>{c["guide-first-staff"].step5H2}</H2>
        <P>{c["guide-first-staff"].step5P}</P>
        <Callout type="tip">{c["guide-first-staff"].callout}</Callout>
      </div>
    ),

    "guide-build-department": (
      <div>
        <H1>{c["guide-build-department"].h1}</H1>
        <P>{c["guide-build-department"].p1}</P>
        <H2>{c["guide-build-department"].compositionH2}</H2>
        <div className="space-y-2 my-4">
          {c["guide-build-department"].departmentRoles.map(({ role, purpose }) => (
            <div key={role} className="flex items-start gap-3 px-4 py-3 rounded-lg border border-border/50 bg-muted/20">
              <span className="text-sm font-bold text-foreground/80 w-40 flex-shrink-0">{role}</span>
              <span className="text-sm text-muted-foreground">{purpose}</span>
            </div>
          ))}
        </div>
        <H2>{c["guide-build-department"].createH2}</H2>
        <P>{c["guide-build-department"].createP}</P>
      </div>
    ),

    "guide-run-task": (
      <div>
        <H1>{c["guide-run-task"].h1}</H1>
        <P>{c["guide-run-task"].p1}</P>
        <H2>{c["guide-run-task"].uiH2}</H2>
        <P>{c["guide-run-task"].uiP}</P>
        <H2>{c["guide-run-task"].restH2}</H2>
        <CodeBlock lang="bash" code={`curl -X POST http://localhost:8000/api/tasks \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"Market research","department_id":"department_abc"}'`} />
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

    "api-staff": (
      <div>
        <H1>{c["api-staff"].h1}</H1>
        <P>{c["api-staff"].p1}</P>
        <H2>{c["api-staff"].endpointsH2}</H2>
        <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
          <ApiRow method="GET" path="/staff" desc="List all staff" />
          <ApiRow method="POST" path="/staff" desc="Create an staff" />
          <ApiRow method="GET" path="/staff/:id" desc="Get staff by ID" />
          <ApiRow method="PUT" path="/staff/:id" desc="Update staff" />
          <ApiRow method="DELETE" path="/staff/:id" desc="Delete staff" />
        </div>
        <H2>{c["api-staff"].createH2}</H2>
        <CodeBlock lang="json" title="POST /api/staff" code={`{\n  "name": "Alice",\n  "role": "Research Staff",\n  "skill_ids": [],\n  "status": "idle",\n  "avatar": "A"\n}`} />
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

    "api-departments": (
      <div>
        <H1>{c["api-departments"].h1}</H1>
        <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
          <ApiRow method="GET" path="/departments" desc="List all departments" />
          <ApiRow method="POST" path="/departments" desc="Create a department" />
          <ApiRow method="GET" path="/departments/:id" desc="Get department by ID" />
          <ApiRow method="PUT" path="/departments/:id" desc="Update department" />
          <ApiRow method="DELETE" path="/departments/:id" desc="Delete department" />
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
          <ApiRow method="POST" path="/chat" desc="Send prompt to a specific staff" />
        </div>
        <CodeBlock lang="json" title="POST /api/chat" code={`{\n  "prompt": "What are the top Python web frameworks?",\n  "staffId": "staff_abc123"\n}`} />
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
