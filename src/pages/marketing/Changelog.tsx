import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ExternalLink, GitCommit, Package, Wrench, Zap, Shield, Bug } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

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
      { type: "feature", text: "Added max_concurrent parameter to MultiAgentMeshOrchestrator for parallel hub-to-agent queries." },
      { type: "feature", text: "Kubernetes SandboxProvider: provision isolated K8s pods for secure code execution." },
      { type: "feature", text: "LLM-based Knowledge Graph extraction mode via GraphContextConfig." },
      { type: "improvement", text: "Improved token budget management with automatic context window trimming." },
      { type: "fix", text: "Fixed GitHub Actions CI workflow triggers on push to main branch." },
    ],
  },
  {
    version: "v0.8.0",
    date: "April 2026",
    changes: [
      { type: "feature", text: "RabbitMQ Pub/Sub event bus for offloading heavy background tasks." },
      { type: "feature", text: "Fixed worker pool configuration for Uvicorn API server and RabbitMQ consumers." },
      { type: "improvement", text: "CI/CD error analysis pipeline added to .github/workflows." },
      { type: "fix", text: "Resolved WebSocket race condition in Human-in-the-Loop steering endpoint." },
    ],
  },
  {
    version: "v0.7.0",
    date: "March 2026",
    changes: [
      { type: "feature", text: "Supervisor topology with dynamic subagent spawning and turn-limit enforcement." },
      { type: "feature", text: "Google OAuth integration with JWT workspace isolation." },
      { type: "improvement", text: "Dark mode overhaul with full Claude Platform-style design system." },
      { type: "feature", text: "LanguageSwitcher component for EN/VI localization support." },
      { type: "breaking", text: "Agent API response schema updated: role field renamed to topology_role." },
    ],
  },
  {
    version: "v0.6.0",
    date: "February 2026",
    changes: [
      { type: "feature", text: "Ring topology: multi-round agent debate with consensus formatting." },
      { type: "feature", text: "Real-time SSE streaming events: agent_start, llm_request, subagent_complete." },
      { type: "improvement", text: "spaCy NLP entity extraction upgraded to en_core_web_trf transformer model." },
      { type: "security", text: "Added input sanitization and prompt injection guard on all tool calls." },
      { type: "fix", text: "Fixed memory leak in long-running Mesh orchestrator sessions." },
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
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Login</Link>
            <Link to="/dashboard" className="inline-flex h-9 px-4 items-center justify-center rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity">
              Start building
            </Link>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-16">
        <FadeIn>
          <p className="text-sm font-semibold text-accent uppercase tracking-widest mb-4">Changelog</p>
          <h1 className="text-5xl md:text-[64px] font-medium tracking-tight leading-[1.05] font-serif mb-6">
            What's new in<br />AI Collective
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl">
            Every release, every improvement, every fix — documented in one place.
          </p>
          <div className="flex items-center gap-3 mt-6">
            <a href={GITHUB_URL + "/releases"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted/30 transition-all">
              View on GitHub <ExternalLink className="w-3.5 h-3.5" />
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
