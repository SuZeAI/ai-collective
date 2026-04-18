import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { ArrowRight, Star, GitFork, ExternalLink, ChevronRight } from "lucide-react";

const GITHUB_URL = "https://github.com/SuZeAI/ai-collective";
const GITHUB_REPO = "SuZeAI/ai-collective";

// ─── GitHub stats ─────────────────────────────────────────────────────────────
function useGitHubStats() {
  const [stars, setStars] = useState<number | null>(null);
  const [forks, setForks] = useState<number | null>(null);
  useEffect(() => {
    fetch(`https://api.github.com/repos/${GITHUB_REPO}`)
      .then((r) => r.json())
      .then((d) => { setStars(d.stargazers_count ?? null); setForks(d.forks_count ?? null); })
      .catch(() => {});
  }, []);
  return { stars, forks };
}
function fmt(n: number | null) {
  if (n === null) return null;
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

// ─── GH icon ─────────────────────────────────────────────────────────────────
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

// ─── Terminal line ────────────────────────────────────────────────────────────
interface TermLine { agent: string; color: string; text: string; delay: number }

const TERM_LINES: TermLine[] = [
  { agent: "PM Agent",       color: "#f472b6", text: 'Task received → "Research top AI frameworks 2026 and write a comparison report"', delay: 0 },
  { agent: "PM Agent",       color: "#f472b6", text: "Analyzing task complexity · Delegating to team members",                           delay: 600 },
  { agent: "Research Agent", color: "#34d399", text: "Starting web research · Querying 12 sources",                                      delay: 1300 },
  { agent: "Research Agent", color: "#34d399", text: "✓ Fetched 847 relevant documents · Synthesizing findings",                         delay: 2100 },
  { agent: "Research Agent", color: "#34d399", text: "✓ Summary ready → Passing to Developer Agent",                                     delay: 2900 },
  { agent: "Dev Agent",      color: "#60a5fa", text: "Received research brief · Writing comparison report",                              delay: 3600 },
  { agent: "Dev Agent",      color: "#60a5fa", text: "✓ Report complete · 2,400 words · 6 frameworks covered",                          delay: 4500 },
  { agent: "Reviewer Agent", color: "#a78bfa", text: "Running quality checks · Verifying accuracy",                                      delay: 5200 },
  { agent: "Reviewer Agent", color: "#a78bfa", text: "✓ Review passed · 0 issues · Confidence: 97%",                                    delay: 6000 },
  { agent: "PM Agent",       color: "#f472b6", text: "✓ Task complete · Delivered in 47s",                                              delay: 6700 },
];

function Terminal() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const timers = TERM_LINES.map((l, i) =>
      setTimeout(() => setVisible((v) => Math.max(v, i + 1)), l.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  return (
    <div ref={ref} className="rounded-xl border border-white/8 bg-zinc-950 overflow-hidden font-mono text-[13px]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6 bg-black/30">
        <span className="w-3 h-3 rounded-full bg-rose-500/70" />
        <span className="w-3 h-3 rounded-full bg-amber-500/70" />
        <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
        <span className="ml-3 text-zinc-500 text-[11px]">ai-collective · task execution</span>
      </div>
      {/* Prompt */}
      <div className="px-5 pt-4 pb-2 text-zinc-500">
        <span className="text-emerald-400">❯</span>{" "}
        <span className="text-zinc-300">ai-collective run</span>{" "}
        <span className="text-zinc-500">--team research-team --task</span>{" "}
        <span className="text-amber-300/80">"Research top AI frameworks 2026"</span>
      </div>
      {/* Output lines */}
      <div className="px-5 pb-5 space-y-1.5 min-h-[220px]">
        {TERM_LINES.slice(0, visible).map((l, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-start gap-3"
          >
            <span className="mt-0.5 text-[11px] font-bold uppercase tracking-wide shrink-0 w-28 text-right" style={{ color: l.color }}>
              {l.agent}
            </span>
            <span className="text-zinc-400 leading-relaxed">{l.text}</span>
          </motion.div>
        ))}
        {visible < TERM_LINES.length && inView && (
          <div className="flex items-center gap-1 text-zinc-600 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Feature badges (numbered like deerflow) ──────────────────────────────────
const FEATURES = [
  { n: "01", title: "Multi-Agent Architecture", desc: "Specialized agents with distinct roles — PM, Researcher, Developer, Reviewer — each with a focused system prompt." },
  { n: "02", title: "Skill System",             desc: "Attach tools and integrations to any agent: web search, Google Sheets, code execution, REST APIs, browser automation." },
  { n: "03", title: "Team Execution Modes",     desc: "Mesh mode for open collaboration or sequential mode for strict pipelines. Configure per team." },
  { n: "04", title: "Real-time Task Graph",     desc: "SVG visualization of agent interactions with pan & zoom. Watch your agents work in real time." },
  { n: "05", title: "LangGraph Powered",        desc: "The orchestration layer is built on LangGraph — battle-tested, composable, and production-ready." },
  { n: "06", title: "Self-Hosted & MIT",        desc: "Full control over your data and infrastructure. No vendor lock-in. Deploy on any cloud or on-premise." },
];

// ─── File tree section ────────────────────────────────────────────────────────
const FILE_TREE = [
  { indent: 0, type: "dir",  name: "ai-collective/" },
  { indent: 1, type: "dir",  name: "agents/" },
  { indent: 2, type: "file", name: "project_manager.py",  badge: "PM" },
  { indent: 2, type: "file", name: "research_agent.py",   badge: "Research" },
  { indent: 2, type: "file", name: "developer_agent.py",  badge: "Dev" },
  { indent: 2, type: "file", name: "reviewer_agent.py",   badge: "Review" },
  { indent: 1, type: "dir",  name: "skills/" },
  { indent: 2, type: "file", name: "web_search.py",      badge: null },
  { indent: 2, type: "file", name: "google_sheets.py",   badge: null },
  { indent: 2, type: "file", name: "code_executor.py",   badge: null },
  { indent: 2, type: "file", name: "browser_use.py",     badge: null },
  { indent: 1, type: "dir",  name: "teams/" },
  { indent: 2, type: "file", name: "research_team.yaml", badge: null },
  { indent: 2, type: "file", name: "dev_team.yaml",      badge: null },
];

const BADGE_COLORS: Record<string, string> = {
  PM:       "bg-pink-500/15 text-pink-300 border-pink-500/20",
  Research: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  Dev:      "bg-blue-500/15 text-blue-300 border-blue-500/20",
  Review:   "bg-violet-500/15 text-violet-300 border-violet-500/20",
};

// ─── Fade-in section wrapper ──────────────────────────────────────────────────
function FadeIn({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Landing() {
  const { stars, forks } = useGitHubStats();

  return (
    <div className="min-h-screen bg-[#080c14] text-zinc-100 font-sans">
      {/* Subtle grid pattern */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* ── Navbar ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/6 bg-[#080c14]/90 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <img src="/spider.png" alt="" className="h-7 w-7 object-contain opacity-90" />
            <span className="font-bold text-[15px] tracking-tight text-white">AI Collective</span>
          </Link>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* <Link to="/docs" className="hidden sm:flex items-center h-8 px-3 text-xs font-medium text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
              Docs
            </Link> */}
            {/* <Link to="/dashboard" className="hidden sm:flex items-center h-8 px-3 text-xs font-medium text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
              Dashboard
            </Link> */}

            {/* GitHub star button */}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center h-8 rounded-lg overflow-hidden border border-white/10 text-xs font-semibold hover:border-white/20 transition-all group"
            >
              <span className="flex items-center gap-1.5 px-3 h-full bg-white/5 hover:bg-white/8 transition-colors text-zinc-300 group-hover:text-white border-r border-white/8">
                <GithubIcon className="w-3.5 h-3.5" />
                Star
              </span>
              <span className="flex items-center gap-1 px-2.5 h-full text-zinc-200 font-bold">
                {stars === null
                  ? <span className="w-6 h-2.5 rounded bg-zinc-700 animate-pulse" />
                  : <><Star className="w-3 h-3 text-amber-400 fill-amber-400" />{fmt(stars)}</>
                }
              </span>
            </a>

            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-white text-zinc-900 text-xs font-bold hover:bg-zinc-100 transition-colors"
            >
              Get Started
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="pt-24 pb-20 px-6 text-center relative">
        {/* Radial glow */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.12),transparent_70%)]" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative max-w-4xl mx-auto"
        >
          {/* Badge */}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/4 text-zinc-400 text-xs font-medium mb-8 hover:border-white/20 hover:text-zinc-300 transition-all"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Open Source · MIT License
            <ChevronRight className="w-3 h-3 opacity-50" />
          </a>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6 text-white">
            An open-source AI collective
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-violet-400 to-pink-400">
              that researches, codes,
            </span>
            <br />
            and creates
          </h1>

          <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-10">
            Build specialized agent teams — each with their own role, skills, and memory.
            Submit a task, watch them collaborate, get production-ready results.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-white text-zinc-900 font-bold text-sm hover:bg-zinc-100 transition-colors shadow-lg shadow-white/5"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/docs"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-lg border border-white/10 bg-white/4 text-zinc-300 font-semibold text-sm hover:border-white/20 hover:text-white transition-all"
            >
              Read the Docs
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-lg border border-white/10 bg-white/4 text-zinc-300 font-semibold text-sm hover:border-white/20 hover:text-white transition-all"
            >
              <GithubIcon className="w-4 h-4" />
              GitHub
              {stars !== null && (
                <span className="flex items-center gap-1 text-amber-400 font-bold ml-1">
                  <Star className="w-3 h-3 fill-amber-400" />
                  {fmt(stars)}
                </span>
              )}
            </a>
          </div>
        </motion.div>
      </section>

      {/* ── Terminal demo ─────────────────────────────────────────────────────── */}
      <section className="px-6 pb-24 max-w-4xl mx-auto">
        <FadeIn>
          <Terminal />
        </FadeIn>
      </section>

      {/* ── Features (numbered badges) ────────────────────────────────────────── */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
        <FadeIn>
          <div className="mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">What's included</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Everything you need to build<br />AI-powered workflows
            </h2>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/6 border border-white/6 rounded-2xl overflow-hidden">
          {FEATURES.map((f, i) => (
            <FadeIn key={f.n} delay={i * 0.06}>
              <div className="bg-[#080c14] p-6 h-full hover:bg-white/[0.02] transition-colors group">
                <div className="text-[11px] font-black text-zinc-600 mb-4 font-mono group-hover:text-blue-500/60 transition-colors">{f.n}</div>
                <h3 className="text-sm font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── File tree + description ───────────────────────────────────────────── */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <FadeIn>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Modular by design</p>
            <h2 className="text-3xl font-bold text-white tracking-tight mb-4">
              Compose agents,<br />skills, and teams
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-6">
              Every agent is a configurable unit. Assign any combination of skills — web search, code execution,
              Google integrations, custom APIs — and compose them into teams with a single config.
            </p>
            <div className="space-y-2 text-sm text-zinc-400">
              {[
                "40+ built-in agent role templates",
                "10+ integrations out of the box",
                "Custom JavaScript skill support",
                "REST API for programmatic control",
              ].map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                  {t}
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="rounded-xl border border-white/8 bg-zinc-950 font-mono text-[13px] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6 bg-black/30">
                <span className="w-3 h-3 rounded-full bg-rose-500/70" />
                <span className="w-3 h-3 rounded-full bg-amber-500/70" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
                <span className="ml-2 text-zinc-600 text-[11px]">project structure</span>
              </div>
              <div className="p-5 space-y-1">
                {FILE_TREE.map((node, i) => (
                  <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${node.indent * 20}px` }}>
                    <span className="text-zinc-600 select-none">
                      {node.type === "dir" ? "📁" : "📄"}
                    </span>
                    <span className={node.type === "dir" ? "text-blue-400 font-medium" : "text-zinc-300"}>
                      {node.name}
                    </span>
                    {node.badge && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${BADGE_COLORS[node.badge] ?? ""}`}>
                        {node.badge}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Open source CTA ──────────────────────────────────────────────────── */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
        <FadeIn>
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-10 md:p-14 relative overflow-hidden">
            {/* Glow */}
            <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-48 bg-[radial-gradient(ellipse,rgba(99,102,241,0.15),transparent_70%)]" />

            <div className="relative text-center max-w-2xl mx-auto">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Open Source</p>
              <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-4">
                Originated from Open Source,<br />give back to Open Source
              </h2>
              <p className="text-zinc-400 mb-8 leading-relaxed">
                AI Collective is MIT-licensed and built in public. Star the repo, fork it, open issues,
                or contribute — this is your platform too.
              </p>

              {/* GitHub stats */}
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/4 text-sm font-bold text-zinc-300 hover:border-white/20 hover:text-white transition-all"
                >
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  {stars === null ? "—" : fmt(stars)} Stars
                </a>
                <a
                  href={`${GITHUB_URL}/forks`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/4 text-sm font-bold text-zinc-300 hover:border-white/20 hover:text-white transition-all"
                >
                  <GitFork className="w-4 h-4 text-blue-400" />
                  {forks === null ? "—" : fmt(forks)} Forks
                </a>
                <a
                  href={`${GITHUB_URL}/issues`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/4 text-sm font-bold text-zinc-300 hover:border-white/20 hover:text-white transition-all"
                >
                  <ExternalLink className="w-4 h-4 text-violet-400" />
                  Open Issues
                </a>
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 h-10 px-6 rounded-lg bg-white text-zinc-900 font-bold text-sm hover:bg-zinc-100 transition-colors"
                >
                  <GithubIcon className="w-4 h-4" />
                  Star on GitHub
                </a>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 h-10 px-6 rounded-lg border border-white/10 bg-white/4 text-zinc-300 font-semibold text-sm hover:border-white/20 hover:text-white transition-all"
                >
                  Launch App
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/6 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-600">
          <div className="flex items-center gap-2">
            <img src="/spider.png" alt="" className="h-5 w-5 object-contain opacity-40" />
            <span>© 2026 AI Collective · MIT License</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/docs" className="hover:text-zinc-300 transition-colors">Docs</Link>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors flex items-center gap-1.5">
              <GithubIcon className="w-3.5 h-3.5" />
              GitHub
            </a>
            <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">Issues</a>
            <a href={`${GITHUB_URL}/blob/main/README.md`} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">README</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
