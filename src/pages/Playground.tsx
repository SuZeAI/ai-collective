import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  Zap,
  Clock,
  Users,
  Terminal,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAgentSimulation } from "@/hooks/use-agent-simulation";
import { getAgentRoleColor } from "@/lib/agent-role-ui";

const workflowSteps = [
  { label: "Planning", emoji: "📋" },
  { label: "Execution", emoji: "⚡" },
  { label: "Review", emoji: "🔍" },
  { label: "Complete", emoji: "✅" },
];

const exampleTasks = [
  {
    label: "Marketing Plan",
    task: "Create a marketing plan for an AI startup",
    category: "Marketing",
  },
  {
    label: "Competitive Analysis",
    task: "Build a competitive analysis report",
    category: "Research",
  },
  {
    label: "Product Onboarding",
    task: "Design a product onboarding flow",
    category: "Design",
  },
  {
    label: "API Documentation",
    task: "Write API documentation for a SaaS platform",
    category: "Dev",
  },
  {
    label: "Sales Strategy",
    task: "Develop a Q3 sales strategy for enterprise customers",
    category: "Business",
  },
  {
    label: "Bug Investigation",
    task: "Investigate and resolve critical backend performance issues",
    category: "Dev",
  },
];

export default function Playground() {
  const { isSimulating, messages, currentStep, runSimulation, reset } =
    useAgentSimulation();
  const [input, setInput] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const handleSubmit = (task?: string) => {
    const value = task || input.trim();
    if (value && !isSimulating) {
      runSimulation(value);
      setInput("");
    }
  };

  const uniqueAgents = [...new Set(messages.map((m) => m.role))];
  const categories = [...new Set(exampleTasks.map((t) => t.category))];
  const visibleTasks = filterCategory
    ? exampleTasks.filter((t) => t.category === filterCategory)
    : exampleTasks;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Playground</h1>
            <Badge
              variant="outline"
              className="text-xs font-mono border-primary/30 text-primary bg-primary/5"
            >
              LIVE
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Watch company personnel collaborate in real-time to complete complex tasks.
          </p>
        </div>
        {messages.length > 0 && !isSimulating && (
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            className="gap-2 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            New Task
          </Button>
        )}
      </header>

      {/* Live Stats Bar */}
      <AnimatePresence>
        {(isSimulating || messages.length > 0) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 glass-card px-4 py-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isSimulating ? "bg-agent-dev animate-pulse" : "bg-green-500"
                  }`}
                />
                <span className="text-xs font-semibold">
                  {isSimulating ? "Running" : "Completed"}
                </span>
              </div>
              <div className="h-3.5 w-px bg-border" />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                <span>
                  <strong className="text-foreground">{uniqueAgents.length}</strong>{" "}
                  personnel active
                </span>
              </div>
              <div className="h-3.5 w-px bg-border" />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Terminal className="w-3.5 h-3.5" />
                <span>
                  <strong className="text-foreground">{messages.length}</strong>{" "}
                  messages
                </span>
              </div>
              <div className="h-3.5 w-px bg-border" />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  Step{" "}
                  <strong className="text-foreground">
                    {Math.min(currentStep, workflowSteps.length)}/
                    {workflowSteps.length}
                  </strong>
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
        {/* ── Left Panel ── */}
        <div className="space-y-4">
          {/* Task Input */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Task Description</span>
            </div>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                  handleSubmit();
              }}
              placeholder="Describe a task for the team to work on together…"
              className="min-h-[96px] resize-none text-sm bg-background/50 border-border/60 focus-visible:ring-1 focus-visible:ring-primary/30"
              disabled={isSimulating}
            />
            <Button
              onClick={() => handleSubmit()}
              disabled={isSimulating || !input.trim()}
              className="w-full gap-2 shadow-lg shadow-primary/10"
            >
              {isSimulating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Personnel Working…
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" fill="currentColor" />
                  Execute Task
                </>
              )}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Tip: Press{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono border border-border">
                ⌘ Enter
              </kbd>{" "}
              to submit
            </p>
          </div>

          {/* Example Tasks */}
          {messages.length === 0 && !isSimulating && (
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground shrink-0">
                  Quick Start
                </span>
                <div className="flex gap-1 flex-wrap justify-end">
                  <button
                    onClick={() => setFilterCategory(null)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                      !filterCategory
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() =>
                        setFilterCategory(filterCategory === cat ? null : cat)
                      }
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                        filterCategory === cat
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                {visibleTasks.map((t) => (
                  <motion.button
                    key={t.task}
                    whileHover={{ x: 3 }}
                    onClick={() => handleSubmit(t.task)}
                    className="w-full text-left flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-muted/40 hover:bg-primary/8 hover:text-primary transition-colors group"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-medium block">{t.label}</span>
                      <span className="text-[10px] text-muted-foreground truncate block">
                        {t.task}
                      </span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Active Agents Panel */}
          {uniqueAgents.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-4 space-y-3"
            >
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Participating Personnel
              </span>
              <div className="space-y-2.5">
                {uniqueAgents.map((role) => {
                  const count = messages.filter((m) => m.role === role).length;
                  const pct = messages.length
                    ? Math.round((count / messages.length) * 100)
                    : 0;
                  return (
                    <div key={role} className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${getAgentRoleColor(role)}`}
                      >
                        {role[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-semibold truncate">
                            {role}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0 ml-1">
                            {count} msg
                          </span>
                        </div>
                        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-primary rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>

        {/* ── Right Panel ── */}
        <div className="space-y-4">
          {/* Workflow Progress */}
          <div className="glass-card p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5">
              Workflow Progress
            </p>
            <div className="relative flex justify-between">
              {workflowSteps.map((step, i) => {
                const isComplete = currentStep > i;
                const isActive = currentStep === i && isSimulating;
                return (
                  <div
                    key={step.label}
                    className="flex flex-col items-center gap-2 relative z-10 flex-1"
                  >
                    <motion.div
                      animate={{ scale: isActive ? [1, 1.08, 1] : 1 }}
                      transition={{
                        repeat: isActive ? Infinity : 0,
                        duration: 1.4,
                      }}
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                        isComplete
                          ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/25"
                          : isActive
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-muted/30 border-border text-muted-foreground"
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : isActive ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <span className="text-base">{step.emoji}</span>
                      )}
                    </motion.div>
                    <span
                      className={`text-xs font-semibold ${
                        isComplete || isActive
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
              {/* Track */}
              <div className="absolute top-5 left-[12.5%] right-[12.5%] h-0.5 bg-border -z-10">
                <motion.div
                  className="h-full bg-primary origin-left rounded-full"
                  animate={{
                    scaleX: Math.min(currentStep / workflowSteps.length, 1),
                  }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
          </div>

          {/* Communication Stream */}
          <div className="glass-card flex flex-col h-[500px]">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isSimulating
                      ? "bg-agent-dev animate-pulse"
                      : messages.length > 0
                      ? "bg-green-500"
                      : "bg-muted-foreground/30"
                  }`}
                />
                <span className="text-sm font-semibold">
                  Personnel Communication Stream
                </span>
              </div>
              {messages.length > 0 && (
                <span className="text-[11px] text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded-full">
                  {messages.length} messages
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, x: -10, y: 4 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex gap-3 items-start"
                  >
                    <div
                      className={`mt-0.5 w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold ${getAgentRoleColor(m.role)}`}
                    >
                      {m.role[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-sm font-semibold">{m.role}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {m.timestamp}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {m.content}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Empty State */}
              {messages.length === 0 && !isSimulating && (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Ready to run</p>
                    <p className="text-xs text-muted-foreground max-w-[200px] leading-relaxed">
                      Pick an example task or type your own to see the team
                      collaborate live.
                    </p>
                  </div>
                </div>
              )}

              {/* Initializing */}
              {isSimulating && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">
                    Initializing personnel…
                  </p>
                </div>
              )}

              {/* Typing indicator */}
              {isSimulating && (
                <div className="flex gap-1.5 pl-11 py-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
