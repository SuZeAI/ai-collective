import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Bot, Building2, Code2, FlaskConical, Banknote, Stethoscope, Scale } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";

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

const USE_CASES = [
  { icon: Bot, title: "AI Staff", desc: "Build autonomous staff workforces that browse the web, write code, analyze data, and communicate in natural language — all orchestrated by the platform.", tags: ["Multi-Staff Mesh", "Subagent Delegation", "Tool Integration"] },
  { icon: Code2, title: "Data Pipelines", desc: "Automate complex data extraction, transformation, and loading workflows using specialized staff chained in Sequential or Supervisor topologies.", tags: ["Sequential Topology", "SSE Streaming", "RabbitMQ Backend"] },
  { icon: FlaskConical, title: "Code Review", desc: "Deploy code review staff that run static analysis, execute sandboxed tests, and collaborate via ring-debate to surface critical vulnerabilities.", tags: ["Sandbox Execution", "Ring Topology", "Docker / K8s"] },
];

const INDUSTRIES = [
  { icon: Banknote, name: "FinTech", desc: "Multi-staff analyst workforces for real-time market monitoring, anomaly detection, and report generation." },
  { icon: Scale, name: "Legal", desc: "Automated document analysis, contract comparison, and regulatory compliance checking at scale." },
  { icon: Stethoscope, name: "Healthcare", desc: "Orchestrate clinical note processing, research synthesis, and patient triage workflows securely." },
];

export default function Solutions() {
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
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-16 text-center">
        <FadeIn>
          <p className="text-sm font-semibold text-accent uppercase tracking-widest mb-4">{m.solutions.badge}</p>
          <h1 className="text-5xl md:text-[64px] font-medium tracking-tight leading-[1.05] font-serif mb-6">{m.solutions.h1}</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">{m.solutions.sub}</p>
        </FadeIn>
      </section>

      {/* Use Cases */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-border/60">
        <FadeIn>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">{m.solutions.useCasesLabel}</p>
          <h2 className="text-3xl md:text-4xl font-medium font-serif mb-12">{m.solutions.useCasesTitle}</h2>
        </FadeIn>
        <div className="grid md:grid-cols-3 gap-6">
          {USE_CASES.map((uc, i) => (
            <FadeIn key={uc.title} delay={0.05 * i}>
              <div className="p-7 rounded-2xl border border-border bg-card hover:border-accent/30 transition-colors h-full flex flex-col">
                <uc.icon className="w-5 h-5 text-accent mb-5" />
                <h3 className="text-xl font-semibold font-serif mb-3">{uc.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-1">{uc.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {uc.tags.map((tag) => (
                    <span key={tag} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground border border-border/60">{tag}</span>
                  ))}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Company Size */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-border/60">
        <FadeIn>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">{m.solutions.sizeLabel}</p>
          <h2 className="text-3xl md:text-4xl font-medium font-serif mb-12">{m.solutions.sizeTitle}</h2>
        </FadeIn>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { icon: Bot, label: "Startups", desc: "Get to market faster with pre-built staff topologies and open-source self-hosting. Zero infrastructure cost to prototype.", link: "/dashboard", cta: m.common.startBuilding },
            { icon: Building2, label: "Enterprise", desc: "Scale with dedicated RabbitMQ clusters, custom SLA agreements, custom integrations, and 24/7 engineering support.", link: "/contact-sales", cta: m.common.contactSales },
          ].map((cs, i) => (
            <FadeIn key={cs.label} delay={0.05 * i}>
              <div className="p-8 rounded-2xl border border-border bg-card hover:border-accent/40 transition-colors group">
                <cs.icon className="w-6 h-6 text-accent mb-5" />
                <h3 className="text-2xl font-semibold font-serif mb-3">{cs.label}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">{cs.desc}</p>
                <Link to={cs.link} className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent group-hover:gap-2.5 transition-all">
                  {cs.cta} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Industries */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-border/60">
        <FadeIn>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">{m.solutions.industriesLabel}</p>
          <h2 className="text-3xl md:text-4xl font-medium font-serif mb-12">{m.solutions.industriesTitle}</h2>
        </FadeIn>
        <div className="grid sm:grid-cols-3 gap-5">
          {INDUSTRIES.map((ind, i) => (
            <FadeIn key={ind.name} delay={0.05 * i}>
              <div className="p-6 rounded-xl border border-border bg-card hover:border-accent/30 transition-colors">
                <ind.icon className="w-5 h-5 text-accent mb-4" />
                <h3 className="font-semibold mb-2">{ind.name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{ind.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60 py-20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <FadeIn>
            <h2 className="text-4xl font-medium font-serif mb-4">{m.solutions.ctaTitle}</h2>
            <p className="text-muted-foreground mb-8">{m.solutions.ctaSub}</p>
            <div className="flex justify-center gap-3">
              <Link to="/contact-sales" className="inline-flex items-center gap-2 h-11 px-8 rounded-lg bg-foreground text-background font-semibold text-sm hover:opacity-90 transition-opacity">
                {m.common.contactSales}
              </Link>
              <Link to="/dashboard" className="inline-flex items-center gap-2 h-11 px-6 rounded-lg border border-border font-semibold text-sm hover:bg-muted/30 transition-all">
                {m.common.startBuilding}
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
