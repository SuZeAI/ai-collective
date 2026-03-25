import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Zap,
  Users,
  Clock,
  Activity,
  CheckCircle2,
  ListTodo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useAgentSimulation } from "@/hooks/use-agent-simulation";
import { getAgentRoleColor } from "@/lib/agent-role-ui";
import { api, type Agent, type Team, type Analytics, type ActivityFeedItem, type Task } from "@/lib/api";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4 },
  },
};

export default function Dashboard() {
  const { isSimulating } = useAgentSimulation();
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
    return () => {
      cancelled = true;
    };
  }, []);

  const agentById = useMemo(() => {
    const map = new Map<string, Agent>();
    agents.forEach((a) => map.set(a.id, a));
    return map;
  }, [agents]);

  const activeAgentsCount = agents.filter((a) => a.status === "active").length;
  const activeTasks = tasks.filter((t) => t.status === "in-progress").length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/80">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-20 right-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl opacity-20 animate-pulse" />
        <div className="absolute bottom-20 left-20 w-72 h-72 bg-accent/10 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <motion.div
        className="space-y-4 py-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header Section */}
        <motion.header className="px-6 md:px-8" variants={itemVariants}>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage your multi-agent workspace
            </p>
          </div>
        </motion.header>

        {/* Key Metrics Row */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-5 gap-3 px-6 md:px-8"
          variants={itemVariants}
        >
          <MetricCard
            icon={CheckCircle2}
            label="Tasks Completed"
            value={String(completedTasks)}
            trend="+12%"
            isLoading={isLoading}
          />
          <MetricCard
            icon={ListTodo}
            label="Active Tasks"
            value={String(activeTasks)}
            trend="in progress"
            isLoading={isLoading}
          />
          <MetricCard
            icon={Zap}
            label="Team Efficiency"
            value={`${analytics?.teamEfficiency ?? 0}%`}
            trend="+5%"
            isLoading={isLoading}
          />
          <MetricCard
            icon={Users}
            label="Active Agents"
            value={String(activeAgentsCount)}
            trend={`of ${agents.length}`}
            isLoading={isLoading}
          />
          <MetricCard
            icon={Clock}
            label="Avg. Completion"
            value={analytics?.avgCompletionTime ?? "—"}
            trend="time"
            isLoading={isLoading}
          />
        </motion.div>

        {/* Main Content Grid */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-3 gap-4 px-6 md:px-8 h-[calc(100vh-300px)]"
          variants={itemVariants}
        >
          {/* Left: Tasks List with Scroll */}
          <div className="lg:col-span-2 flex flex-col">
            <Card className="p-4 border-0 shadow-xl bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center gap-2 mb-4 flex-shrink-0">
                <ListTodo className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  Recent Tasks
                </h3>
              </div>
              <div className="overflow-y-auto flex-1 pr-3">
                <div className="space-y-2">
                  {tasks.length > 0 ? (
                    tasks.map((task, idx) => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="p-3 rounded-lg bg-background/40 hover:bg-background/60 transition-all border border-border/50 hover:border-primary/30 group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                              {task.title}
                            </h4>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {task.description}
                            </p>
                          </div>
                          <Badge
                            variant={
                              task.status === "completed"
                                ? "default"
                                : task.status === "in-progress"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="flex-shrink-0 capitalize text-xs"
                          >
                            {task.status}
                          </Badge>
                        </div>
                        {task.progress > 0 && (
                          <div className="mt-2">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-muted-foreground">Progress</span>
                              <span className="text-xs font-semibold">{task.progress}%</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                              <motion.div
                                className="h-full bg-gradient-to-r from-primary to-accent"
                                initial={{ width: 0 }}
                                animate={{ width: `${task.progress}%` }}
                                transition={{ duration: 0.5 }}
                              />
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                      <div className="text-center">
                        <ListTodo className="w-6 h-6 mx-auto mb-2 opacity-50" />
                        No tasks yet
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Right Section: Activity */}
          <div className="flex flex-col">
            {/* Recent Activity Card */}
            <Card className="p-4 border-0 shadow-xl bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                <Activity className="w-5 h-5 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Activity Feed
                </h3>
              </div>
              <div className="overflow-y-auto flex-1 pr-2">
                {activityFeed.length > 0 ? (
                  <div className="space-y-2">
                    <AnimatePresence>
                      {activityFeed.map((item, idx) => {
                        const agent = agentById.get(item.agentId);
                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            className="flex items-start gap-2 p-2 rounded-lg bg-background/40 hover:bg-background/60 transition-colors group text-xs"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0 group-hover:scale-125 transition-transform" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs leading-snug">
                                <span className="font-semibold text-foreground">
                                  {agent?.name || "System"}
                                </span>{" "}
                                <span className="text-muted-foreground">{item.action}</span>
                              </p>
                              <span className="text-xs text-muted-foreground opacity-70">
                                {item.time}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-xs py-4">
                    <div className="text-center">
                      <Activity className="w-4 h-4 mx-auto mb-1 opacity-50" />
                      No activity yet
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

interface MetricCardProps {
  icon: any;
  label: string;
  value: string;
  trend: string;
  isLoading?: boolean;
}

function MetricCard({ icon: Icon, label, value, trend, isLoading }: MetricCardProps) {
  return (
    <motion.div variants={itemVariants}>
      <Card className="p-5 border-0 shadow-lg bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 hover:shadow-xl hover:bg-card/60 transition-all group cursor-pointer h-full">
        <div className="flex items-start justify-between mb-3">
          <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-3 h-3" />
            {trend}
          </div>
        </div>
        <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
        {isLoading ? (
          <div className="h-7 bg-muted rounded animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-foreground">{value}</p>
        )}
      </Card>
    </motion.div>
  );
}
