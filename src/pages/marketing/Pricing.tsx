import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, ArrowRight, ExternalLink, Zap } from "lucide-react";
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

const GITHUB_URL = "https://github.com/SuZeAI/ai-collective";

const PLAN_FEATURES = [
  [
    "All agent topologies (Sequential, Ring, Mesh, Supervisor)",
    "50+ atomic skill toolkits",
    "Local JSON backend",
    "Real-time SSE streaming",
    "Knowledge Graph extraction (spaCy)",
    "Community support via GitHub",
  ],
  [
    "Everything in Open Source",
    "Managed Docker + RabbitMQ backend",
    "LLM-based Knowledge Graph extraction",
    "Kubernetes sandbox environments",
    "Advanced token budget analytics",
    "Human-in-the-Loop real-time steering",
    "Email + Slack support (48h SLA)",
  ],
  [
    "Everything in Pro",
    "Custom agent topology design",
    "Custom API & database integrations",
    "Managed high-throughput RabbitMQ/Redis clusters",
    "Air-gapped / on-premise deployment",
    "Dedicated engineering support (24/7)",
    "Custom SLA guarantees",
  ],
];

const API_TIERS = [
  { model: "Gemini 2.0 Flash", input: "$0.075", output: "$0.30", note: "Per 1M tokens" },
  { model: "Claude 3.5 Sonnet", input: "$3.00", output: "$15.00", note: "Per 1M tokens" },
  { model: "GPT-4o", input: "$2.50", output: "$10.00", note: "Per 1M tokens" },
  { model: "Qwen (self-hosted)", input: "Free", output: "Free", note: "Bring your own compute" },
];

export default function Pricing() {
  const { t } = useLanguage();
  const m = t.marketing;

  const plans = [
    { nameKey: m.pricing.plan1Name, priceKey: m.pricing.plan1Price, periodKey: m.pricing.plan1Period, descKey: m.pricing.plan1Desc, ctaKey: m.pricing.plan1Cta, href: GITHUB_URL, external: true, highlighted: false },
    { nameKey: m.pricing.plan2Name, priceKey: m.pricing.plan2Price, periodKey: m.pricing.plan2Period, descKey: m.pricing.plan2Desc, ctaKey: m.pricing.plan2Cta, href: "/dashboard", external: false, highlighted: true },
    { nameKey: m.pricing.plan3Name, priceKey: m.pricing.plan3Price, periodKey: m.pricing.plan3Period, descKey: m.pricing.plan3Desc, ctaKey: m.pricing.plan3Cta, href: "/contact-sales", external: false, highlighted: false },
  ];

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
          <p className="text-sm font-semibold text-accent uppercase tracking-widest mb-4">{m.pricing.badge}</p>
          <h1 className="text-5xl md:text-[64px] font-medium tracking-tight leading-[1.05] font-serif mb-6">{m.pricing.h1}</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">{m.pricing.sub}</p>
        </FadeIn>
      </section>

      {/* Plans */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <FadeIn key={plan.nameKey} delay={0.05 * i}>
              <div className={`flex flex-col h-full rounded-2xl border p-8 transition-all ${plan.highlighted ? "border-accent bg-accent/5 ring-1 ring-accent/20 shadow-lg shadow-accent/10" : "border-border bg-card"}`}>
                {plan.highlighted && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-accent mb-4">
                    <Zap className="w-3.5 h-3.5" /> Most popular
                  </div>
                )}
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{plan.nameKey}</p>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-4xl font-bold font-serif">{plan.priceKey}</span>
                  <span className="text-sm text-muted-foreground">{plan.periodKey}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6 min-h-[2.5rem]">{plan.descKey}</p>
                {plan.external ? (
                  <a href={plan.href} target="_blank" rel="noopener noreferrer"
                    className={`inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold mb-8 transition-all ${plan.highlighted ? "bg-foreground text-background hover:opacity-90" : "border border-border hover:bg-muted/40"}`}>
                    {plan.ctaKey} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <Link to={plan.href}
                    className={`inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold mb-8 transition-all ${plan.highlighted ? "bg-foreground text-background hover:opacity-90" : "border border-border hover:bg-muted/40"}`}>
                    {plan.ctaKey} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
                <ul className="space-y-3 mt-auto">
                  {PLAN_FEATURES[i].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* API Pricing */}
      <section className="border-t border-border/60 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <FadeIn>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">{m.pricing.apiLabel}</p>
            <h2 className="text-3xl md:text-4xl font-medium font-serif mb-4">{m.pricing.apiTitle}</h2>
            <p className="text-muted-foreground mb-10">{m.pricing.apiSub}</p>
          </FadeIn>
          <FadeIn delay={0.08}>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold">Model</th>
                    <th className="text-right px-5 py-3 font-semibold">Input</th>
                    <th className="text-right px-5 py-3 font-semibold">Output</th>
                    <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {API_TIERS.map((row) => (
                    <tr key={row.model} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5 font-medium">{row.model}</td>
                      <td className="px-5 py-3.5 text-right font-mono text-accent">{row.input}</td>
                      <td className="px-5 py-3.5 text-right font-mono text-accent">{row.output}</td>
                      <td className="px-5 py-3.5 text-right text-muted-foreground text-xs">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60 py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <FadeIn>
            <h2 className="text-4xl font-medium font-serif mb-4">{m.pricing.ctaTitle}</h2>
            <p className="text-muted-foreground mb-8">{m.pricing.ctaSub}</p>
            <div className="flex justify-center gap-3">
              <Link to="/contact-sales" className="inline-flex items-center gap-2 h-11 px-8 rounded-lg bg-foreground text-background font-semibold text-sm hover:opacity-90 transition-opacity">
                {m.common.contactSales}
              </Link>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 h-11 px-6 rounded-lg border border-border font-semibold text-sm hover:bg-muted/30 transition-all">
                {m.pricing.ctaGithub} <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
