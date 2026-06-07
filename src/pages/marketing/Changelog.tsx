import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ExternalLink, GitCommit, Package, Wrench, Zap, Shield, Bug } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";

const GITHUB_URL = "https://github.com/SuZeAI/ai-collective";

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

type ChangeType = "feature" | "fix" | "improvement" | "breaking" | "security";

interface Change {
  type: ChangeType;
  text: string;
}

interface Release {
  version: string;
  date: string;
  label?: string;
  changes: Change[];
}

const RELEASES: Release[] = [
  {
    version: "v0.9.0",
    date: "June 2026",
    label: "Latest",
    changes: [
      { type: "feature", text: "Mobile navigation menu with accordion sections on Landing page." },
      { type: "feature", text: "Vercel rewrites configured to serve index.html for all SPA paths." },
      { type: "feature", text: "Docker multi-stage build with non-root user and .dockerignore for smaller, safer images." },
      { type: "feature", text: "SSRF guard for all LLM-driven outbound HTTP and browser tool calls." },
      { type: "security", text: "Webhook signature verification and hardened inbound webhook endpoint." },
      { type: "feature", text: "Workspace selection and switching integrated into AppLayout and sidebar navigation." },
      { type: "feature", text: "Marketing pages fully internationalized (EN/VI): ContactSales, SupportCenter, Pricing, Playground." },
      { type: "improvement", text: "Spiderweb mesh animation replaces static node graphic on landing hero section." },
      { type: "improvement", text: "Design system overhauled to Claude Platform aesthetic with Inter and Newsreader fonts." },
      { type: "improvement", text: "Relicensed to Non-Commercial / Academic; commercial use requires contact." },
      { type: "fix", text: "Fixed N+1 skill loading and kwargs-blind tool cache in agent execution." },
      { type: "fix", text: "Durable task queue, graceful shutdown, and bounded caches for API reliability." },
      { type: "fix", text: "Stopped leaking PII to logs and surfaced previously swallowed errors." },
      { type: "fix", text: "Multi-agent orchestration made resilient; decoupled services from infrastructure layer." },
      { type: "fix", text: "Centralized API documentation URL management across the codebase." },
    ],
  },
  {
    version: "v0.8.0",
    date: "June 2026",
    changes: [
      { type: "feature", text: "Supervisor topology with dynamic subagent spawning and turn-limit enforcement." },
      { type: "feature", text: "Ring topology: multi-round agent debate with consensus formatting." },
      { type: "feature", text: "Tree mode added to GraphRunRequest for hierarchical agent execution." },
      { type: "feature", text: "Subagent support with configurable limits and UI integration in TaskManager." },
      { type: "improvement", text: "Enhanced development environment with structured logging configuration and log collection." },
      { type: "improvement", text: "Makefile commands reorganized with categorized sections for clarity." },
    ],
  },
  {
    version: "v0.7.0",
    date: "May 2026",
    changes: [
      { type: "feature", text: "MongoDB repositories implemented for agents, skills, tasks, teams, and workspaces." },
      { type: "feature", text: "Kubernetes sandbox consolidated; deprecated remote sandbox adapter removed." },
      { type: "feature", text: "Redis Commander added to Docker Compose setup for cache inspection." },
      { type: "feature", text: "LLM-based knowledge graph extraction mode added to llm.py pipeline." },
      { type: "improvement", text: "Tool registry updated to validate sandbox type; TaskManager gains graph panel toggle." },
      { type: "fix", text: "Pylint CI workflow trigger updated to target correct branches." },
    ],
  },
  {
    version: "v0.6.0",
    date: "April 2026",
    changes: [
      { type: "feature", text: "Google OAuth login with JWT-based workspace isolation." },
      { type: "feature", text: "Avatar upload functionality for user profiles." },
      { type: "feature", text: "Full user authentication: login, registration, and profile management." },
      { type: "feature", text: "Third-party connection management with CRUD operations integrated into API and Settings page." },
    ],
  },
  {
    version: "v0.5.0",
    date: "March 2026",
    changes: [
      { type: "feature", text: "Multi-agent orchestration with LangGraph: mesh, sequential, ring, and supervisor modes." },
      { type: "feature", text: "Real-time SSE streaming events: agent_start, llm_request, subagent_complete." },
      { type: "feature", text: "YouTube, Browser (Playwright), and Web Search (DuckDuckGo) toolkits." },
      { type: "feature", text: "Xiaohongshu and TikTok search tool integrations." },
      { type: "feature", text: "Agent and team avatar customization with color and icon options." },
      { type: "feature", text: "PromptTool integration; drag-and-drop agent ordering in TeamBuilder." },
      { type: "improvement", text: "Replaced time-based IDs with UUIDs across agents, messages, skills, and tasks." },
    ],
  },
];

const TAG_META: Record<ChangeType, { label: string; icon: React.ElementType; className: string }> = {
  feature: { label: "Feature", icon: Zap, className: "bg-accent/10 text-accent" },
  improvement: { label: "Improvement", icon: Wrench, className: "bg-blue-500/10 text-blue-400" },
  fix: { label: "Fix", icon: Bug, className: "bg-yellow-500/10 text-yellow-500" },
  breaking: { label: "Breaking", icon: Package, className: "bg-red-500/10 text-red-400" },
  security: { label: "Security", icon: Shield, className: "bg-purple-500/10 text-purple-400" },
};

export default function Changelog() {
  const { t } = useLanguage();
  const m = t.marketing;

  return (
    <div className="min-h-screen bg-[#faf9f5] dark:bg-[#141413] text-foreground font-sans">
      {/* Nav */}
      <div className="border-b border-border/60 bg-background/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/spider.png" alt="AI Collective" className="h-6 w-6 object-contain" />
            <span className="font-serif text-lg font-medium">AI Collective</span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <ThemeToggle />
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{m.common.login}</Link>
            <Link to="/dashboard" className="inline-flex h-9 px-4 items-center justify-center rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity">
              {m.common.startBuilding}
            </Link>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-16">
        <FadeIn>
          <p className="text-sm font-semibold text-accent uppercase tracking-widest mb-4">{m.changelog.badge}</p>
          <h1 className="text-5xl md:text-[64px] font-medium tracking-tight leading-[1.05] font-serif mb-6">{m.changelog.h1}</h1>
          <p className="text-lg text-muted-foreground max-w-xl">{m.changelog.sub}</p>
          <div className="flex items-center gap-3 mt-6">
            <a href={GITHUB_URL + "/releases"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted/30 transition-all">
              {m.changelog.viewGithub} <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </FadeIn>
      </section>

      {/* Releases */}
      <section className="max-w-4xl mx-auto px-6 pb-24 border-t border-border/60 pt-12">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-0 top-0 bottom-0 w-px bg-border/60 ml-[5px] hidden sm:block" />

          <div className="space-y-16">
            {RELEASES.map((release, ri) => (
              <FadeIn key={release.version} delay={0.06 * ri}>
                <div className="sm:pl-10 relative">
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full border-2 border-accent bg-background hidden sm:block" />

                  <div className="flex flex-wrap items-center gap-3 mb-5">
                    <h2 className="text-2xl font-bold font-serif font-mono">{release.version}</h2>
                    {release.label && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-accent/15 text-accent border border-accent/20">
                        {release.label}
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground ml-auto flex items-center gap-1.5">
                      <GitCommit className="w-3.5 h-3.5" /> {release.date}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {release.changes.map((change, ci) => {
                      const meta = TAG_META[change.type];
                      return (
                        <div key={ci} className="flex items-start gap-3 p-3.5 rounded-lg hover:bg-muted/30 transition-colors">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5 ${meta.className}`}>
                            <meta.icon className="w-3 h-3" /> {meta.label}
                          </span>
                          <p className="text-sm text-foreground/90 leading-relaxed">{change.text}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
