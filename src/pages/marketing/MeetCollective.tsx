import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Bot, Brain, Shield, Zap, Network, Code2, ExternalLink, ChevronRight } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const MODELS = [
  { name: "Google Gemini", key: "gemini-2.0-flash", color: "hsl(220 80% 55%)", desc: "Default speed engine, optimized for entity extraction and real-time knowledge graphs." },
  { name: "Anthropic Claude", key: "claude-3-5-sonnet", color: "hsl(25 80% 55%)", desc: "Premier logic engine for multi-agent mesh coordinator and advanced code generation." },
  { name: "OpenAI GPT-4o", key: "gpt-4o", color: "hsl(150 60% 45%)", desc: "Highly reliable engine for strict JSON schema enforcement and tool binding." },
  { name: "Qwen (Open Weight)", key: "qwen3.5-397B", color: "hsl(280 60% 55%)", desc: "High-parameter open-weight engine for self-hosted, air-gapped secure clusters." },
];

const FEATURES = [
  { icon: Network, name: "Multi-Agent Topologies", desc: "Sequential, Ring, Mesh, and Supervisor orchestration patterns for every use case." },
  { icon: Brain, name: "Knowledge Graph Memory", desc: "Dynamically extract conversation context via NLP (spaCy) or LLMs into a queryable semantic graph." },
  { icon: Shield, name: "Secure Sandbox", desc: "Safely execute Python and Bash inside isolated Local, Docker, or Kubernetes sandbox environments." },
  { icon: Zap, name: "Real-time SSE Streaming", desc: "Follow execution step-by-step with transparent agent_start, llm_request, and subagent_complete events." },
  { icon: Code2, name: "50+ Skill Toolkits", desc: "Google Workspace, Playwright, social media, search, and productivity tools ready out of the box." },
  { icon: Bot, name: "Human-in-the-Loop", desc: "Intervene directly in running agent discussions to steer agents or inject manual inputs." },
];

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

export default function MeetCollective() {
  return (
    <div className="min-h-screen bg-[#faf9f5] dark:bg-[#141413] text-foreground font-sans">
      {/* Minimal top bar */}
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
      <section className="max-w-7xl mx-auto px-6 pt-24 pb-20">
        <div className="max-w-3xl">
          <FadeIn>
            <p className="text-sm font-semibold text-accent uppercase tracking-widest mb-4">Meet AI Collective</p>
            <h1 className="text-5xl md:text-[64px] font-medium tracking-tight leading-[1.05] font-serif mb-6">
              A new era of<br />programmable AI
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-2xl">
              AI Collective is a high-performance multi-agent orchestration platform that lets you deploy, coordinate, and scale AI workforces — with full control over topology, tools, and execution environment.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/dashboard" className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-foreground text-background font-semibold text-sm hover:opacity-90 transition-opacity">
                Start building <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="http://localhost:2026/docs" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 h-11 px-6 rounded-lg border border-border text-foreground/80 font-semibold text-sm hover:bg-muted/30 transition-all">
                Developer docs <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Products */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-border/60">
        <FadeIn>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Products</p>
          <h2 className="text-3xl md:text-4xl font-medium font-serif mb-12">Two ways to deploy</h2>
        </FadeIn>
        <div className="grid md:grid-cols-2 gap-6">
          <FadeIn delay={0.05}>
            <div className="p-8 rounded-2xl border border-border bg-card hover:border-accent/40 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-5">
                <Bot className="w-5 h-5 text-accent" />
              </div>
              <h3 className="text-xl font-semibold font-serif mb-2">AI Collective</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                The full platform — build, configure, and monitor multi-agent teams via dashboard and REST API. Supports all topologies, toolkits, and sandbox environments.
              </p>
              <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent group-hover:gap-2.5 transition-all">
                Open console <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="p-8 rounded-2xl border border-border bg-card hover:border-accent/40 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-5">
                <Network className="w-5 h-5 text-accent" />
              </div>
              <h3 className="text-xl font-semibold font-serif mb-2">Agent Mesh</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                A standalone mesh orchestrator layer for integrating multi-agent routing into your existing stack. Deploy as a microservice with minimal configuration.
              </p>
              <a href="http://localhost:2026/docs" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent group-hover:gap-2.5 transition-all">
                Read the docs <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-border/60">
        <FadeIn>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Features</p>
          <h2 className="text-3xl md:text-4xl font-medium font-serif mb-12">Everything you need to orchestrate AI</h2>
        </FadeIn>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <FadeIn key={f.name} delay={0.04 * i}>
              <div className="p-6 rounded-xl border border-border bg-card hover:border-accent/30 transition-colors">
                <f.icon className="w-5 h-5 text-accent mb-4" />
                <h3 className="font-semibold text-sm mb-2">{f.name}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Models */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-border/60">
        <FadeIn>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Models</p>
          <h2 className="text-3xl md:text-4xl font-medium font-serif mb-4">Fully LLM-agnostic</h2>
          <p className="text-muted-foreground mb-12 max-w-xl">Configure, swap, or route model engines at runtime — no code changes required.</p>
        </FadeIn>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {MODELS.map((m, i) => (
            <FadeIn key={m.name} delay={0.05 * i}>
              <div className="p-5 rounded-xl border border-border bg-card hover:shadow-md transition-all">
                <div className="w-8 h-8 rounded-lg mb-4 flex items-center justify-center" style={{ background: m.color + "22" }}>
                  <div className="w-3 h-3 rounded-full" style={{ background: m.color }} />
                </div>
                <p className="text-[10px] font-mono text-muted-foreground mb-1">{m.key}</p>
                <h3 className="font-semibold text-sm mb-2">{m.name}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{m.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60 py-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <FadeIn>
            <h2 className="text-4xl md:text-5xl font-medium font-serif mb-4">Ready to build?</h2>
            <p className="text-muted-foreground mb-8">Deploy your first multi-agent workforce in minutes.</p>
            <div className="flex justify-center gap-3">
              <Link to="/dashboard" className="inline-flex items-center gap-2 h-11 px-8 rounded-lg bg-foreground text-background font-semibold text-sm hover:opacity-90 transition-opacity">
                Start building free
              </Link>
              <Link to="/pricing" className="inline-flex items-center gap-2 h-11 px-6 rounded-lg border border-border text-foreground/80 font-semibold text-sm hover:bg-muted/30 transition-all">
                View pricing
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
