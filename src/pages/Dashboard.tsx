import { useEffect, useMemo, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, Zap, Users, Clock, Activity, CheckCircle2, ListTodo, Building2, ArrowUpRight, Sparkles,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { useStaffSimulation } from "@/hooks/use-staff-simulation";
import { api, avgCompletionOf, type Staff, type Analytics, type ActivityFeedItem, type Task, type Company, type Department } from "@/lib/api";
import { useCompanyScope, setActiveCompanyId } from "@/hooks/use-company-scope";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { companyTypeOf } from "@/lib/company-types";

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
  { key: "staff", icon: Users, label: "Active Personnel" },
  { key: "time", icon: Clock, label: "Avg. Completion" },
];

const statusVariant: Record<string, NonNullable<BadgeProps["variant"]>> = {
  completed: "default",
  "in-progress": "secondary",
  pending: "outline",
};

export default function Dashboard() {
  const navigate = useNavigate();
  useStaffSimulation();
  const scope = useCompanyScope();
  const { t } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "system";
  const [isLoading, setIsLoading] = useState(true);
  const [allStaff, setStaff] = useState<Staff[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [allActivityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [allTasks, setTasks] = useState<Task[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Office scoping: a specific office shows only its personnel/tasks/activity.
  const staff = useMemo(
    () => (scope.isOverall ? allStaff : allStaff.filter((a) => scope.staffIds.has(a.id))),
    [allStaff, scope],
  );
  const tasks = useMemo(
    () => (scope.isOverall ? allTasks : allTasks.filter((t) => scope.departmentIds.has(t.departmentId))),
    [allTasks, scope],
  );
  const activityFeed = useMemo(
    () => (scope.isOverall ? allActivityFeed : allActivityFeed.filter((f) => scope.staffIds.has(f.staffId))),
    [allActivityFeed, scope],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const [a, an, feed, tsk, ws, tm] = await Promise.all([
          api.listStaff(),
          api.getAnalytics(),
          api.listActivityFeed(),
          api.listTasks(),
          api.listCompanies().catch(() => [] as Company[]),
          api.listDepartments().catch(() => [] as Department[]),
        ]);
        if (cancelled) return;
        setStaff(a);
        setAnalytics(an);
        setActivityFeed(feed);
        setTasks(tsk);
        setCompanies(ws);
        setDepartments(tm);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const staffById = useMemo(() => {
    const map = new Map<string, Staff>();
    allStaff.forEach((a) => map.set(a.id, a));
    return map;
  }, [allStaff]);

  // Map each department to its owning office, so deep links from the Overall view can
  // switch into the right company before opening a task.
  const departmentToCompanyId = useMemo(() => {
    const map = new Map<string, string>();
    for (const ws of companies) for (const tid of ws.departmentIds) map.set(tid, ws.id);
    return map;
  }, [companies]);

  // Per-company monitoring rollup for the Overall "Companies" grid. Membership
  // mirrors useCompanyScope: company.departmentIds → department.staff → tasks by department.
  const companyStats = useMemo(() => {
    if (!scope.isOverall) return [];
    return companies.map((ws) => {
      const departmentIds = new Set(ws.departmentIds);
      const staffIds = new Set(departments.filter((t) => departmentIds.has(t.id)).flatMap((t) => t.staff));
      const companyTasks = allTasks.filter((t) => departmentIds.has(t.departmentId));
      const activeTasks = companyTasks.filter((t) => t.status === "in-progress").length;
      const staffCount = allStaff.filter((a) => staffIds.has(a.id)).length;
      const activeStaff = allStaff.filter((a) => staffIds.has(a.id) && a.status === "active").length;
      return { ws, taskCount: companyTasks.length, activeTasks, staffCount, active: activeTasks > 0 || activeStaff > 0 };
    });
  }, [scope.isOverall, companies, departments, allTasks, allStaff]);

  // From the Overall view, opening a task first switches into its owning office
  // (company-specific routes are guarded against the All scope).
  const openTask = (task: Task) => {
    if (scope.isOverall) {
      const wsId = departmentToCompanyId.get(task.departmentId);
      if (wsId) setActiveCompanyId(wsId);
    }
    navigate(`/tasks?id=${task.id}`);
  };

  const activeStaffCount = staff.filter((a) => a.status === "active").length;
  const activeTasks = tasks.filter((t) => t.status === "in-progress").length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  // Global metrics come from the analytics endpoint; office-scoped ones are
  // computed client-side from the scoped task list.
  const efficiency = scope.isOverall
    ? analytics?.departmentEfficiency ?? 0
    : tasks.length > 0
      ? Math.round((completedTasks / tasks.length) * 100)
      : 0;
  const avgCompletion = scope.isOverall
    ? analytics?.avgCompletionTime ?? "—"
    : avgCompletionOf(tasks);

  const metricValues = [
    { value: String(completedTasks), trend: "+12%" },
    { value: String(activeTasks), trend: "in progress" },
    { value: `${efficiency}%`, trend: "+5%" },
    { value: String(activeStaffCount), trend: `of ${staff.length}` },
    { value: avgCompletion, trend: "avg time" },
  ];

  // Office membership is still resolving: the scoped filters above read empty
  // id sets in the meantime, which would otherwise flash "0" metrics before
  // the real numbers land — keep showing skeletons until scope catches up.
  const metricsLoading = isLoading || scope.pending;

  // Admins have no company control center: their "All" view is the shared
  // catalog, so send them to Departments instead of the Company Overview.
  if (scope.isOverall && isAdmin) return <Navigate to="/departments" replace />;

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Page header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {scope.company ? `${scope.company.name} — Overview` : "Company Overview"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {scope.company
            ? `Operations of office "${scope.company.name}"`
            : "Overview of your company operations across all offices"}
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
            isLoading={metricsLoading}
          />
        ))}
      </motion.div>

      {/* Companies grid — only in the Overall (monitoring) scope. One card per
          company; click to switch into it. */}
      {scope.isOverall && (
        <motion.div variants={itemVariants} className="space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Companies</h3>
            <span className="text-xs text-muted-foreground font-medium">{companyStats.length}</span>
            <button
              onClick={() => navigate("/office-builder")}
              className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <Sparkles className="w-3.5 h-3.5" /> Create company
            </button>
          </div>
          {companyStats.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {companyStats.map(({ ws, taskCount, activeTasks, staffCount, active }) => (
                <button
                  key={ws.id}
                  onClick={() => setActiveCompanyId(ws.id)}
                  className="text-left glass-card p-4 hover:border-border transition-all group relative"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                      {ws.avatar ? <span>{ws.avatar}</span> : (ws.name[0]?.toUpperCase() ?? "?")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-foreground truncate">{ws.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                        <span className="text-[11px] text-muted-foreground">{active ? "Active" : "Idle"}</span>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="text-[11px] text-muted-foreground truncate">{t.companyTypes[companyTypeOf(ws)]}</span>
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/40">
                    <div>
                      <div className="text-base font-bold text-foreground leading-none">{taskCount}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{activeTasks} active task{activeTasks === 1 ? "" : "s"}</div>
                    </div>
                    <div>
                      <div className="text-base font-bold text-foreground leading-none">{staffCount}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">staff</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={() => navigate("/companies")}
              className="w-full glass-card p-6 text-center text-muted-foreground hover:border-border transition-all"
            >
              <Building2 className="w-7 h-7 opacity-40 mx-auto mb-2" />
              <p className="text-sm font-medium">No companies yet</p>
              <p className="text-xs opacity-60 mt-0.5">Create your first company to get started</p>
            </button>
          )}
        </motion.div>
      )}

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
                    onClick={() => openTask(task)}
                    className="p-3.5 rounded-lg bg-muted/30 hover:bg-muted/55 transition-all border border-border/50 hover:border-border group cursor-pointer hover:shadow-sm"
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
                        variant={statusVariant[task.status] ?? "outline"}
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
                    const staff = staffById.get(item.staffId);
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
                              {staff?.name || "System"}
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
