import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ExternalLink, Github, BookOpen, ArrowRight, Rss } from "lucide-react";
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

const RESOURCE_CARDS = [
  {
    icon: BookOpen,
    label: "Documentation",
    title: "Developer Docs",
    desc: "Full API reference, topology guides, tool integration recipes, and deployment playbooks for the AI Collective platform.",
    href: "http://localhost:2026/docs",
    external: true,
    cta: "Open docs",
  },
  {
    icon: Github,
    label: "Open Source",
    title: "GitHub Repository",
    desc: "Explore the source code, contribute, file issues, and track the development of AI Collective on GitHub.",
    href: GITHUB_URL,
    external: true,
    cta: "View on GitHub",
  },
  {
    icon: Rss,
    label: "Updates",
    title: "Changelog",
    desc: "Follow every release — new topologies, toolkit additions, performance improvements, and breaking changes.",
    href: "/changelog",
    external: false,
    cta: "See changelog",
  },
];

const LATEST_ARTICLES = [
  {
    date: "Jun 2026",
    title: "Building a Financial Analyst Ring Topology with AI Collective",
    desc: "A practical walkthrough of setting up a multi-round debate ring to surface consensus market signals from raw data.",
    tag: "Tutorial",
  },
  {
    date: "May 2026",
    title: "Kubernetes Sandbox Provisioner: Deep Dive",
    desc: "How to configure the sandbox provisioner for air-gapped enterprise Kubernetes clusters with custom resource policies.",
    tag: "Engineering",
  },
  {
    date: "Apr 2026",
    title: "LLM-Based Knowledge Graph Extraction: When to Use It",
    desc: "Comparing static spaCy extraction vs. LLM-based extraction for different conversation complexity thresholds.",
    tag: "Research",
  },
  {
    date: "Apr 2026",
    title: "Concurrent Agent Communication with max_concurrent",
    desc: "How the new max_concurrent parameter enables parallel hub-to-agent queries in the Mesh orchestrator.",
    tag: "Feature",
  },
];

export default function Resources() {
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
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-16 text-center">
        <FadeIn>
          <p className="text-sm font-semibold text-accent uppercase tracking-widest mb-4">Resources</p>
          <h1 className="text-5xl md:text-[64px] font-medium tracking-tight leading-[1.05] font-serif mb-6">
            Everything you need<br />to ship faster
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Guides, reference docs, the changelog, and community resources — all in one place.
          </p>
        </FadeIn>
      </section>

      {/* Resource Cards */}
      <section className="max-w-7xl mx-auto px-6 pb-20 border-t border-border/60 pt-16">
        <div className="grid md:grid-cols-3 gap-6">
          {RESOURCE_CARDS.map((card, i) => (
            <FadeIn key={card.title} delay={0.05 * i}>
              <div className="p-7 rounded-2xl border border-border bg-card hover:border-accent/30 transition-colors group h-full flex flex-col">
                <div className="flex items-center justify-between mb-5">
                  <card.icon className="w-5 h-5 text-accent" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{card.label}</span>
                </div>
                <h3 className="text-xl font-semibold font-serif mb-3">{card.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-1">{card.desc}</p>
                {card.external ? (
                  <a href={card.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent group-hover:gap-2.5 transition-all">
                    {card.cta} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <Link to={card.href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent group-hover:gap-2.5 transition-all">
                    {card.cta} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Latest Articles */}
      <section className="border-t border-border/60 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <FadeIn>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">From the Team</p>
            <h2 className="text-3xl md:text-4xl font-medium font-serif mb-12">Latest articles & guides</h2>
          </FadeIn>
          <div className="grid sm:grid-cols-2 gap-6">
            {LATEST_ARTICLES.map((article, i) => (
              <FadeIn key={article.title} delay={0.05 * i}>
                <div className="p-6 rounded-xl border border-border bg-card hover:border-accent/30 transition-colors group cursor-pointer">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                      article.tag === "Tutorial" ? "bg-accent/10 text-accent" :
                      article.tag === "Engineering" ? "bg-blue-500/10 text-blue-400" :
                      article.tag === "Research" ? "bg-purple-500/10 text-purple-400" :
                      "bg-green-500/10 text-green-400"
                    }`}>{article.tag}</span>
                    <span className="text-xs text-muted-foreground">{article.date}</span>
                  </div>
                  <h3 className="font-semibold mb-2 group-hover:text-accent transition-colors">{article.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{article.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="border-t border-border/60 py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <FadeIn>
            <h2 className="text-3xl font-medium font-serif mb-3">Stay up to date</h2>
            <p className="text-muted-foreground mb-8">Product updates, new toolkits, and engineering deep-dives — monthly, no spam.</p>
            <form className="flex gap-2 max-w-sm mx-auto" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 h-10 px-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-muted-foreground"
              />
              <button type="submit" className="h-10 px-5 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap">
                Subscribe
              </button>
            </form>
            <p className="text-xs text-muted-foreground mt-3">Unsubscribe at any time.</p>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
