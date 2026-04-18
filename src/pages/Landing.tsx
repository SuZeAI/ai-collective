import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight, Users, Cpu, Zap, Shield, Sparkles, CheckCircle,
  Star, GitFork, Eye, GitPullRequest, ExternalLink,
} from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}
import { Button } from "@/components/ui/button";

const GITHUB_REPO = "SuZeAI/ai-collective";
const GITHUB_URL = "https://github.com/SuZeAI/ai-collective";

interface GitHubStats {
  stars: number | null;
  forks: number | null;
  watchers: number | null;
  issues: number | null;
}

function useGitHubStats(): GitHubStats {
  const [stats, setStats] = useState<GitHubStats>({
    stars: null, forks: null, watchers: null, issues: null,
  });

  useEffect(() => {
    fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
      headers: { Accept: "application/vnd.github.v3+json" },
    })
      .then((r) => r.json())
      .then((data) => {
        setStats({
          stars: data.stargazers_count ?? null,
          forks: data.forks_count ?? null,
          watchers: data.subscribers_count ?? null,
          issues: data.open_issues_count ?? null,
        });
      })
      .catch(() => {});
  }, []);

  return stats;
}

function fmt(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const features = [
  {
    icon: Cpu,
    title: "Specialized Agents",
    description: "Create agents with distinct roles — PM, researcher, developer, reviewer — each with custom skills and behaviors.",
    gradient: "from-sky-500/15 to-blue-600/10",
    iconColor: "text-sky-500",
    iconBg: "bg-sky-500/10",
    border: "border-sky-500/15",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Agents communicate, divide work, and produce unified results — just like a real high-performance project team.",
    gradient: "from-violet-500/15 to-indigo-600/10",
    iconColor: "text-violet-500",
    iconBg: "bg-violet-500/10",
    border: "border-violet-500/15",
  },
  {
    icon: Zap,
    title: "Autonomous Execution",
    description: "Submit a task and watch your AI Collective deliver without hand-holding. Full visibility throughout.",
    gradient: "from-amber-500/15 to-orange-500/10",
    iconColor: "text-amber-500",
    iconBg: "bg-amber-500/10",
    border: "border-amber-500/15",
  },
  {
    icon: Shield,
    title: "Quality Review",
    description: "Built-in reviewer agents validate every output before delivery — ensuring production-ready results.",
    gradient: "from-emerald-500/15 to-teal-600/10",
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
    border: "border-emerald-500/15",
  },
];

const platformStats = [
  { value: "4×", label: "Faster delivery" },
  { value: "92%", label: "Workflow automation" },
  { value: "∞", label: "Agent combinations" },
];

export default function Landing() {
  const github = useGitHubStats();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full blur-3xl opacity-20 bg-[hsl(var(--hero-a))]" />
        <div className="absolute top-32 right-0 h-80 w-80 rounded-full blur-3xl opacity-15 bg-[hsl(var(--hero-b))]" />
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full blur-3xl opacity-15 bg-[hsl(var(--hero-c))]" />
        <div className="absolute top-1/2 left-1/4 h-64 w-64 rounded-full blur-3xl opacity-10 bg-[hsl(272,68%,57%)]" />
      </div>

      {/* Navbar */}
      <nav className="border-b border-border/60 bg-background/85 backdrop-blur-xl sticky top-0 z-50 shadow-sm shadow-border/20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="h-10 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-sky-500/20 to-blue-600/20 border border-border/50 p-1 shadow-md shadow-sky-200/30">
              <img src="/spider.png" alt="AI Collective" className="h-full object-contain" />
            </div>
            <div>
              <span className="font-bold text-[15px] tracking-tight text-foreground block leading-none">AI Collective</span>
              <span className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-medium">Multi-Agent Platform</span>
            </div>
          </div>

          {/* Nav actions */}
          <div className="flex items-center gap-2">
            <Link to="/docs" className="hidden md:flex items-center h-8 px-3 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all">
              Docs
            </Link>
            {/* GitHub star button */}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-0 h-8 rounded-lg overflow-hidden border border-border/70 text-xs font-semibold hover:shadow-md transition-all duration-200 hover:border-border group"
            >
              <span className="flex items-center gap-1.5 px-2.5 h-full bg-muted/60 hover:bg-muted transition-colors text-foreground/80 group-hover:text-foreground border-r border-border/50">
                <GithubIcon className="w-3.5 h-3.5" />
                Star
              </span>
              <span className="flex items-center px-2.5 h-full bg-card text-foreground font-bold">
                {github.stars === null ? (
                  <span className="w-6 h-3 bg-muted rounded animate-pulse" />
                ) : (
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    {fmt(github.stars)}
                  </span>
                )}
              </span>
            </a>

            <Link to="/dashboard">
              <Button variant="outline" size="sm" className="hidden sm:flex h-8 text-xs">
                Dashboard
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button size="sm" className="h-8 text-xs shadow-md shadow-primary/20">
                Get Started <ArrowRight className="ml-1.5 w-3 h-3" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-16 md:pt-28 md:pb-20 px-6 relative">
        <div className="max-w-5xl mx-auto">
          {/* Logo */}
          <motion.div
            className="flex justify-center mb-8"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-2xl bg-[hsl(var(--hero-a))] opacity-30 scale-150" />
              <img src="/logo.png" alt="AI Collective" className="relative h-20 object-contain drop-shadow-xl" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="text-center"
          >
            {/* GitHub pill badge */}
            {/* <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-border/70 text-foreground/70 hover:text-foreground text-xs font-semibold mb-6 soft-ring shadow-sm transition-colors group"
            >
              <GithubIcon className="w-3.5 h-3.5" />
              <span className="text-muted-foreground">Open source on GitHub</span>
              {github.stars !== null && (
                <>
                  <span className="w-px h-3 bg-border/60" />
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  <span className="font-bold text-foreground">{fmt(github.stars)}</span>
                </>
              )}
              <ArrowRight className="w-3 h-3 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </a> */}

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-primary text-xs font-bold mb-8 ml-2">
              <Sparkles className="w-3.5 h-3.5" />
              Multi-Agent Collaboration Platform
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground leading-[1.05] mb-6">
              Deploy a specialized
              <br />
              <span className="hero-title">AI workforce</span>
              <br />
              in seconds
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
              Create teams of AI agents that communicate, collaborate, and complete complex tasks autonomously — like a real project team.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mb-14">
              <Link to="/dashboard">
                <Button size="lg" className="text-base px-7 h-12 shadow-lg shadow-primary/25 font-semibold">
                  Launch Dashboard <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="lg" className="text-base px-7 h-12 font-semibold gap-2">
                  <GithubIcon className="w-4 h-4" />
                  View on GitHub
                </Button>
              </a>
            </div>

            {/* Platform stats */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              {platformStats.map((s) => (
                <div key={s.label} className="glass-card px-6 py-4 text-center min-w-[120px]">
                  <div className="text-2xl font-extrabold hero-title">{s.value}</div>
                  <div className="text-xs text-muted-foreground font-medium mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 border-t border-border/60">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">How it works</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Four core capabilities that power intelligent, autonomous AI teams.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className={`glass-card card-hover p-6 border ${f.border} bg-gradient-to-br ${f.gradient}`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${f.iconBg} border ${f.border}`}>
                  <f.icon className={`w-5 h-5 ${f.iconColor}`} strokeWidth={2} />
                </div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Source section */}
      <section className="py-20 px-6 border-t border-border/60">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="glass-card p-8 md:p-10 relative overflow-hidden"
          >
            <div className="absolute inset-x-0 -top-20 h-40 bg-[radial-gradient(closest-side,hsl(222,47%,15%)/0.06,transparent)] pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
              {/* Left */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center flex-shrink-0">
                    <GithubIcon className="w-4 h-4 text-background" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Open Source</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
                  Built in public, for everyone
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-5">
                  AI Collective is fully open source. Star the repo, fork it, open issues, or contribute — we build this together.
                </p>

                {/* GitHub stats row */}
                <div className="flex flex-wrap gap-3 mb-6">
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200/70 text-amber-700 text-xs font-bold hover:bg-amber-100 transition-colors"
                  >
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    {github.stars === null ? "..." : fmt(github.stars)} Stars
                  </a>
                  <a
                    href={`${GITHUB_URL}/forks`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200/70 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors"
                  >
                    <GitFork className="w-3.5 h-3.5" />
                    {github.forks === null ? "..." : fmt(github.forks)} Forks
                  </a>
                  <a
                    href={`${GITHUB_URL}/issues`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/70 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors"
                  >
                    <GitPullRequest className="w-3.5 h-3.5" />
                    {github.issues === null ? "..." : github.issues} Issues
                  </a>
                  {github.watchers !== null && (
                    <a
                      href={`${GITHUB_URL}/watchers`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-200/70 text-violet-700 text-xs font-bold hover:bg-violet-100 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {fmt(github.watchers)} Watchers
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                    <Button className="gap-2 h-9">
                      <Star className="w-3.5 h-3.5" />
                      Star on GitHub
                    </Button>
                  </a>
                  <a href={`${GITHUB_URL}/fork`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="gap-2 h-9">
                      <GitFork className="w-3.5 h-3.5" />
                      Fork
                    </Button>
                  </a>
                  <a href={`${GITHUB_URL}/issues/new`} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" className="gap-2 h-9 text-muted-foreground hover:text-foreground">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Issue
                    </Button>
                  </a>
                </div>
              </div>

              {/* Right: repo card */}
              <div className="md:w-72 flex-shrink-0">
                <div className="rounded-xl border border-border/80 bg-muted/30 overflow-hidden text-xs font-mono">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/60 border-b border-border/60">
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <span className="text-muted-foreground text-[11px]">terminal</span>
                  </div>
                  <div className="p-4 space-y-1.5 text-[12px] leading-relaxed">
                    <div>
                      <span className="text-muted-foreground">$ </span>
                      <span className="text-foreground">git clone</span>
                    </div>
                    <div className="pl-2 text-primary/80 break-all">
                      github.com/SuZeAI/ai-collective
                    </div>
                    <div className="pt-1">
                      <span className="text-muted-foreground">$ </span>
                      <span className="text-foreground">cd ai-collective</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">$ </span>
                      <span className="text-foreground">pip install -e .</span>
                    </div>
                    <div className="pt-1 text-emerald-500 font-semibold">
                      ✓ Ready in 12s
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2.5 text-center">
                  MIT License · Python 3.11+ · FastAPI + React
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 border-t border-border/60">
        <div className="max-w-3xl mx-auto">
          <div className="glass-card p-10 relative overflow-hidden text-center">
            <div className="absolute inset-x-0 -top-16 h-32 bg-[radial-gradient(closest-side,hsl(var(--hero-a))/0.18,transparent)] pointer-events-none" />
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
              Ready to build your AI Collective?
            </h2>
            <p className="text-muted-foreground text-sm mb-8 max-w-lg mx-auto leading-relaxed">
              Start orchestrating agents in minutes. Open source, self-hostable, and fully extensible.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link to="/dashboard">
                <Button size="lg" className="shadow-lg shadow-primary/20 font-semibold h-11">
                  Launch Dashboard <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="lg" className="font-semibold gap-2 h-11">
                  <GithubIcon className="w-4 h-4" />
                  GitHub
                  {github.stars !== null && (
                    <span className="ml-1 flex items-center gap-1 text-amber-600 font-bold">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                      {fmt(github.stars)}
                    </span>
                  )}
                </Button>
              </a>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3">
              {[
                "Create unlimited agent roles",
                "Assign skills and integrations",
                "Build specialized teams",
                "Monitor tasks in real-time",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-foreground/70">
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <img src="/spider.png" alt="" className="h-5 w-5 object-contain opacity-60" />
            <span>AI Collective</span>
            <span className="text-border">·</span>
            <span>MIT License</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <GithubIcon className="w-4 h-4" />
              SuZeAI/ai-collective
            </a>
            <a
              href={`${GITHUB_URL}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Issues
            </a>
            <a
              href={`${GITHUB_URL}/blob/main/README.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
