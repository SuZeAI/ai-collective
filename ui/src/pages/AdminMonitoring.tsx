import { memo, useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Coins,
  Cloud,
  Cpu,
  Database,
  DollarSign,
  FolderOpen,
  Gauge,
  HardDrive,
  Pencil,
  Plus,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Trash2,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/components/ui/use-toast";
import {
  api,
  type AdminUserActivity,
  type FileStorageStats,
  type ModelPricing,
  type SystemHealth,
  type UsageSummary,
} from "@/lib/api";

// ─── Formatting helpers ──────────────────────────────────────────────────────

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

function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--background))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "11px",
  color: "hsl(var(--foreground))",
};

// ─── Small building blocks ───────────────────────────────────────────────────

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

function OkBadge({ ok, okLabel = "OK", badLabel = "Down" }: { ok: boolean; okLabel?: string; badLabel?: string }) {
  return ok ? (
    <Badge className="bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400 hover:bg-green-500/10">
      <CheckCircle2 className="w-3 h-3 mr-1" />
      {okLabel}
    </Badge>
  ) : (
    <Badge className="bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400 hover:bg-red-500/10">
      <AlertTriangle className="w-3 h-3 mr-1" />
      {badLabel}
    </Badge>
  );
}

// Memoized table rows so switching tabs/dialogs elsewhere on this page
// doesn't re-render every row in these tables — same pattern as
// KanbanCard/StaffCard/PlanStats elsewhere in the codebase.
const PricingRow = memo(function PricingRow({
  pricing, onEdit, onDelete,
}: {
  pricing: ModelPricing; onEdit: (p: ModelPricing) => void; onDelete: (model: string) => void;
}) {
  return (
    <TableRow>
      <TableCell className="text-xs font-medium">{pricing.model}</TableCell>
      <TableCell className="text-xs capitalize text-muted-foreground">{pricing.provider || "—"}</TableCell>
      <TableCell className="text-right text-xs tabular-nums">${pricing.inputPricePerMillion.toFixed(2)}</TableCell>
      <TableCell className="text-right text-xs tabular-nums">${pricing.outputPricePerMillion.toFixed(2)}</TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(pricing)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(pricing.model)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

const UserActivityRow = memo(function UserActivityRow({ user }: { user: AdminUserActivity }) {
  return (
    <TableRow>
      <TableCell>
        <span className="text-xs font-medium">{user.name}</span>
        <p className="text-[10px] text-muted-foreground">{user.email}</p>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={`text-[10px] capitalize ${
            user.role === "admin" || user.role === "system"
              ? "text-primary border-primary/40"
              : "text-muted-foreground"
          }`}
        >
          {user.role}
        </Badge>
      </TableCell>
      <TableCell className="text-right text-xs tabular-nums">{user.staff}</TableCell>
      <TableCell className="text-right text-xs tabular-nums">{user.departments}</TableCell>
      <TableCell className="text-right text-xs tabular-nums">{user.tasks}</TableCell>
      <TableCell className="text-right text-xs tabular-nums">
        {formatTokens(user.inputTokens + user.outputTokens)}
      </TableCell>
      <TableCell className="text-right text-xs tabular-nums font-semibold">{formatCost(user.cost)}</TableCell>
    </TableRow>
  );
});

// ─── Pricing edit dialog ─────────────────────────────────────────────────────

const EMPTY_PRICING: ModelPricing = {
  model: "",
  provider: "",
  inputPricePerMillion: 0,
  outputPricePerMillion: 0,
};

function PricingDialog({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: ModelPricing | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<ModelPricing>(EMPTY_PRICING);
  const [saving, setSaving] = useState(false);
  const isNew = !initial;

  useEffect(() => {
    setForm(initial ?? EMPTY_PRICING);
  }, [initial, open]);

  const save = async () => {
    if (!form.model.trim()) {
      toast({ title: "Model name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.upsertModelPricing({
        ...form,
        model: form.model.trim(),
        provider: form.provider.trim(),
        inputPricePerMillion: Number(form.inputPricePerMillion) || 0,
        outputPricePerMillion: Number(form.outputPricePerMillion) || 0,
      });
      toast({ title: `Pricing for ${form.model} saved` });
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: "Failed to save pricing", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add model pricing" : `Edit pricing — ${initial?.model}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="pricing-model">Model</Label>
            <Input
              id="pricing-model"
              placeholder="e.g. gemini-2.0-flash"
              value={form.model}
              disabled={!isNew}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pricing-provider">Provider</Label>
            <Select value={form.provider || undefined} onValueChange={(v) => setForm({ ...form, provider: v })}>
              <SelectTrigger id="pricing-provider">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="open_weight">Open Weight </SelectItem>
                <SelectItem value="kimi">Kimi (Moonshot)</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
                <SelectItem value="glm">GLM (Zhipu)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pricing-input">Input $ / 1M tokens</Label>
              <Input
                id="pricing-input"
                type="number"
                min={0}
                step={0.01}
                value={form.inputPricePerMillion}
                onChange={(e) => setForm({ ...form, inputPricePerMillion: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pricing-output">Output $ / 1M tokens</Label>
              <Input
                id="pricing-output"
                type="number"
                min={0}
                step={0.01}
                value={form.outputPricePerMillion}
                onChange={(e) => setForm({ ...form, outputPricePerMillion: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminMonitoring() {
  const { toast } = useToast();
  const [days, setDays] = useState(30);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);

  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [pricing, setPricing] = useState<ModelPricing[]>([]);
  const [userActivity, setUserActivity] = useState<AdminUserActivity[]>([]);
  const [fileStorage, setFileStorage] = useState<FileStorageStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  const [editingPricing, setEditingPricing] = useState<ModelPricing | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [u, h, p, ua, fs] = await Promise.all([
          api.getAdminUsage(days),
          api.getAdminHealth(),
          api.listModelPricing(),
          api.getAdminUsers(days),
          api.getAdminFileStorage(),
        ]);
        if (cancelled) return;
        setUsage(u);
        setHealth(h);
        setPricing(p);
        setUserActivity(ua);
        setFileStorage(fs);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days, refreshKey]);

  const deletePricing = useCallback(async (model: string) => {
    try {
      await api.deleteModelPricing(model);
      toast({ title: `Pricing for ${model} removed` });
      refresh();
    } catch (e) {
      toast({ title: "Failed to delete pricing", description: String(e), variant: "destructive" });
    }
  }, [toast, refresh]);

  const openEditPricing = useCallback((p: ModelPricing) => {
    setEditingPricing(p);
    setPricingDialogOpen(true);
  }, []);

  const chartData = (usage?.byDay ?? []).map((d) => ({
    ...d,
    label: d.date.slice(5), // MM-DD
  }));

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-primary" />
            System Monitoring
          </h1>
          <p className="text-muted-foreground text-sm">
            Token usage, model pricing, platform health and user activity.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-2 h-9">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      {error && (
        <div className="glass-card p-4 flex items-center gap-3 border border-red-500/30">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Could not load monitoring data</p>
            <p className="text-muted-foreground text-xs">{error}</p>
          </div>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5"><Gauge className="w-3.5 h-3.5" />Overview</TabsTrigger>
          <TabsTrigger value="usage" className="gap-1.5"><Coins className="w-3.5 h-3.5" />Token Usage</TabsTrigger>
          <TabsTrigger value="pricing" className="gap-1.5"><DollarSign className="w-3.5 h-3.5" />Pricing</TabsTrigger>
          <TabsTrigger value="storage" className="gap-1.5"><HardDrive className="w-3.5 h-3.5" />Storage</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><UsersIcon className="w-3.5 h-3.5" />Users</TabsTrigger>
        </TabsList>

        {/* ── Overview ──────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-5">
          {loading || !health ? (
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
                  label="Status"
                  value={health.status === "ok" ? "Healthy" : "Degraded"}
                  sub={`env: ${health.environment}`}
                  icon={health.status === "ok" ? CheckCircle2 : AlertTriangle}
                  color={health.status === "ok" ? "hsl(142 71% 45%)" : "hsl(0 84% 60%)"}
                />
                <KpiCard
                  index={1}
                  label="Uptime"
                  value={formatUptime(health.uptimeSeconds)}
                  sub="since last restart"
                  icon={Activity}
                  color="hsl(214 80% 52%)"
                />
                <KpiCard
                  index={2}
                  label="Requests"
                  value={formatTokens(health.requests.totalRequests)}
                  sub={`${(health.requests.errorRate * 100).toFixed(1)}% errors · ${health.requests.avgLatencyMs.toFixed(0)}ms avg`}
                  icon={BarChart3}
                  color="hsl(263 70% 58%)"
                />
                <KpiCard
                  index={3}
                  label="Users"
                  value={String(health.counts.users)}
                  sub={`${health.counts.staff} staff · ${health.counts.departments} departments`}
                  icon={UsersIcon}
                  color="hsl(32 90% 52%)"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="glass-card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold">Storage</h3>
                    <span className="ml-auto"><OkBadge ok={health.storage.ok} okLabel="Connected" /></span>
                  </div>
                  <p className="text-sm font-medium uppercase">{health.storage.backend}</p>
                  <p className="text-xs text-muted-foreground break-all">{health.storage.detail}</p>
                </div>
                <div className="glass-card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold">LLM Provider</h3>
                    <span className="ml-auto">
                      <OkBadge ok={health.llm.configured} okLabel="Configured" badLabel="No API key" />
                    </span>
                  </div>
                  <p className="text-sm font-medium capitalize">{health.llm.provider}</p>
                  <p className="text-xs text-muted-foreground">{health.llm.model}</p>
                </div>
                <div className="glass-card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <ServerCog className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold">Infrastructure</h3>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1.5">
                    <p>Task queue: <span className="text-foreground font-medium">{health.taskQueueBackend}</span></p>
                    <p>Repository lock: <span className="text-foreground font-medium">{health.lockBackend}</span></p>
                    <p>
                      Entities:{" "}
                      <span className="text-foreground font-medium">
                        {health.counts.tasks} tasks · {health.counts.companies} offices
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Token usage ───────────────────────────────────────────────── */}
        <TabsContent value="usage" className="space-y-5">
          {loading || !usage ? (
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
                  label="Total Tokens"
                  value={formatTokens(usage.totals.totalTokens)}
                  sub={`last ${usage.days} days`}
                  icon={Coins}
                  color="hsl(263 70% 58%)"
                />
                <KpiCard
                  index={1}
                  label="Input / Output"
                  value={`${formatTokens(usage.totals.inputTokens)} / ${formatTokens(usage.totals.outputTokens)}`}
                  sub={
                    usage.totals.cacheReadTokens > 0
                      ? `${formatTokens(usage.totals.cacheReadTokens)} cached (~90% cheaper)`
                      : undefined
                  }
                  icon={BarChart3}
                  color="hsl(214 80% 52%)"
                />
                <KpiCard
                  index={2}
                  label="Estimated Cost"
                  value={formatCost(usage.totals.cost)}
                  sub="based on pricing table"
                  icon={DollarSign}
                  color="hsl(142 71% 45%)"
                />
                <KpiCard
                  index={3}
                  label="LLM Requests"
                  value={formatTokens(usage.totals.requests)}
                  icon={Activity}
                  color="hsl(32 90% 52%)"
                />
              </div>

              {/* Daily chart */}
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-5">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Daily Token Usage</h3>
                </div>
                {usage.totals.requests === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 gap-3">
                    <Coins className="w-9 h-9 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      No LLM usage recorded yet — run a chat or staff task and it will show up here.
                    </p>
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
                          name === "inputTokens" ? "Input tokens" : "Output tokens",
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* By model */}
                <div className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Cpu className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold">Usage by Model</h3>
                  </div>
                  {usage.byModel.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No data</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Model</TableHead>
                          <TableHead className="text-right">In</TableHead>
                          <TableHead className="text-right">Out</TableHead>
                          <TableHead className="text-right">Cached</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usage.byModel.map((m) => (
                          <TableRow key={m.model}>
                            <TableCell>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-medium truncate">{m.model}</span>
                                {!m.priced && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-amber-500 border-amber-500/40 shrink-0">
                                    unpriced
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground capitalize">{m.provider}</p>
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">{formatTokens(m.inputTokens)}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums">{formatTokens(m.outputTokens)}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                              {m.cacheReadTokens > 0 ? formatTokens(m.cacheReadTokens) : "—"}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums font-semibold">{formatCost(m.cost)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                {/* By user */}
                <div className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <UsersIcon className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold">Usage by User</h3>
                  </div>
                  {usage.byUser.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No data</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead className="text-right">Tokens</TableHead>
                          <TableHead className="text-right">Req</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usage.byUser.map((u) => (
                          <TableRow key={u.userId}>
                            <TableCell>
                              <span className="text-xs font-medium">{u.name}</span>
                              {u.name !== u.userId && (
                                <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">{u.userId}</p>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {formatTokens(u.inputTokens + u.outputTokens)}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">{u.requests}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums font-semibold">{formatCost(u.cost)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Pricing ───────────────────────────────────────────────────── */}
        <TabsContent value="pricing" className="space-y-5">
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Model Pricing</h3>
              <span className="text-xs text-muted-foreground">USD per 1M tokens — used for cost estimates</span>
              <Button
                size="sm"
                className="ml-auto gap-1.5 h-8"
                onClick={() => {
                  setEditingPricing(null);
                  setPricingDialogOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add model
              </Button>
            </div>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Input $/1M</TableHead>
                    <TableHead className="text-right">Output $/1M</TableHead>
                    <TableHead className="w-[90px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pricing.map((p) => (
                    <PricingRow key={p.model} pricing={p} onEdit={openEditPricing} onDelete={deletePricing} />
                  ))}
                  {pricing.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                        No pricing configured yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ── Storage ───────────────────────────────────────────────────── */}
        <TabsContent value="storage" className="space-y-5">
          {loading || !fileStorage ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="glass-card p-5"><Skeleton className="h-16 w-full" /></div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  index={0}
                  label="File store"
                  value={fileStorage.backend === "s3" ? "S3 / MinIO" : "Local disk"}
                  sub={`Sandbox mode: ${fileStorage.sandboxMode}`}
                  icon={fileStorage.backend === "s3" ? Cloud : HardDrive}
                  color={fileStorage.backend === "s3" ? "#06b6d4" : "#64748b"}
                />
                <KpiCard
                  index={1}
                  label="Object store"
                  value={
                    !fileStorage.minioEnabled ? "Disabled"
                      : fileStorage.minioConnected ? "Connected" : "Unreachable"
                  }
                  sub={fileStorage.minioEnabled ? fileStorage.minioEndpoint : "MINIO_ENABLED=false"}
                  icon={Database}
                  color={fileStorage.minioConnected ? "#22c55e" : fileStorage.minioEnabled ? "#ef4444" : "#64748b"}
                />
                <KpiCard
                  index={2}
                  label="Library documents"
                  value={String(fileStorage.libraryDocCount)}
                  sub={formatBytes(fileStorage.libraryTotalBytes)}
                  icon={FolderOpen}
                  color="#14b8a6"
                />
                <KpiCard
                  index={3}
                  label="Stored in MinIO"
                  value={formatBytes(fileStorage.sandboxTotalBytes + fileStorage.libraryObjectBytes)}
                  sub={`${fileStorage.sandboxObjectCount + fileStorage.libraryObjectCount} objects`}
                  icon={ServerCog}
                  color="#a855f7"
                />
              </div>

              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <HardDrive className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">File byte storage</h3>
                  <span className="ml-auto"><OkBadge ok={fileStorage.backend !== "s3" || fileStorage.minioConnected} okLabel="Healthy" badLabel="Needs MinIO" /></span>
                </div>

                {fileStorage.backend === "s3" && fileStorage.minioEnabled && !fileStorage.minioConnected && (
                  <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">MinIO is configured but unreachable.</p>
                      <p className="text-muted-foreground mt-0.5">
                        Start it with <code className="font-mono">make dev PROFILES=minio</code>.
                        {fileStorage.minioError ? ` (${fileStorage.minioError})` : ""}
                      </p>
                    </div>
                  </div>
                )}

                <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-xs">
                  {[
                    ["Backend", fileStorage.backend === "s3" ? "s3 (MinIO is system of record)" : "local (host company volume)"],
                    ["Sandbox mode", fileStorage.sandboxMode],
                    ["Company path", fileStorage.companyBase],
                    ["MinIO endpoint", fileStorage.minioEnabled ? fileStorage.minioEndpoint : "—"],
                    ["MinIO bucket", fileStorage.minioEnabled ? fileStorage.minioBucket : "—"],
                    ["Library objects (S3)", `${fileStorage.libraryObjectCount} · ${formatBytes(fileStorage.libraryObjectBytes)}`],
                    ["Meeting objects (S3)", `${fileStorage.sandboxObjectCount} · ${formatBytes(fileStorage.sandboxTotalBytes)}`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 border-b border-border/40 pb-2">
                      <dt className="text-muted-foreground shrink-0">{k}</dt>
                      <dd className="font-medium text-right break-all">{v}</dd>
                    </div>
                  ))}
                </dl>

                <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
                  {fileStorage.backend === "s3"
                    ? "Files (uploads, staff outputs, document library) are durably stored in MinIO and restored into the working directory on restart — surviving container/Pod recreation."
                    : "Files live only on the host company volume. Set FILE_STORAGE_BACKEND=s3 + MINIO_ENABLED=true for durability across Pod recreation (required in k8s sandbox mode)."}
                </p>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Users ─────────────────────────────────────────────────────── */}
        <TabsContent value="users" className="space-y-5">
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <UsersIcon className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">User Activity</h3>
              {!loading && (
                <span className="ml-auto text-xs text-muted-foreground">{userActivity.length} accounts</span>
              )}
            </div>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : userActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No registered users yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Staff</TableHead>
                    <TableHead className="text-right">Departments</TableHead>
                    <TableHead className="text-right">Tasks</TableHead>
                    <TableHead className="text-right">Tokens ({days}d)</TableHead>
                    <TableHead className="text-right">Cost ({days}d)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userActivity.map((u) => (
                    <UserActivityRow key={u.id} user={u} />
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <PricingDialog
        open={pricingDialogOpen}
        initial={editingPricing}
        onClose={() => setPricingDialogOpen(false)}
        onSaved={refresh}
      />
    </div>
  );
}
