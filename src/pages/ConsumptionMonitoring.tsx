import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building,
  Coins,
  Cpu,
  DollarSign,
  RefreshCw,
  Users as UsersIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompanyScope } from "@/hooks/use-company-scope";
import { api, type Consumption } from "@/lib/api";

// ─── Formatting helpers (shared shape with AdminMonitoring) ───────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n: number): string {
  if (n > 0 && n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--background))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "11px",
  color: "hsl(var(--foreground))",
};

// ─── Page copy (localized inline, EN fallback) ────────────────────────────────

type Lang = "en" | "vi" | "zh" | "ja";

const COPY: Record<string, Record<Lang, string>> = {
  title: { en: "Cost Monitoring", vi: "Giám sát chi phí", zh: "成本监控", ja: "コスト監視" },
  subtitle: {
    en: "Token usage and cost across your departments, staff and department members.",
    vi: "Lượng token và chi phí theo phòng ban, nhân sự và thành viên của bạn.",
    zh: "按部门、员工和成员统计的 Token 用量与成本。",
    ja: "部門・スタッフ・メンバー別のトークン使用量とコスト。",
  },
  days7: { en: "Last 7 days", vi: "7 ngày qua", zh: "近 7 天", ja: "過去 7 日" },
  days30: { en: "Last 30 days", vi: "30 ngày qua", zh: "近 30 天", ja: "過去 30 日" },
  days90: { en: "Last 90 days", vi: "90 ngày qua", zh: "近 90 天", ja: "過去 90 日" },
  refresh: { en: "Refresh", vi: "Làm mới", zh: "刷新", ja: "更新" },
  loadError: { en: "Could not load consumption data", vi: "Không tải được dữ liệu chi phí", zh: "无法加载消耗数据", ja: "消費データを読み込めません" },
  totalTokens: { en: "Total Tokens", vi: "Tổng token", zh: "总 Token", ja: "総トークン" },
  inputOutput: { en: "Input / Output", vi: "Vào / Ra", zh: "输入 / 输出", ja: "入力 / 出力" },
  estCost: { en: "Estimated Cost", vi: "Chi phí ước tính", zh: "预计成本", ja: "推定コスト" },
  requests: { en: "LLM Requests", vi: "Lượt gọi LLM", zh: "LLM 请求", ja: "LLM リクエスト" },
  basedOnPricing: { en: "based on pricing table", vi: "theo bảng giá", zh: "基于价格表", ja: "価格表に基づく" },
  dailyTrend: { en: "Daily Token Usage", vi: "Token theo ngày", zh: "每日 Token 用量", ja: "日次トークン使用量" },
  noUsage: {
    en: "No usage recorded yet — run a department task and your cost will show up here.",
    vi: "Chưa có dữ liệu — chạy một tác vụ của đội nhóm và chi phí sẽ hiện ở đây.",
    zh: "暂无数据 — 运行团队任务后成本将显示在此。",
    ja: "データなし — チームタスクを実行するとコストが表示されます。",
  },
  departments: { en: "Departments", vi: "Phòng ban", zh: "部门", ja: "部門" },
  staff: { en: "Staff", vi: "Nhân sự", zh: "员工", ja: "スタッフ" },
  members: { en: "Members", vi: "Thành viên", zh: "成员", ja: "メンバー" },
  name: { en: "Name", vi: "Tên", zh: "名称", ja: "名前" },
  inCol: { en: "In", vi: "Vào", zh: "输入", ja: "入力" },
  outCol: { en: "Out", vi: "Ra", zh: "输出", ja: "出力" },
  reqCol: { en: "Req", vi: "Lượt", zh: "请求", ja: "回数" },
  costCol: { en: "Cost", vi: "Chi phí", zh: "成本", ja: "コスト" },
  noData: { en: "No data", vi: "Chưa có dữ liệu", zh: "暂无数据", ja: "データなし" },
};

// ─── KPI card (same look as AdminMonitoring) ──────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  index,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="glass-card p-5 flex items-start justify-between gap-3"
    >
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 truncate">
          {label}
        </p>
        <p className="text-2xl font-bold tracking-tight">{value || "—"}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1 truncate">{sub}</p>}
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

// One breakdown row: name + role/sub, in/out tokens, requests, cost.
type BreakdownRow = {
  key: string;
  name: string;
  sub?: string;
  inputTokens: number;
  outputTokens: number;
  requests: number;
  cost: number;
};

function BreakdownTable({
  icon: Icon,
  title,
  rows,
  tr,
}: {
  icon: React.ElementType;
  title: string;
  rows: BreakdownRow[];
  tr: (k: string) => string;
}) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{tr("noData")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tr("name")}</TableHead>
              <TableHead className="text-right">{tr("inCol")}</TableHead>
              <TableHead className="text-right">{tr("outCol")}</TableHead>
              <TableHead className="text-right">{tr("reqCol")}</TableHead>
              <TableHead className="text-right">{tr("costCol")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell>
                  <span className="text-xs font-medium truncate">{r.name}</span>
                  {r.sub && <p className="text-[10px] text-muted-foreground capitalize">{r.sub}</p>}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">{formatTokens(r.inputTokens)}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{formatTokens(r.outputTokens)}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{formatTokens(r.requests)}</TableCell>
                <TableCell className="text-right text-xs tabular-nums font-semibold">{formatCost(r.cost)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export default function ConsumptionMonitoring() {
  const { language } = useLanguage();
  const lang = (["en", "vi", "zh", "ja"].includes(language) ? language : "en") as Lang;
  const tr = useCallback((k: string) => COPY[k]?.[lang] ?? COPY[k]?.en ?? k, [lang]);

  const { isOverall, company, pending: scopePending } = useCompanyScope();
  const [days, setDays] = useState(30);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Consumption | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    // Wait for the office scope to resolve so we don't fetch "Overall" data
    // first and flash it before the scoped result lands.
    if (scopePending) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const c = await api.getConsumption(days, isOverall ? undefined : company?.id);
        if (!cancelled) setData(c);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days, refreshKey, isOverall, company?.id, scopePending]);

  const chartData = (data?.byDay ?? []).map((d) => ({ ...d, label: d.date.slice(5) }));

  const departmentRows: BreakdownRow[] = (data?.byDepartment ?? []).map((t) => ({
    key: t.departmentId || t.name,
    name: t.name,
    inputTokens: t.inputTokens,
    outputTokens: t.outputTokens,
    requests: t.requests,
    cost: t.cost,
  }));
  const staffRows: BreakdownRow[] = (data?.byStaff ?? []).map((a) => ({
    key: a.staffName || a.name,
    name: a.name,
    sub: a.role || undefined,
    inputTokens: a.inputTokens,
    outputTokens: a.outputTokens,
    requests: a.requests,
    cost: a.cost,
  }));
  const userRows: BreakdownRow[] = (data?.byUser ?? []).map((u) => ({
    key: u.userId,
    name: u.name,
    inputTokens: u.inputTokens,
    outputTokens: u.outputTokens,
    requests: u.requests,
    cost: u.cost,
  }));

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-2">
            <Coins className="w-7 h-7 text-primary" />
            {tr("title")}
          </h1>
          <p className="text-muted-foreground text-sm">{tr("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{tr("days7")}</SelectItem>
              <SelectItem value="30">{tr("days30")}</SelectItem>
              <SelectItem value="90">{tr("days90")}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-2 h-9">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {tr("refresh")}
          </Button>
        </div>
      </header>

      {error && (
        <div className="glass-card p-4 flex items-center gap-3 border border-red-500/30">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">{tr("loadError")}</p>
            <p className="text-muted-foreground text-xs">{error}</p>
          </div>
        </div>
      )}

      {loading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card p-5">
              <Skeleton className="h-3 w-24 mb-3" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              index={0}
              label={tr("totalTokens")}
              value={formatTokens(data.totals.totalTokens)}
              sub={`${data.days}d`}
              icon={Coins}
              color="hsl(263 70% 58%)"
            />
            <KpiCard
              index={1}
              label={tr("inputOutput")}
              value={`${formatTokens(data.totals.inputTokens)} / ${formatTokens(data.totals.outputTokens)}`}
              icon={BarChart3}
              color="hsl(214 80% 52%)"
            />
            <KpiCard
              index={2}
              label={tr("estCost")}
              value={formatCost(data.totals.cost)}
              sub={tr("basedOnPricing")}
              icon={DollarSign}
              color="hsl(142 71% 45%)"
            />
            <KpiCard
              index={3}
              label={tr("requests")}
              value={formatTokens(data.totals.requests)}
              icon={Activity}
              color="hsl(32 90% 52%)"
            />
          </div>

          {/* Daily chart */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">{tr("dailyTrend")}</h3>
            </div>
            {data.totals.requests === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3">
                <Coins className="w-9 h-9 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{tr("noUsage")}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => formatTokens(v)}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                    formatter={(value: number, name: string) => [
                      formatTokens(value),
                      name === "inputTokens" ? tr("inCol") : tr("outCol"),
                    ]}
                    labelFormatter={(label: string, payload) => {
                      const p = payload?.[0]?.payload;
                      return p ? `${p.date} — ${formatCost(p.cost)} · ${p.requests} req` : label;
                    }}
                  />
                  <Bar dataKey="inputTokens" stackId="t" fill="hsl(214 80% 52%)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="outputTokens" stackId="t" fill="hsl(263 70% 58%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Breakdowns by department / staff / member */}
          <Tabs defaultValue="departments" className="space-y-5">
            <TabsList>
              <TabsTrigger value="departments" className="gap-1.5">
                <Building className="w-3.5 h-3.5" />
                {tr("departments")}
              </TabsTrigger>
              <TabsTrigger value="staff" className="gap-1.5">
                <Cpu className="w-3.5 h-3.5" />
                {tr("staff")}
              </TabsTrigger>
              <TabsTrigger value="members" className="gap-1.5">
                <UsersIcon className="w-3.5 h-3.5" />
                {tr("members")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="departments">
              <BreakdownTable icon={Building} title={tr("departments")} rows={departmentRows} tr={tr} />
            </TabsContent>
            <TabsContent value="staff">
              <BreakdownTable icon={Cpu} title={tr("staff")} rows={staffRows} tr={tr} />
            </TabsContent>
            <TabsContent value="members">
              <BreakdownTable icon={UsersIcon} title={tr("members")} rows={userRows} tr={tr} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
