import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, Users, Cpu, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Cpu, title: "Specialized Agents", description: "Create agents with distinct roles — PM, researcher, developer, reviewer." },
  { icon: Users, title: "Team Collaboration", description: "Agents communicate, divide work, and produce unified results." },
  { icon: Zap, title: "Autonomous Execution", description: "Submit a task and watch your AI team deliver without hand-holding." },
  { icon: Shield, title: "Quality Review", description: "Built-in review agents validate every output before delivery." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Activity className="text-primary-foreground w-4 h-4" />
            </div>
            <span className="font-bold text-lg tracking-tight">AI Team</span>
          </div>
          <Link to="/dashboard">
            <Button>Open Dashboard <ArrowRight className="ml-2 w-4 h-4" /></Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Multi-Agent Collaboration Platform
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground leading-[1.05]">
              Deploy a specialized
              <br />
              <span className="text-primary">AI workforce</span> in seconds
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
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-12">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="glass-card p-6"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-primary" />
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
        <div className="max-w-3xl mx-auto text-center glass-card p-12">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Ready to build your AI team?</h2>
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
