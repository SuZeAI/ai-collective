import { Link } from "react-router-dom";
import { ExternalLink, GitCommit, Package, Wrench, Zap, Shield, Bug, Tag } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { MarketingNav, FadeIn } from "@/components/marketing/MarketingNav";

const GITHUB_URL = "https://github.com/SuZeAI/ai-collective";
const GITHUB_TAG_URL = (tag: string) => `${GITHUB_URL}/releases/tag/${tag}`;

type ChangeType = "feature" | "fix" | "improvement" | "breaking" | "security";

interface Change {
  type: ChangeType;
  text: string;
}

interface Release {
  tag: string;
  date: string;
  label?: string;
  changes: Change[];
}

const RELEASES: Release[] = [
  {
    tag: "aic_v3.0.3",
    date: "June 7, 2026",
    label: "Latest",
    changes: [
      { type: "feature", text: "owner_id on all entities; users see their own and shared-scope items only." },
      { type: "feature", text: "can_modify function enforces shared item editing restrictions across staff, offices, skills, tasks, departments, and companies." },
      { type: "feature", text: "canEditItem controls edit button visibility based on ownership across all views." },
      { type: "feature", text: "Router multi-provider LLM proxy integrated in development and production environments." },
      { type: "feature", text: "AppendFromOverallDialog: unified dialog for managing items, skills, tasks, and departments across pages." },
    ],
  },
  {
    tag: "aic_v3.0.2",
    date: "June 7, 2026",
    changes: [
      { type: "feature", text: "OfficeBuilder page with AI-generated office planning and real-time streaming overlays." },
      { type: "feature", text: "OfficeBuilderSession model and repository for persistent session management." },
      { type: "feature", text: "Structured office plan schema with department and role definitions." },
      { type: "improvement", text: "Company/office scoping rolled out across Meetings, Dashboard, Skills, and TaskManager." },
      { type: "improvement", text: "Distinct office view filtering and navigation enhancements." },
    ],
  },
  {
    tag: "aic_v3.0.1",
    date: "June 7, 2026",
    changes: [
      { type: "feature", text: "Human-in-the-loop (HIL): ask_user tool lets staff pause and request input mid-run." },
      { type: "feature", text: "HIL streaming support integrated into the staff-graph endpoint." },
      { type: "feature", text: "MongoDB persistence for sandbox sessions; replaces in-memory store." },
      { type: "feature", text: "JSON-to-MongoDB migration script for existing sandbox session data." },
      { type: "improvement", text: "Task management: clear run-state handling and follow-up messaging improvements." },
    ],
  },
  {
    tag: "aic_v3.0",
    date: "June 6, 2026",
    changes: [
      { type: "security", text: "SSRF guard for all LLM-driven outbound HTTP and browser tool calls." },
      { type: "security", text: "Webhook signature verification and hardened inbound webhook endpoint." },
      { type: "feature", text: "Docker multi-stage build with non-root user and .dockerignore." },
      { type: "feature", text: "Company selection and switching integrated into AppLayout and sidebar navigation." },
      { type: "feature", text: "Marketing pages fully internationalized (EN/VI): ContactSales, SupportCenter, Pricing, Playground." },
      { type: "feature", text: "Supervisor topology with dynamic subagent spawning and turn-limit enforcement." },
      { type: "feature", text: "Ring topology: multi-round staff debate with consensus formatting." },
      { type: "feature", text: "Tree mode added to GraphRunRequest for hierarchical staff execution." },
      { type: "improvement", text: "Design system overhauled to Claude Platform aesthetic (Inter + Newsreader fonts)." },
      { type: "improvement", text: "Spiderweb mesh animation on landing hero; interactive dropdown navigation." },
      { type: "improvement", text: "Relicensed to Non-Commercial / Academic — commercial use requires contact." },
      { type: "fix", text: "Fixed N+1 skill loading and kwargs-blind tool cache in staff execution." },
      { type: "fix", text: "Durable task queue, graceful shutdown, and bounded caches for API reliability." },
      { type: "fix", text: "Stopped leaking PII to logs; surfaced previously swallowed errors." },
      { type: "fix", text: "Multi-staff orchestration made resilient; services decoupled from infrastructure layer." },
    ],
  },
  {
    tag: "aic_v2.4",
    date: "June 3, 2026",
    changes: [
      { type: "feature", text: "Subagent support with configurable limits and UI integration in TaskManager." },
      { type: "feature", text: "Supervisor and ring topology modes extended via GraphRunRequest." },
      { type: "feature", text: "Tree execution mode added to multi-staff graph runs." },
      { type: "improvement", text: "Enhanced dev environment with structured logging configuration and log collection." },
      { type: "improvement", text: "Makefile commands reorganized with categorized help sections." },
    ],
  },
  {
    tag: "aic_v2.3",
    date: "May 8, 2026",
    changes: [
      { type: "feature", text: "MongoDB repositories implemented for staff, skills, tasks, departments, and companies." },
      { type: "feature", text: "Kubernetes sandbox consolidated; deprecated remote sandbox adapter removed." },
      { type: "feature", text: "Redis Commander added to Docker Compose setup for cache inspection." },
      { type: "feature", text: "LLM-based knowledge graph extraction mode added to the llm.py pipeline." },
      { type: "improvement", text: "Tool registry validates sandbox type; TaskManager gains graph panel toggle." },
    ],
  },
  {
    tag: "aic_v2.2",
    date: "April 26, 2026",
    changes: [
      { type: "feature", text: "Google OAuth login with JWT-based company isolation." },
      { type: "feature", text: "Avatar upload functionality for user profiles." },
      { type: "feature", text: "Full user authentication: login, registration, and profile management." },
      { type: "feature", text: "Third-party connection management with CRUD operations integrated into API and Settings page." },
    ],
  },
  {
    tag: "aic_v2.1",
    date: "March 30, 2026",
    changes: [
      { type: "improvement", text: "All tool integrations tested end-to-end; API requirement notes added for Xiaohongshu and TikTok Search." },
      { type: "fix", text: "Tool.md updated to reflect Drive status and correct API gating per provider." },
    ],
  },
  {
    tag: "aic_v2.0",
    date: "March 29, 2026",
    changes: [
      { type: "improvement", text: "All services runnable end-to-end in a single docker-compose up." },
      { type: "improvement", text: "Drive integration status documented." },
    ],
  },
  {
    tag: "aic_v1",
    date: "March 28, 2026",
    changes: [
      { type: "feature", text: "Initial release: multi-staff orchestration with LangGraph (mesh and sequential modes)." },
      { type: "feature", text: "WebSearch (DuckDuckGo), Prompt toolkit, YouTube, and Browser (Playwright) tool integrations." },
      { type: "feature", text: "Xiaohongshu tool integration." },
      { type: "feature", text: "Real-time SSE streaming: agent_start, llm_request, subagent_complete events." },
      { type: "feature", text: "Staff and department avatar customization; drag-and-drop ordering in DepartmentBuilder." },
      { type: "feature", text: "PromptTool integration; replaced time-based IDs with UUIDs across all entities." },
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
      <MarketingNav />

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
              <FadeIn key={release.tag} delay={0.06 * ri}>
                <div className="sm:pl-10 relative">
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full border-2 border-accent bg-background hidden sm:block" />

                  <div className="flex flex-wrap items-center gap-3 mb-5">
                    {/* Tag name + GitHub link */}
                    <a
                      href={GITHUB_TAG_URL(release.tag)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-1.5"
                    >
                      <h2 className="text-2xl font-bold font-mono group-hover:text-accent transition-colors">
                        {release.tag}
                      </h2>
                      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors opacity-0 group-hover:opacity-100" />
                    </a>

                    {release.label && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-accent/15 text-accent border border-accent/20">
                        {release.label}
                      </span>
                    )}

                    <span className="text-sm text-muted-foreground ml-auto flex items-center gap-1.5">
                      <GitCommit className="w-3.5 h-3.5" /> {release.date}
                    </span>
                  </div>

                  {/* GitHub tag badge */}
                  <div className="mb-4">
                    <a
                      href={GITHUB_TAG_URL(release.tag)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                    >
                      <Tag className="w-3 h-3" />
                      {release.tag}
                      <ExternalLink className="w-3 h-3" />
                    </a>
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
