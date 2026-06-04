import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, Zap, Users, Clock, Activity, CheckCircle2, ListTodo,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAgentSimulation } from "@/hooks/use-agent-simulation";
import { api, type Agent, type Analytics, type ActivityFeedItem, type Task } from "@/lib/api";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

const metricConfig = [
  { key: "completed", icon: CheckCircle2, label: "Tasks Completed" },
  { key: "active", icon: ListTodo, label: "Active Tasks" },
  { key: "efficiency", icon: Zap, label: "Department Efficiency" },
  { key: "agents", icon: Users, label: "Active Personnel" },
  { key: "time", icon: Clock, label: "Avg. Completion" },
];

const statusVariant: Record<string, string> = {
  completed: "default",
  "in-progress": "secondary",
  pending: "outline",
};

export default function Dashboard() {
  useAgentSimulation();
  const [isLoading, setIsLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const [a, an, feed, tsk] = await Promise.all([
          api.listAgents(),
          api.getAnalytics(),
          api.listActivityFeed(),
          api.listTasks(),
        ]);
        if (cancelled) return;
        setAgents(a);
        setAnalytics(an);
        setActivityFeed(feed);
        setTasks(tsk);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const agentById = useMemo(() => {
    const map = new Map<string, Agent>();
    agents.forEach((a) => map.set(a.id, a));
    return map;
  }, [agents]);

  const activeAgentsCount = agents.filter((a) => a.status === "active").length;
  const activeTasks = tasks.filter((t) => t.status === "in-progress").length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;

  const metricValues = [
    { value: String(completedTasks), trend: "+12%" },
    { value: String(activeTasks), trend: "in progress" },
    { value: `${analytics?.teamEfficiency ?? 0}%`, trend: "+5%" },
    { value: String(activeAgentsCount), trend: `of ${agents.length}` },
    { value: analytics?.avgCompletionTime ?? "—", trend: "avg time" },
  ];

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Page header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Company Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your company operations
        </p>
      </motion.div>

      {/* Metric cards */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
        variants={itemVariants}
      >
        {metricConfig.map((cfg, i) => (
          <MetricCard
            key={cfg.key}
            icon={cfg.icon}
            label={cfg.label}
            value={metricValues[i].value}
            trend={metricValues[i].trend}
            isLoading={isLoading}
          />
        ))}
      </motion.div>

      {/* Main grid */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        style={{ minHeight: "calc(100vh - 360px)" }}
        variants={itemVariants}
      >
        {/* Tasks list */}
        <div className="lg:col-span-2 glass-card flex flex-col overflow-hidden" style={{ maxHeight: "calc(100vh - 320px)" }}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Recent Projects & Tasks</h3>
            </div>
            <span className="text-xs text-muted-foreground font-medium">{tasks.length} total</span>
          </div>
          <div className="overflow-y-auto flex-1 scrollbar-thin p-3">
            <div className="space-y-2">
              {tasks.length > 0 ? (
                tasks.map((task, idx) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="p-3.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all border border-border/50 hover:border-border group cursor-default"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-foreground truncate">
                          {task.title}
                        </h4>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {task.description}
                        </p>
                      </div>
                      <Badge
                        variant={(statusVariant[task.status] ?? "outline") as any}
                        className="flex-shrink-0 capitalize text-[11px] font-semibold"
                      >
                        {task.status}
                      </Badge>
                    </div>
                    {task.progress > 0 && (
                      <div className="mt-2.5">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[11px] text-muted-foreground font-medium">Progress</span>
                          <span className="text-[11px] font-bold text-foreground/70">{task.progress}%</span>
                        </div>
                        <div className="w-full bg-muted/60 rounded-full h-1.5 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-foreground"
                            initial={{ width: 0 }}
                            animate={{ width: `${task.progress}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))
              ) : (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                      <ListTodo className="w-6 h-6 opacity-40" />
                    </div>
                    <p className="text-sm font-medium">No projects or tasks yet</p>
                    <p className="text-xs opacity-60 mt-0.5">Create a task to get started</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Activity feed */}
        <div className="glass-card flex flex-col overflow-hidden" style={{ maxHeight: "calc(100vh - 320px)" }}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Activity Feed</h3>
            </div>
            {activityFeed.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <div className="overflow-y-auto flex-1 scrollbar-thin p-3">
            {activityFeed.length > 0 ? (
              <div className="space-y-1.5">
                <AnimatePresence>
                  {activityFeed.map((item, idx) => {
                    const agent = agentById.get(item.agentId);
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.025 }}
                        className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-muted/30 transition-colors group cursor-default"
                      >
                        <div className="w-1 h-1 rounded-full bg-muted-foreground/50 mt-2 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs leading-snug">
                            <span className="font-semibold text-foreground">
                              {agent?.name || "System"}
                            </span>{" "}
                            <span className="text-muted-foreground">{item.action}</span>
                          </p>
                          <span className="text-[11px] text-muted-foreground/60 font-mono">{item.time}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground py-8">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-2.5">
                    <Activity className="w-5 h-5 opacity-40" />
                  </div>
                  <p className="text-xs font-medium">No activity yet</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  trend: string;
  isLoading?: boolean;
}

function MetricCard({ icon: Icon, label, value, trend, isLoading }: MetricCardProps) {
  return (
    <motion.div variants={itemVariants}>
      <div className="glass-card card-hover p-4 h-full">
        <div className="flex items-center justify-between mb-3">
          <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.8} />
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
            <TrendingUp className="w-3 h-3" />
            {trend}
          </div>
        </div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">{label}</p>
        {isLoading ? (
          <div className="h-6 bg-muted rounded animate-pulse w-3/4" />
        ) : (
          <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
        )}
      </div>
    </motion.div>
  );
}
