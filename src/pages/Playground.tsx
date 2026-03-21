import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, RotateCcw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAgentSimulation } from "@/hooks/use-agent-simulation";
import { getAgentRoleColor } from "@/lib/agent-role-ui";

const workflowSteps = ["Planning", "Execution", "Review", "Complete"];
const exampleTasks = [
  "Create a marketing plan for an AI startup",
  "Build a competitive analysis report",
  "Design a product onboarding flow",
  "Write API documentation for a SaaS platform",
];

export default function Playground() {
  const { isSimulating, messages, currentStep, runSimulation, reset } = useAgentSimulation();
  const [input, setInput] = useState("");

  const handleSubmit = (task?: string) => {
    const value = task || input.trim();
    if (value && !isSimulating) {
      runSimulation(value);
      setInput("");
    }
  };

  return (
    <div>
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="glass-card p-12 max-w-md text-center">
          <div className="mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-3">Coming Soon</h2>
          <p className="text-muted-foreground mb-4">
            This feature will be available soon. Please check back later! 🚀
          </p>
          <p className="text-xs text-muted-foreground">
            We're working hard to bring you the best experience.
          </p>
        </div>
      </div>

      {/* Previous Content (Hidden) */}
      <div style={{ display: "none" }}>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Playground</h1>
        <p className="text-muted-foreground mt-1">Test how agents collaborate on any task.</p>
      </header>

      {/* Input */}
      <div className="glass-card p-1 mb-4">
        <div className="flex items-center gap-2 p-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Describe a task for the agent team..."
            className="flex-1 border-none shadow-none text-base bg-transparent focus-visible:ring-0"
          />
          <Button onClick={() => handleSubmit()} disabled={isSimulating || !input.trim()} className="shadow-lg shadow-primary/15">
            <Play className="w-4 h-4 mr-2" fill="currentColor" />
            {isSimulating ? "Running..." : "Execute"}
          </Button>
          {messages.length > 0 && !isSimulating && (
            <Button variant="outline" onClick={reset}><RotateCcw className="w-4 h-4" /></Button>
          )}
        </div>
      </div>

      {/* Example tasks */}
      {messages.length === 0 && !isSimulating && (
        <div className="flex flex-wrap gap-2 mb-8">
          {exampleTasks.map((t) => (
            <button
              key={t}
              onClick={() => handleSubmit(t)}
              className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Workflow */}
      <div className="glass-card p-6 mb-6">
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

      {/* Stream */}
      <div className="glass-card h-[500px] flex flex-col overflow-hidden">
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
                  <p className="text-sm text-muted-foreground leading-relaxed">{m.content}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {messages.length === 0 && !isSimulating && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Pick an example task or type your own to begin.
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
    </div>
  );
}
