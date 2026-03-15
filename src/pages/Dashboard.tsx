import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAgentSimulation } from "@/hooks/use-agent-simulation";
import { getAgentRoleColor } from "@/data/mock-data";
import { agents as defaultAgents, teams, tasks, activityFeed, getAgent, analyticsData } from "@/data/mock-data";

const workflowSteps = ["Planning", "Execution", "Review", "Complete"];

export default function Dashboard() {
  const { isSimulating, messages, currentStep, runSimulation } = useAgentSimulation();
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    if (input.trim() && !isSimulating) {
      runSimulation(input.trim());
      setInput("");
    }
  };

  return (
    <div>
      <header className="mb-8 flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your multi-agent workspace.</p>
        </div>
        <div className="flex gap-6">
          <StatCard label="Tasks Done" value={String(analyticsData.tasksCompleted)} />
          <StatCard label="Efficiency" value={`${analyticsData.teamEfficiency}%`} />
          <StatCard label="Active Agents" value={String(defaultAgents.filter(a => a.status === "active").length)} />
        </div>
      </header>

      {/* Quick Task Input */}
      <section className="glass-card p-1 mb-8">
        <div className="flex items-center gap-2 p-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Assign a task to the team..."
            className="flex-1 border-none shadow-none text-base bg-transparent focus-visible:ring-0"
          />
          <Button onClick={handleSubmit} disabled={isSimulating || !input.trim()} className="shadow-lg shadow-primary/15">
            <Play className="w-4 h-4 mr-2" fill="currentColor" />
            {isSimulating ? "Running..." : "Execute"}
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Workflow + Chat */}
        <div className="lg:col-span-2 space-y-6">
          {/* Workflow Steps */}
          <div className="glass-card p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6">Live Workflow</h3>
            <div className="flex justify-between relative">
              {workflowSteps.map((label, i) => (
                <div key={label} className="flex flex-col items-center gap-2 relative z-10">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${
                    currentStep > i ? "bg-primary border-primary/20 text-primary-foreground" : "bg-card border-border text-muted-foreground"
                  }`}>
                    {currentStep > i ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-2 h-2 bg-current rounded-full" />}
                  </div>
                  <span className={`text-xs font-bold uppercase tracking-tight ${currentStep > i ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                </div>
              ))}
              <div className="absolute top-5 left-0 w-full h-[2px] bg-border -z-0" />
            </div>
          </div>

          {/* Agent Communication Stream */}
          <div className="glass-card h-[420px] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-agent-dev animate-pulse" />
              <span className="text-sm font-medium text-muted-foreground">Agent Communication Stream</span>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex gap-4 items-start"
                  >
                    <div className={`mt-0.5 w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold ${getAgentRoleColor(m.role)}`}>
                      {m.role[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{m.role}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{m.timestamp}</span>
                      </div>
                      <p className="text-muted-foreground text-sm leading-relaxed">{m.content}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {messages.length === 0 && !isSimulating && (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Submit a task above to see agents collaborate.
                </div>
              )}
              {isSimulating && (
                <div className="flex gap-1.5 p-2">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Team + Activity */}
        <div className="space-y-6">
          <div className="glass-card bg-foreground text-background p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-4">Active Team</h3>
            <h2 className="text-xl font-bold mb-5">{teams[0].name}</h2>
            <div className="space-y-3">
              {teams[0].agents.map((agentId) => {
                const agent = getAgent(agentId);
                if (!agent) return null;
                return (
                  <div key={agentId} className="flex items-center justify-between p-3 rounded-xl bg-background/5 border border-background/10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                        {agent.avatar}
                      </div>
                      <div>
                        <div className="text-sm font-bold">{agent.name}</div>
                        <div className="text-[10px] uppercase tracking-wide opacity-60">{agent.role}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-primary capitalize">{agent.status}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {activityFeed.map((item) => {
                const agent = getAgent(item.agentId);
                return (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div>
                      <p className="text-sm"><span className="font-semibold">{agent?.name}</span> {item.action}</p>
                      <span className="text-[10px] text-muted-foreground font-mono">{item.time}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
