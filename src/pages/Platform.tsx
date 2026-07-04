import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Plug, Copy, CheckCheck, Settings2, RefreshCw, Webhook,
  Link2, Users, UserRound, Pencil, Building2,
} from "lucide-react";
import {
  api, type PlatformDef, type Department, type Staff, type Connection,
} from "@/lib/api";
import { useCompanyScope } from "@/hooks/use-company-scope";
import {
  platformIcon, platformColor, getWebhookUrl,
} from "@/lib/platforms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// What a connection's dialog collects before saving. Mirrors Connection minus
// the server-assigned fields; `id` empty → create.
type DraftConnection = {
  id?: string;
  platform: string;
  name: string;
  config: Record<string, string>;
  enabled: boolean;
  routingDepartmentId: string;
  routingStaffIds: string[];
};

type RoutingMode = "default" | "department" | "staff";

const routingModeOf = (c: Pick<Connection, "routingDepartmentId" | "routingStaffIds">): RoutingMode => {
  if (c.routingStaffIds && c.routingStaffIds.length > 0) return "staff";
  if (c.routingDepartmentId) return "department";
  return "default";
};

// ─── Manual config fields per platform ────────────────────────────────────────
function ConfigFields({
  platform, platforms, value, onChange,
}: {
  platform: string;
  platforms: PlatformDef[];
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const def = platforms.find((p) => p.platform === platform);
  if (!def) return null;
  return (
    <div className="grid gap-3">
      {def.config_fields.map((f) => (
        <div key={f.key} className="grid gap-1.5">
          <Label className="text-xs font-medium">
            {f.label}
            {f.required && <span className="text-rose-400 ml-1">*</span>}
          </Label>
          <Input
            type="text"
            placeholder={(f.placeholder as string) || ""}
            value={(value[f.key] as string) || ""}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
            className="h-8 text-xs"
          />
        </div>
      ))}
    </div>
  );
}

// ─── Webhook URL copy row ─────────────────────────────────────────────────────
function WebhookUrlRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-2">
      <Webhook className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="flex-1 text-[10px] font-mono text-muted-foreground break-all">{url}</span>
      <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={copy}>
        {copied ? <CheckCheck className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

// ─── Connection create / edit dialog ──────────────────────────────────────────
function ConnectionDialog({
  open, onClose, existing, platforms, connections, departments, staff, onSave,
}: {
  open: boolean;
  onClose: () => void;
  existing?: Connection;
  platforms: PlatformDef[];
  connections: Connection[];   // saved connections (any company) to clone config from
  departments: Department[];   // already scoped to the active company
  staff: Staff[];              // already scoped to the active company
  onSave: (draft: DraftConnection) => void;
}) {
  const [platform, setPlatform] = useState("");
  const [name, setName] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState<"saved" | "manual">("manual");
  const [selectedConnId, setSelectedConnId] = useState("");
  const [routingMode, setRoutingMode] = useState<RoutingMode>("default");
  const [routingDepartmentId, setRoutingDepartmentId] = useState("");
  const [routingStaffIds, setRoutingStaffIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setPlatform(existing.platform);
      setName(existing.name);
      setConfig((existing.config as Record<string, string>) || {});
      setEnabled(existing.enabled);
      setMode("manual");
      setSelectedConnId("");
      setRoutingMode(routingModeOf(existing));
      setRoutingDepartmentId(existing.routingDepartmentId || "");
      setRoutingStaffIds(existing.routingStaffIds || []);
    } else {
      setPlatform("");
      setName("");
      setConfig({});
      setEnabled(true);
      setMode("manual");
      setSelectedConnId("");
      setRoutingMode("default");
      setRoutingDepartmentId("");
      setRoutingStaffIds([]);
    }
  }, [open, existing]);

  // Saved (account-level / other) connections that share the chosen platform —
  // used to pre-fill credentials without retyping.
  const savedForPlatform = connections.filter(
    (c) => c.platform === platform && c.id !== existing?.id,
  );

  const handlePlatformChange = (v: string) => {
    setPlatform(v);
    setConfig({});
    setSelectedConnId("");
    setMode(connections.some((c) => c.platform === v && c.id !== existing?.id) ? "saved" : "manual");
  };

  const handleConnPick = (connId: string) => {
    setSelectedConnId(connId);
    const conn = connections.find((c) => c.id === connId);
    if (conn) {
      setConfig(conn.config as Record<string, string>);
      if (!name) setName(conn.name);
    }
  };

  const toggleStaff = (id: string) =>
    setRoutingStaffIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const submit = () => {
    if (!platform || !name.trim()) return;
    onSave({
      id: existing?.id,
      platform,
      name: name.trim(),
      config,
      enabled,
      routingDepartmentId: routingMode === "department" ? routingDepartmentId : "",
      routingStaffIds: routingMode === "staff" ? routingStaffIds : [],
    });
    onClose();
  };

  const canSubmit =
    !!platform &&
    !!name.trim() &&
    !(routingMode === "department" && !routingDepartmentId) &&
    !(routingMode === "staff" && routingStaffIds.length === 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-teal-400" />
            {existing ? "Edit App" : "Add App"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Platform selector (locked when editing) */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Platform</Label>
            <Select value={platform} onValueChange={handlePlatformChange} disabled={!!existing}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select platform..." />
              </SelectTrigger>
              <SelectContent>
                {platforms.map((p) => (
                  <SelectItem key={p.platform} value={p.platform}>
                    <span className="flex items-center gap-2">
                      <span>{platformIcon(p.platform)}</span>
                      {p.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mode toggle: clone saved credentials vs configure manually (create only) */}
          {platform && !existing && savedForPlatform.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("saved")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-all",
                  mode === "saved"
                    ? "border-teal-500/60 bg-teal-500/10 text-teal-400"
                    : "border-border/40 text-muted-foreground hover:border-border",
                )}
              >
                <Link2 className="h-3.5 w-3.5" />
                Use saved connection
                <span className="ml-1 bg-teal-500/20 text-teal-300 rounded-full px-1.5 text-[9px]">
                  {savedForPlatform.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => { setMode("manual"); setSelectedConnId(""); setConfig({}); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-all",
                  mode === "manual"
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                    : "border-border/40 text-muted-foreground hover:border-border",
                )}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Configure manually
              </button>
            </div>
          )}

          {/* Saved connections picker */}
          {platform && !existing && mode === "saved" && savedForPlatform.length > 0 && (
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">Choose saved connection</Label>
              {savedForPlatform.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleConnPick(c.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                    selectedConnId === c.id
                      ? "border-teal-500/60 bg-teal-500/10"
                      : "border-border/40 hover:border-border",
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-sm bg-gradient-to-br shrink-0",
                    platformColor(c.platform),
                  )}>
                    {platformIcon(c.platform)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{c.name}</p>
                    {c.description && (
                      <p className="text-[10px] text-muted-foreground truncate">{c.description}</p>
                    )}
                  </div>
                  {selectedConnId === c.id && <CheckCheck className="h-4 w-4 text-teal-400 shrink-0" />}
                </button>
              ))}
            </div>
          )}

          {/* Manual config fields */}
          {platform && (existing || mode === "manual") && (
            <ConfigFields platform={platform} platforms={platforms} value={config} onChange={setConfig} />
          )}

          {/* App name */}
          {platform && (
            <div className="grid gap-1.5">
              <Label className="text-xs">App Name <span className="text-rose-400">*</span></Label>
              <Input
                placeholder="e.g. Customer Support Bot"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9"
              />
            </div>
          )}

          {/* Routing: who receives messages from this app */}
          {platform && (
            <div className="grid gap-2 rounded-xl border border-border/40 p-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Receives messages
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: "default", label: "Primary dept", icon: Building2 },
                  { key: "department", label: "Department", icon: Users },
                  { key: "staff", label: "Specific staff", icon: UserRound },
                ] as { key: RoutingMode; label: string; icon: typeof Users }[]).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setRoutingMode(opt.key)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border py-2 text-[11px] font-medium transition-all",
                      routingMode === opt.key
                        ? "border-teal-500/60 bg-teal-500/10 text-teal-400"
                        : "border-border/40 text-muted-foreground hover:border-border",
                    )}
                  >
                    <opt.icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </button>
                ))}
              </div>

              {routingMode === "default" && (
                <p className="text-[10px] text-muted-foreground">
                  Messages route to the company's primary department.
                </p>
              )}

              {routingMode === "department" && (
                <Select value={routingDepartmentId} onValueChange={setRoutingDepartmentId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Choose a department..." />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">No departments in this company</div>
                    ) : departments.map((d) => (
                      <SelectItem key={d.id} value={d.id} className="text-xs">
                        {(d.avatar || "🏢") + " " + d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {routingMode === "staff" && (
                <div className="grid gap-1.5 max-h-44 overflow-y-auto">
                  {staff.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground">No staff in this company.</p>
                  ) : staff.map((s) => {
                    const active = routingStaffIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleStaff(s.id)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-all",
                          active ? "border-teal-500/60 bg-teal-500/10" : "border-border/40 hover:border-border",
                        )}
                      >
                        <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold bg-gradient-to-br from-violet-500 to-indigo-600 text-white shrink-0">
                          {s.avatar || s.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{s.role}</p>
                        </div>
                        {active && <CheckCheck className="h-3.5 w-3.5 text-teal-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Enabled */}
          {platform && (
            <div className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2">
              <Label className="text-xs">Enabled</Label>
              <Switch checked={enabled} onCheckedChange={setEnabled} className="scale-75" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={!canSubmit} className="bg-teal-600 hover:bg-teal-500">
            {existing ? "Save Changes" : "Add App"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Connection card ──────────────────────────────────────────────────────────
function ConnectionCard({
  conn, companyId, platforms, departments, staff, onEdit, onCopy, onToggle, onDelete,
}: {
  conn: Connection;
  companyId: string;
  platforms: PlatformDef[];
  departments: Department[];
  staff: Staff[];
  onEdit: () => void;
  onCopy: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const pLabel = platforms.find((p) => p.platform === conn.platform)?.label || conn.platform;
  const url = getWebhookUrl(companyId, conn.id, conn.platform);

  let target: string;
  const mode = routingModeOf(conn);
  if (mode === "staff") {
    const names = conn.routingStaffIds
      .map((id) => staff.find((s) => s.id === id)?.name)
      .filter(Boolean);
    target = names.length ? names.join(", ") : `${conn.routingStaffIds.length} staff`;
  } else if (mode === "department") {
    target = departments.find((d) => d.id === conn.routingDepartmentId)?.name || "Department";
  } else {
    target = "Primary department";
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={cn(
        "rounded-2xl border bg-card/60 backdrop-blur-sm p-4",
        conn.enabled ? "border-border/50" : "border-border/20 opacity-60",
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-gradient-to-br shrink-0",
          platformColor(conn.platform),
        )}>
          {platformIcon(conn.platform)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{conn.name}</p>
            <Badge variant={conn.enabled ? "default" : "outline"}
              className={cn("text-[9px] h-4 px-1.5", conn.enabled ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "")}>
              {conn.enabled ? "active" : "disabled"}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">{pLabel}</p>
        </div>
        <Switch checked={conn.enabled} onCheckedChange={onToggle} className="scale-75" />
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onEdit} title="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onCopy} title="Copy">
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-rose-400" onClick={onDelete} title="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {mode === "staff" ? <UserRound className="h-3 w-3" /> : <Users className="h-3 w-3" />}
        <span>Receives messages → </span>
        <span className="text-foreground/80 font-medium truncate">{target}</span>
      </div>

      <div className="mt-2">
        <WebhookUrlRow url={url} />
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Platform() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const scope = useCompanyScope();
  const company = scope.company;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Connection | undefined>();
  const [deleting, setDeleting] = useState<Connection | undefined>();

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["connections", company?.id, "inbound_webhook"],
    queryFn: () => api.listConnections(company!.id, "inbound_webhook"),
    enabled: !!company,
  });

  // All connections (any company / account-level) → offered as credential
  // templates when adding a new app.
  const { data: allConnections = [] } = useQuery({
    queryKey: ["connections"],
    queryFn: () => api.listConnections(),
  });

  const { data: platforms = [] } = useQuery({
    queryKey: ["platforms"],
    queryFn: api.listPlatforms,
  });

  const { data: allDepartments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: api.listDepartments,
  });

  const { data: allStaff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: api.listStaff,
  });

  // Restrict routing targets to entities that belong to the active company.
  const departments = useMemo(
    () => allDepartments.filter((d) => scope.departmentIds.has(d.id)),
    [allDepartments, scope.departmentIds],
  );
  const staff = useMemo(
    () => allStaff.filter((s) => scope.staffIds.has(s.id)),
    [allStaff, scope.staffIds],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["connections"] });
  };

  const upsert = useMutation({
    mutationFn: (draft: DraftConnection) =>
      api.upsertConnection({
        id: draft.id,
        platform: draft.platform,
        name: draft.name,
        config: draft.config,
        enabled: draft.enabled,
        kind: "inbound_webhook",
        companyId: company!.id,
        routingDepartmentId: draft.routingDepartmentId,
        routingStaffIds: draft.routingStaffIds,
      }),
    onSuccess: () => { invalidate(); toast({ title: "App saved" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteConnection(id),
    onSuccess: () => { invalidate(); toast({ title: "App deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleToggle = (c: Connection) =>
    upsert.mutate({
      id: c.id, platform: c.platform, name: c.name,
      config: (c.config as Record<string, string>) || {},
      enabled: !c.enabled,
      routingDepartmentId: c.routingDepartmentId || "",
      routingStaffIds: c.routingStaffIds || [],
    });

  const handleCopy = (c: Connection) =>
    upsert.mutate({
      id: undefined,
      platform: c.platform,
      name: `${c.name} (copy)`,
      config: (c.config as Record<string, string>) || {},
      enabled: c.enabled,
      routingDepartmentId: c.routingDepartmentId || "",
      routingStaffIds: c.routingStaffIds || [],
    });

  const openNew = () => { setEditing(undefined); setDialogOpen(true); };
  const openEdit = (c: Connection) => { setEditing(c); setDialogOpen(true); };
  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id);
    setDeleting(undefined);
  };

  if (!company) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Loading company...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-teal-500/20 to-cyan-600/20 border border-teal-500/20">
            <Plug className="h-5 w-5 text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Platform</h1>
            <p className="text-sm text-muted-foreground">
              Connect <span className="font-medium text-foreground/80">{company.name}</span> to Telegram and other
              apps, and choose who handles each app's messages.
            </p>
          </div>
        </div>
        <Button onClick={openNew} className="gap-2 bg-teal-600 hover:bg-teal-500 shadow-lg shadow-teal-500/20">
          <Plus className="h-4 w-4" />
          Add App
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          Loading apps...
        </div>
      ) : connections.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-gradient-to-br from-teal-500/10 to-cyan-600/10 border border-teal-500/20 mb-6">
            <Plug className="h-9 w-9 text-teal-400/60" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No apps connected yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Add a Telegram bot or another messaging app so users can reach this company. You decide whether a
            department or specific staff handle the conversation.
          </p>
          <Button onClick={openNew} className="gap-2 bg-teal-600 hover:bg-teal-500">
            <Plus className="h-4 w-4" />
            Add your first app
          </Button>
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="grid gap-4">
            {connections.map((c) => (
              <ConnectionCard
                key={c.id}
                conn={c}
                companyId={company.id}
                platforms={platforms}
                departments={departments}
                staff={staff}
                onEdit={() => openEdit(c)}
                onCopy={() => handleCopy(c)}
                onToggle={() => handleToggle(c)}
                onDelete={() => setDeleting(c)}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Dialog */}
      <ConnectionDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(undefined); }}
        existing={editing}
        platforms={platforms}
        connections={allConnections}
        departments={departments}
        staff={staff}
        onSave={(draft) => upsert.mutate(draft)}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete app?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? (
                <>
                  Remove <span className="font-semibold text-foreground">{deleting.name}</span> from this company?
                  Its webhook URL will stop working. This action cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-500 text-white">
              Delete app
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
