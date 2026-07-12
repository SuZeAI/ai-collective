import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Bot, Brain, Shield, Zap, Network, Code2, ExternalLink, ChevronRight } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { API_DOCS_URL } from "@/lib/api";

const MODELS = [
  { key: "gemini-3-flash-preview", color: "hsl(220 80% 55%)", desc: "Default speed engine, optimized for entity extraction and real-time knowledge graphs." },
  { key: "claude-sonnet-4", color: "hsl(25 80% 55%)", desc: "Premier logic engine for multi-staff mesh coordinator and advanced code generation." },
  { key: "gpt-4o", color: "hsl(150 60% 45%)", desc: "Highly reliable engine for strict JSON schema enforcement and tool binding." },
  { key: "qwen3.5-397B", color: "hsl(280 60% 55%)", desc: "High-parameter open-weight engine for self-hosted, air-gapped secure clusters." },
];

const MODEL_NAMES = ["Google Gemini", "Anthropic Claude", "OpenAI GPT-4o", "Qwen (Open Weight)"];

const FEATURE_ICONS = [Network, Brain, Shield, Zap, Code2, Bot];
const FEATURE_DATA = [
  { name: "Multi-Staff Topologies", desc: "Sequential, Ring, Mesh, Supervisor, and Tree orchestration patterns for every use case." },
  { name: "Knowledge Graph Memory", desc: "Dynamically extract meeting context via NLP (spaCy) or LLMs into a queryable semantic graph." },
  { name: "Secure Sandbox", desc: "Safely execute Python and Bash inside isolated Local, Docker, or Kubernetes sandbox environments." },
  { name: "Real-time SSE Streaming", desc: "Follow execution step-by-step with transparent agent_start, llm_request, and subagent_complete events." },
  { name: "50+ Skill Toolkits", desc: "Google Company, Playwright, social media, search, and productivity tools ready out of the box." },
  { name: "Human-in-the-Loop", desc: "Intervene directly in running staff discussions to steer staff or inject manual inputs." },
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
      <section className="max-w-7xl mx-auto px-6 pt-24 pb-20">
        <div className="max-w-3xl">
          <FadeIn>
            <p className="text-sm font-semibold text-accent uppercase tracking-widest mb-4">{m.meet.badge}</p>
            <h1 className="text-5xl md:text-[64px] font-medium tracking-tight leading-[1.05] font-serif mb-6">{m.meet.h1}</h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-2xl">{m.meet.sub}</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/dashboard" className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-foreground text-background font-semibold text-sm hover:opacity-90 transition-opacity">
                {m.common.startBuilding} <ArrowRight className="w-4 h-4" />
              </Link>
              <a href={API_DOCS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 h-11 px-6 rounded-lg border border-border text-foreground/80 font-semibold text-sm hover:bg-muted/30 transition-all">
                {m.common.devDocs} <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Products */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-border/60">
        <FadeIn>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">{m.meet.productsLabel}</p>
          <h2 className="text-3xl md:text-4xl font-medium font-serif mb-12">{m.meet.productsTitle}</h2>
        </FadeIn>
        <div className="grid md:grid-cols-2 gap-6">
          <FadeIn delay={0.05}>
            <div className="p-8 rounded-2xl border border-border bg-card hover:border-accent/40 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-5">
                <Bot className="w-5 h-5 text-accent" />
              </div>
              <h3 className="text-xl font-semibold font-serif mb-2">{m.meet.product1Name}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">{m.meet.product1Desc}</p>
              <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent group-hover:gap-2.5 transition-all">
                {m.meet.product1Cta} <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="p-8 rounded-2xl border border-border bg-card hover:border-accent/40 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-5">
                <Network className="w-5 h-5 text-accent" />
              </div>
              <h3 className="text-xl font-semibold font-serif mb-2">{m.meet.product2Name}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">{m.meet.product2Desc}</p>
              <a href={API_DOCS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent group-hover:gap-2.5 transition-all">
                {m.meet.product2Cta} <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-border/60">
        <FadeIn>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">{m.meet.featuresLabel}</p>
          <h2 className="text-3xl md:text-4xl font-medium font-serif mb-12">{m.meet.featuresTitle}</h2>
        </FadeIn>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURE_DATA.map((f, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <FadeIn key={f.name} delay={0.04 * i}>
                <div className="p-6 rounded-xl border border-border bg-card hover:border-accent/30 transition-colors">
                  <Icon className="w-5 h-5 text-accent mb-4" />
                  <h3 className="font-semibold text-sm mb-2">{f.name}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </section>

      {/* Models */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-border/60">
        <FadeIn>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">{m.meet.modelsLabel}</p>
          <h2 className="text-3xl md:text-4xl font-medium font-serif mb-4">{m.meet.modelsTitle}</h2>
          <p className="text-muted-foreground mb-12 max-w-xl">{m.meet.modelsSub}</p>
        </FadeIn>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {MODELS.map((mod, i) => (
            <FadeIn key={mod.key} delay={0.05 * i}>
              <div className="p-5 rounded-xl border border-border bg-card hover:shadow-md transition-all">
                <div className="w-8 h-8 rounded-lg mb-4 flex items-center justify-center" style={{ background: mod.color + "22" }}>
                  <div className="w-3 h-3 rounded-full" style={{ background: mod.color }} />
                </div>
                <p className="text-[10px] font-mono text-muted-foreground mb-1">{mod.key}</p>
                <h3 className="font-semibold text-sm mb-2">{MODEL_NAMES[i]}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{mod.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60 py-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <FadeIn>
            <h2 className="text-4xl md:text-5xl font-medium font-serif mb-4">{m.meet.ctaTitle}</h2>
            <p className="text-muted-foreground mb-8">{m.meet.ctaSub}</p>
            <div className="flex justify-center gap-3">
              <Link to="/dashboard" className="inline-flex items-center gap-2 h-11 px-8 rounded-lg bg-foreground text-background font-semibold text-sm hover:opacity-90 transition-opacity">
                {m.meet.ctaFree}
              </Link>
              <Link to="/pricing" className="inline-flex items-center gap-2 h-11 px-6 rounded-lg border border-border text-foreground/80 font-semibold text-sm hover:bg-muted/30 transition-all">
                {m.common.viewPricing}
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
