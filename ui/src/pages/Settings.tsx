import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Plug, Settings2, Globe, CheckCircle2, Eye, EyeOff, Pencil, Cpu,
} from "lucide-react";
import { api, type Connection, type PlatformDef, type LlmModelOption } from "@/lib/api";
import { PLATFORM_ICONS, PLATFORM_COLORS } from "@/lib/platforms";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Active LLM Model Section (admin-only) ────────────────────────────────────
function ActiveModelSection() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: models = [], isLoading } = useQuery({
    queryKey: ["llm-models"],
    queryFn: api.listLlmModels,
  });

  const setActive = useMutation({
    mutationFn: (name: string) => api.setActiveModel(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["llm-models"] });
      toast({ title: "Active model updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!isLoading && models.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Active LLM Model</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pick which model the whole platform uses by default. Enable more options in config.yml.
        </p>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-muted-foreground text-sm">Loading models...</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {models.map((m: LlmModelOption) => (
            <button
              key={m.name}
              type="button"
              disabled={setActive.isPending}
              onClick={() => !m.active && setActive.mutate(m.name)}
              className={cn(
                "text-left rounded-2xl border p-4 transition-colors",
                m.active
                  ? "border-teal-500/60 bg-teal-500/10"
                  : "border-border/50 bg-card/60 hover:border-teal-500/30",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted/50 shrink-0">
                    <Cpu className="h-4 w-4 text-teal-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{m.displayName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{m.providerName}</p>
                  </div>
                </div>
                {m.active && (
                  <Badge variant="outline" className="text-[9px] h-5 px-1.5 border-emerald-500/40 text-emerald-400 gap-1 shrink-0">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Active
                  </Badge>
                )}
              </div>
              {m.supportsVision && (
                <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Eye className="h-3 w-3" />
                  Vision
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Connection Form Dialog ───────────────────────────────────────────────────
function ConnectionDialog({
  open,
  onClose,
  existing,
  platforms,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  existing?: Connection;
  platforms: PlatformDef[];
  onSave: (data: Partial<Connection> & Pick<Connection, "platform" | "name">) => void;
}) {
  const [platform, setPlatform] = useState(existing?.platform || "");
  const [name, setName] = useState(existing?.name || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [config, setConfig] = useState<Record<string, string>>((existing?.config as Record<string, string>) || {});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const reset = () => {
    setPlatform(existing?.platform || "");
    setName(existing?.name || "");
    setDescription(existing?.description || "");
    setConfig((existing?.config as Record<string, string>) || {});
    setShowSecrets({});
  };

  const close = () => { reset(); onClose(); };

  const platformDef = platforms.find((p) => p.platform === platform);

  const handlePlatformChange = (v: string) => {
    setPlatform(v);
    setConfig({});
    if (!existing) {
      const def = platforms.find((p) => p.platform === v);
      setName(def?.label || "");
    }
  };

  const submit = () => {
    if (!platform || !name.trim()) return;
    onSave({
      id: existing?.id,
      platform,
      name: name.trim(),
      description,
      config,
    });
    close();
  };

  const canSubmit = Boolean(platform) && Boolean(name.trim()) && Boolean(platformDef) &&
    (platformDef?.config_fields || [])
      .filter((f) => f.required)
      .every((f) => (config[f.key] || "").trim() !== "");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-teal-400" />
            {existing ? "Edit Connection" : "Add Connection"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
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
                      <span>{PLATFORM_ICONS[p.platform] || "🔗"}</span>
                      {p.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Connection Name <span className="text-rose-400">*</span></Label>
            <Input
              placeholder="e.g. My Telegram Bot"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Description</Label>
            <Input
              placeholder="Optional notes"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-9"
            />
          </div>

          {platformDef && platformDef.config_fields.length > 0 && (
            <div className="grid gap-3 rounded-xl border border-border/40 bg-muted/20 p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                Credentials
              </p>
              {platformDef.config_fields.map((f) => {
                const isSecret = f.key.toLowerCase().includes("token") ||
                  f.key.toLowerCase().includes("secret") ||
                  f.key.toLowerCase().includes("password") ||
                  f.key.toLowerCase().includes("key");
                const visible = showSecrets[f.key];
                return (
                  <div key={f.key} className="grid gap-1.5">
                    <Label className="text-xs font-medium">
                      {f.label}
                      {f.required && <span className="text-rose-400 ml-1">*</span>}
                    </Label>
                    <div className="relative">
                      <Input
                        type={isSecret && !visible ? "password" : "text"}
                        placeholder={(f.placeholder as string) || ""}
                        value={config[f.key] || ""}
                        onChange={(e) => setConfig((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        className="h-8 text-xs pr-8"
                      />
                      {isSecret && (
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowSecrets((prev) => ({ ...prev, [f.key]: !prev[f.key] }))}
                        >
                          {visible
                            ? <EyeOff className="h-3.5 w-3.5" />
                            : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={close}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={!canSubmit}
            className="bg-teal-600 hover:bg-teal-500">
            {existing ? "Save Changes" : "Add Connection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Connection Card ──────────────────────────────────────────────────────────
function ConnectionCard({
  connection,
  platforms,
  onEdit,
  onDelete,
}: {
  connection: Connection;
  platforms: PlatformDef[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showSecrets, setShowSecrets] = useState(false);
  const pLabel = platforms.find((p) => p.platform === connection.platform)?.label || connection.platform;
  const color = PLATFORM_COLORS[connection.platform] || "from-slate-500 to-gray-600";
  const configKeys = Object.keys(connection.config || {}).filter((k) => connection.config[k]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-4"
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-gradient-to-br shrink-0",
          color
        )}>
          {PLATFORM_ICONS[connection.platform] || "🔗"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{connection.name}</p>
          <p className="text-[11px] text-muted-foreground">{pLabel}</p>
          {connection.description && (
            <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">{connection.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="outline" className="text-[9px] h-5 px-1.5 border-emerald-500/40 text-emerald-400 gap-1">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Saved
          </Badge>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon" variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-rose-400"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {configKeys.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/30">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Credentials
            </p>
            <button
              type="button"
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              onClick={() => setShowSecrets((v) => !v)}
            >
              {showSecrets ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showSecrets ? "Hide" : "Show"}
            </button>
          </div>
          <div className="grid gap-1.5">
            {configKeys.map((k) => (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground font-mono w-32 truncate shrink-0">{k}:</span>
                <span className="font-mono text-muted-foreground/70 truncate">
                  {showSecrets ? String(connection.config[k]) : "••••••••"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "system";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Connection | undefined>();
  const [filterPlatform, setFilterPlatform] = useState<string>("all");

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["connections"],
    queryFn: () => api.listConnections(),
  });

  const { data: platforms = [] } = useQuery({
    queryKey: ["platforms"],
    queryFn: api.listPlatforms,
  });

  const upsert = useMutation({
    mutationFn: api.upsertConnection,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["connections"] });
      toast({ title: "Connection saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: api.deleteConnection,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["connections"] });
      toast({ title: "Connection deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openNew = () => { setEditing(undefined); setDialogOpen(true); };
  const openEdit = (c: Connection) => { setEditing(c); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(undefined); };

  const handleSave = (data: Partial<Connection> & Pick<Connection, "platform" | "name">) => {
    upsert.mutate(data);
  };

  const usedPlatforms = [...new Set(connections.map((c) => c.platform))];
  const filtered = filterPlatform === "all"
    ? connections
    : connections.filter((c) => c.platform === filterPlatform);

  const groupedByPlatform = platforms.reduce<Record<string, Connection[]>>((acc, p) => {
    acc[p.platform] = filtered.filter((c) => c.platform === p.platform);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500/20 to-indigo-600/20 border border-violet-500/20">
            <Settings2 className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage global third-party connections. Authenticate once and reuse across companies.
            </p>
          </div>
        </div>
        <Button onClick={openNew} className="gap-2 bg-teal-600 hover:bg-teal-500 shadow-lg shadow-teal-500/20">
          <Plus className="h-4 w-4" />
          Add Connection
        </Button>
      </div>

      {isAdmin && <ActiveModelSection />}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border/40 bg-card/40 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
            <Plug className="h-5 w-5 text-teal-400" />
          </div>
          <div>
            <p className="text-2xl font-bold">{connections.length}</p>
            <p className="text-xs text-muted-foreground">Saved Connections</p>
          </div>
        </div>
        <div className="rounded-2xl border border-border/40 bg-card/40 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
            <Globe className="h-5 w-5 text-sky-400" />
          </div>
          <div>
            <p className="text-2xl font-bold">{usedPlatforms.length}</p>
            <p className="text-xs text-muted-foreground">Platforms Connected</p>
          </div>
        </div>
      </div>

      {/* Third Party Connections Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Third Party Connections</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add your platform credentials here once — then pick them when creating company hooks.
            </p>
          </div>

          {usedPlatforms.length > 1 && (
            <Select value={filterPlatform} onValueChange={setFilterPlatform}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="All platforms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All platforms</SelectItem>
                {usedPlatforms.map((p) => {
                  const def = platforms.find((pl) => pl.platform === p);
                  return (
                    <SelectItem key={p} value={p}>
                      <span className="flex items-center gap-2">
                        {PLATFORM_ICONS[p] || "🔗"} {def?.label || p}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Loading connections...</div>
        ) : connections.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-border/50"
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-teal-500/10 to-cyan-600/10 border border-teal-500/20 mb-4">
              <Plug className="h-7 w-7 text-teal-400/60" />
            </div>
            <h3 className="text-base font-semibold mb-1">No connections yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-5">
              Add credentials for Telegram, Discord, Slack, and other platforms. Reuse them freely across companies.
            </p>
            <Button onClick={openNew} className="gap-2 bg-teal-600 hover:bg-teal-500" size="sm">
              <Plus className="h-4 w-4" />
              Add your first connection
            </Button>
          </motion.div>
        ) : filterPlatform === "all" ? (
          // Group by platform
          <div className="space-y-6">
            {platforms
              .filter((p) => groupedByPlatform[p.platform]?.length > 0)
              .map((p) => (
                <div key={p.platform}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">{PLATFORM_ICONS[p.platform] || "🔗"}</span>
                    <h3 className="text-sm font-semibold">{p.label}</h3>
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                      {groupedByPlatform[p.platform].length}
                    </Badge>
                  </div>
                  <AnimatePresence mode="popLayout">
                    <div className="grid gap-3 md:grid-cols-2">
                      {groupedByPlatform[p.platform].map((c) => (
                        <ConnectionCard
                          key={c.id}
                          connection={c}
                          platforms={platforms}
                          onEdit={() => openEdit(c)}
                          onDelete={() => remove.mutate(c.id)}
                        />
                      ))}
                    </div>
                  </AnimatePresence>
                </div>
              ))}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid gap-3 md:grid-cols-2">
              {filtered.map((c) => (
                <ConnectionCard
                  key={c.id}
                  connection={c}
                  platforms={platforms}
                  onEdit={() => openEdit(c)}
                  onDelete={() => remove.mutate(c.id)}
                />
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>

      <ConnectionDialog
        open={dialogOpen}
        onClose={closeDialog}
        existing={editing}
        platforms={platforms}
        onSave={handleSave}
      />
    </div>
  );
}
