import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { api, type Agent, type Analytics, type Task, type Team } from "@/lib/api";

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [an, ags, tks, tms] = await Promise.all([
          api.getAnalytics(),
          api.listAgents(),
          api.listTasks(),
          api.listTeams(),
        ]);
        if (cancelled) return;
        setAnalytics(an);
        setAgents(ags);
        setTasks(tks);
        setTeams(tms);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const agentById = useMemo(() => {
    const map = new Map<string, Agent>();
    agents.forEach((a) => map.set(a.id, a));
    return map;
  }, [agents]);

  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const inProgressTasks = tasks.filter((t) => t.status === "in-progress").length;

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">Team performance metrics and insights.</p>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Tasks Completed", value: String(analytics?.tasksCompleted ?? 0) },
          { label: "Avg. Completion", value: analytics?.avgCompletionTime ?? "" },
          { label: "Team Efficiency", value: `${analytics?.teamEfficiency ?? 0}%` },
          { label: "Active Teams", value: String(teams.length) },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-5"
          >
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">{card.label}</div>
            <div className="text-2xl font-bold">{card.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Agent Productivity */}
      <div className="glass-card p-6 mb-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6">Agent Productivity</h3>
        <div className="space-y-5">
          {Object.entries(analytics?.agentProductivity ?? {}).map(([agentId, value]) => {
            const agent = agentById.get(agentId);
            if (!agent) return null;
            return (
              <div key={agentId} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{agent.name}</span>
                    <span className="text-xs text-muted-foreground">{agent.role}</span>
                  </div>
                  <span className="text-sm font-bold">{value}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="h-full bg-primary rounded-full"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Task Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Completed", count: completedTasks, color: "bg-agent-dev" },
          { label: "In Progress", count: inProgressTasks, color: "bg-primary" },
          { label: "Pending", count: tasks.length - completedTasks - inProgressTasks, color: "bg-muted-foreground/30" },
        ].map((item) => (
          <div key={item.label} className="glass-card p-5 flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full ${item.color}`} />
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-widest">{item.label}</div>
              <div className="text-2xl font-bold">{item.count}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
