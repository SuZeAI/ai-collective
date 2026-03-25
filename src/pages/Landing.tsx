import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, Users, Cpu, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Cpu, title: "Specialized Agents", description: "Create agents with distinct roles — PM, researcher, developer, reviewer." },
  { icon: Users, title: "Team Collaboration", description: "Agents communicate, divide work, and produce unified results." },
  { icon: Zap, title: "Autonomous Execution", description: "Submit a task and watch your AI Collective deliver without hand-holding." },
  { icon: Shield, title: "Quality Review", description: "Built-in review agents validate every output before delivery." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 -left-16 h-80 w-80 rounded-full blur-3xl opacity-25 bg-[hsl(var(--hero-a))]" />
        <div className="absolute top-28 right-0 h-72 w-72 rounded-full blur-3xl opacity-20 bg-[hsl(var(--hero-b))]" />
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full blur-3xl opacity-20 bg-[hsl(var(--hero-c))]" />
      </div>

      {/* Nav */}
      <nav className="border-b border-border/70 bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[linear-gradient(135deg,hsl(var(--hero-a)),hsl(var(--hero-b)))] shadow-lg shadow-sky-200/60">
              <Activity className="text-primary-foreground w-4 h-4" />
            </div>
            <span className="font-bold text-lg tracking-tight">AI Collective</span>
          </div>
          <Link to="/dashboard">
            <Button>Open Dashboard <ArrowRight className="ml-2 w-4 h-4" /></Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 md:py-32 px-6 relative">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/85 border border-border/80 text-primary text-sm font-semibold mb-6 soft-ring">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Multi-Agent Collaboration Platform
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground leading-[1.05]">
              Deploy a specialized
              <br />
              <span className="hero-title">AI workforce</span> in seconds
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Create teams of AI agents that communicate, collaborate, and complete complex tasks autonomously — like a real project team.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link to="/dashboard">
                <Button size="lg" className="text-base px-8 py-6 shadow-lg shadow-primary/20">
                  Get Started <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link to="/playground">
                <Button variant="outline" size="lg" className="text-base px-8 py-6">
                  Try Playground
                </Button>
              </Link>
            </div>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              {["4x faster delivery", "92% workflow automation", "Enterprise-grade review loop"].map((item) => (
                <div key={item} className="glass-card px-4 py-3 text-sm font-semibold text-foreground">
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 border-t border-border/70">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-12">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="glass-card p-6 group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 bg-[linear-gradient(140deg,hsl(var(--hero-a))/0.17,hsl(var(--hero-b))/0.24)] group-hover:bg-[linear-gradient(140deg,hsl(var(--hero-a))/0.24,hsl(var(--hero-c))/0.26)]">
                  <f.icon className="w-5 h-5 text-primary group-hover:scale-105 transition-transform" />
                </div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center glass-card p-12 relative overflow-hidden">
          <div className="absolute inset-x-0 -top-20 h-32 bg-[radial-gradient(closest-side,hsl(var(--hero-a))/0.22,transparent)] pointer-events-none" />
          <h2 className="text-3xl font-bold tracking-tight mb-4">Ready to build your AI Collective?</h2>
          <p className="text-muted-foreground mb-8">Start orchestrating agents in minutes. No backend required.</p>
          <Link to="/dashboard">
            <Button size="lg" className="px-8 py-6 text-base shadow-lg shadow-primary/20">
              Launch Dashboard <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
