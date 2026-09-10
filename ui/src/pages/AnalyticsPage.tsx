import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Activity,
  RefreshCw,
  Award,
  Target,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StaffAvatar } from "@/components/StaffAvatar";
import { getStaffRoleColor } from "@/lib/staff-role-ui";
import { api, avgCompletionOf, type Staff, type Analytics, type Task, type Department } from "@/lib/api";
import { chartTooltipStyle as tooltipStyle } from "@/lib/format";
import { useCompanyScope } from "@/hooks/use-company-scope";
import { useToast } from "@/hooks/use-toast";

const ROLE_COLORS: Record<string, string> = {
  manager: "hsl(350 75% 55%)",
  developer: "hsl(168 72% 38%)",
  research: "hsl(214 80% 52%)",
  marketing: "hsl(32 90% 52%)",
  review: "hsl(272 65% 55%)",
};

const KPI_COLORS = {
  success: "hsl(142 71% 45%)",
  primary: "hsl(263 70% 58%)",
  warning: "hsl(32 90% 52%)",
  info: "hsl(214 80% 52%)",
};

function getRoleColor(role: string): string {
  const key = role.toLowerCase();
  for (const [k, color] of Object.entries(ROLE_COLORS)) {
    if (key.includes(k)) return color;
  }
  return "hsl(215 20% 65%)";
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  index,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="glass-card p-5 flex items-start justify-between gap-3"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
          {label}
        </p>
        <p className="text-2xl font-bold tracking-tight">{value || "—"}</p>
      </div>
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: `${color}22` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    completed: {
      label: "Done",
      cls: "bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400",
    },
    "in-progress": {
      label: "Active",
      cls: "bg-primary/10 text-primary border-primary/20",
    },
    pending: {
      label: "Pending",
      cls: "bg-muted text-muted-foreground border-border",
    },
  };
  const s = map[status] ?? map.pending;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

export default function AnalyticsPage() {
  const scope = useCompanyScope();
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [allTasks, setTasks] = useState<Task[]>([]);
  const [allDepartments, setDepartments] = useState<Department[]>([]);
  const [dataLoading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  // Office membership is still resolving: the scoped filters below read empty
  // id sets in the meantime, which would otherwise flash "0" metrics before
  // the real numbers land — keep showing skeletons until scope catches up.
  const loading = dataLoading || scope.pending;

  // Office scoping: every chart below works off these lists.
  const tasks = useMemo(
    () => (scope.isOverall ? allTasks : allTasks.filter((t) => scope.departmentIds.has(t.departmentId))),
    [allTasks, scope],
  );
  const departments = useMemo(
    () => (scope.isOverall ? allDepartments : allDepartments.filter((t) => scope.departmentIds.has(t.id))),
    [allDepartments, scope],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [an, ags, tks, tms] = await Promise.all([
          api.getAnalytics(),
          api.listStaff(),
          api.listTasks(),
          api.listDepartments(),
        ]);
        if (cancelled) return;
        setAnalytics(an);
        setStaff(ags);
        setTasks(tks);
        setDepartments(tms);
      } catch (e) {
        console.error(e);
        toast({ title: "Could not load analytics", description: String((e as Error).message ?? e), variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, toast]);

  const staffById = useMemo(() => {
    const map = new Map<string, Staff>();
    staff.forEach((a) => map.set(a.id, a));
    return map;
  }, [staff]);

  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const inProgressTasks = tasks.filter((t) => t.status === "in-progress").length;
  const pendingTasks = tasks.length - completedTasks - inProgressTasks;

  const productivityData = useMemo(() => {
    return Object.entries(analytics?.staffProductivity ?? {})
      .filter(([staffId]) => scope.isOverall || scope.staffIds.has(staffId))
      .map(([staffId, value]) => {
        const staff = staffById.get(staffId);
        return {
          name: staff?.name ?? staffId,
          role: staff?.role ?? "",
          value: Number(value),
          staff,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [analytics, staffById, scope]);

  const taskStatusData = [
    { name: "Completed", value: completedTasks, color: KPI_COLORS.success },
    { name: "In Progress", value: inProgressTasks, color: KPI_COLORS.primary },
    { name: "Pending", value: pendingTasks, color: "hsl(215 20% 55%)" },
  ].filter((d) => d.value > 0);

  const kpiCards = [
    {
      label: "Tasks Completed",
      value: String(scope.isOverall ? analytics?.tasksCompleted ?? 0 : completedTasks),
      icon: CheckCircle2,
      color: KPI_COLORS.success,
    },
    {
      label: "Avg. Completion",
      value: scope.isOverall ? analytics?.avgCompletionTime ?? "—" : avgCompletionOf(tasks),
      icon: Clock,
      color: KPI_COLORS.primary,
    },
    {
      label: "Department Efficiency",
      value: scope.isOverall
        ? analytics
          ? `${analytics.departmentEfficiency}%`
          : "—"
        : tasks.length > 0
          ? `${Math.round((completedTasks / tasks.length) * 100)}%`
          : "—",
      icon: TrendingUp,
      color: KPI_COLORS.warning,
    },
    {
      label: "Active Departments",
      value: String(departments.length),
      icon: Users,
      color: KPI_COLORS.info,
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Analytics</h1>
          <p className="text-muted-foreground text-sm">
            {scope.company
              ? <>Performance metrics of office <span className="font-semibold text-foreground">{scope.company.name}</span>.</>
              : "Department performance metrics and productivity insights across all offices."}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-card p-5">
                <Skeleton className="h-3 w-24 mb-3" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))
          : kpiCards.map((card, i) => (
              <KpiCard key={card.label} {...card} index={i} />
            ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* Staff Productivity */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Personnel Productivity</h3>
            {!loading && (
              <span className="ml-auto text-xs text-muted-foreground">
                {productivityData.length} members
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3 py-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                  <div className="flex-1">
                    <Skeleton className="h-3 w-24 mb-2" />
                    <Skeleton className="h-1.5 w-full rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : productivityData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <Award className="w-9 h-9 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No personnel data yet</p>
            </div>
          ) : (
            <>
              {/* Progress Bars */}
              <div className="space-y-3 mb-6">
                {productivityData.map((item, i) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center gap-3"
                  >
                    {item.staff ? (
                      <StaffAvatar
                        staff={item.staff}
                        className={`w-8 h-8 shrink-0 text-sm ${getStaffRoleColor(item.role)}`}
                      />
                    ) : (
                      <div
                        className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold ${getStaffRoleColor(item.role)}`}
                      >
                        {item.name[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-semibold truncate">
                            {item.name}
                          </span>
                          {item.role && (
                            <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
                              {item.role}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-bold ml-2 shrink-0 tabular-nums">
                          {item.value}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.value}%` }}
                          transition={{ duration: 0.7, delay: 0.1 + i * 0.06 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: getRoleColor(item.role) }}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Bar Chart */}
              <div className="pt-4 border-t border-border">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Comparison Chart
                </p>
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart
                    data={productivityData}
                    margin={{ top: 0, right: 0, left: -22, bottom: 0 }}
                    barCategoryGap="35%"
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
                      opacity={0.6}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                      formatter={(v: number) => [`${v}%`, "Productivity"]}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36}>
                      {productivityData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={getRoleColor(entry.role)}
                          fillOpacity={0.88}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>

        {/* Task Status Donut */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <Target className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Task Status</h3>
          </div>

          {loading ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <Skeleton className="w-28 h-28 rounded-full" />
              <div className="space-y-2 w-full">
                <Skeleton className="h-9 w-full rounded-lg" />
                <Skeleton className="h-9 w-full rounded-lg" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            </div>
          ) : taskStatusData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <Zap className="w-9 h-9 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No tasks yet</p>
            </div>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <PieChart width={156} height={156}>
                    <Pie
                      data={taskStatusData}
                      cx={74}
                      cy={74}
                      innerRadius={44}
                      outerRadius={68}
                      strokeWidth={0}
                      dataKey="value"
                      paddingAngle={3}
                    >
                      {taskStatusData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold">{tasks.length}</span>
                    <span className="text-[10px] text-muted-foreground">tasks</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {taskStatusData.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs font-medium">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold tabular-nums">
                        {item.value}
                      </span>
                      {tasks.length > 0 && (
                        <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">
                          {Math.round((item.value / tasks.length) * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* Recent Tasks */}
        <div className="glass-card p-5 min-w-0">
          <div className="flex items-center gap-2 mb-5">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Recent Tasks</h3>
            {!loading && (
              <span className="ml-auto text-xs text-muted-foreground">
                {tasks.length} total
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <Skeleton className="h-3 w-3/5" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Activity className="w-9 h-9 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No tasks recorded</p>
            </div>
          ) : (
            <div className="space-y-1">
              {tasks.slice(0, 8).map((task, i) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{task.title}</p>
                    {task.description && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {task.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {task.progress !== undefined && task.progress > 0 && (
                      <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                        {task.progress}%
                      </span>
                    )}
                    <StatusBadge status={task.status} />
                  </div>
                </motion.div>
              ))}
              {tasks.length > 8 && (
                <p className="text-xs text-muted-foreground text-center pt-2 pb-1">
                  +{tasks.length - 8} more tasks
                </p>
              )}
            </div>
          )}
        </div>

        {/* Departments Overview */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <Users className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Departments</h3>
            {!loading && (
              <span className="ml-auto text-xs text-muted-foreground">
                {departments.length} active
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-1">
                  <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
                  <div>
                    <Skeleton className="h-3 w-24 mb-1.5" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : departments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Users className="w-9 h-9 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No departments yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {departments.map((department, i) => (
                <motion.div
                  key={department.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors"
                >
                  <StaffAvatar
                    staff={department}
                    className="w-9 h-9 shrink-0 bg-primary/10 text-primary text-sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{department.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {department.staff.length} member
                      {department.staff.length !== 1 ? "s" : ""}
                      {department.activeTasks ? ` · ${department.activeTasks} active` : ""}
                    </p>
                  </div>
                  {department.activeTasks > 0 && (
                    <div className="w-2 h-2 rounded-full bg-staff-dev animate-pulse shrink-0" />
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
