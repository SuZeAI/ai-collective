import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Plug, Copy, CheckCheck, ChevronDown, ChevronRight,
  BrainCircuit, Users, Webhook, Settings2, RefreshCw,
  MessageCircle, Zap, Globe, Link2,
} from "lucide-react";
import { api, type Workspace, type PlatformHook, type PlatformDef, type Team, type ThirdPartyConnection } from "@/lib/api";
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string) || "http://localhost:8000/api/v1";

function getWebhookUrl(workspaceId: string, hookId: string, platform: string): string {
  return `${API_BASE}/webhook/${platform}/${workspaceId}/${hookId}`;
}

const PLATFORM_ICONS: Record<string, string> = {
  telegram: "✈️", discord: "🎮", slack: "💬", teams: "🟦",
  whatsapp_business: "💚", facebook_messenger: "💙", instagram: "📸",
  line_messaging: "🟢", viber_messaging: "💜", zalo_messaging: "🔵",
  signal_messaging: "🔒", skype_messaging: "🌐", wire_messaging: "⚡",
  wechat_messaging: "🟩", snapchat_messaging: "👻",
};

const PLATFORM_COLORS: Record<string, string> = {
  telegram: "from-sky-500 to-blue-600",
  discord: "from-indigo-500 to-violet-600",
  slack: "from-amber-500 to-orange-500",
  teams: "from-blue-500 to-indigo-600",
  whatsapp_business: "from-emerald-500 to-green-600",
  facebook_messenger: "from-blue-400 to-indigo-500",
  instagram: "from-pink-500 to-rose-600",
  line_messaging: "from-green-500 to-teal-600",
  viber_messaging: "from-violet-500 to-purple-600",
  zalo_messaging: "from-blue-500 to-sky-600",
  signal_messaging: "from-slate-500 to-gray-600",
  skype_messaging: "from-sky-400 to-blue-500",
  wire_messaging: "from-zinc-500 to-slate-600",
  wechat_messaging: "from-green-400 to-emerald-500",
  snapchat_messaging: "from-yellow-400 to-amber-500",
};

// ─── Hook Form ────────────────────────────────────────────────────────────────
function HookConfigForm({
  platform,
  platforms,
  value,
  onChange,
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
            placeholder={f.placeholder as string || ""}
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

// ─── Add Hook Dialog ──────────────────────────────────────────────────────────
function AddHookDialog({
  open,
  onClose,
  platforms,
  connections,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  platforms: PlatformDef[];
  connections: ThirdPartyConnection[];
  onAdd: (hook: Omit<PlatformHook, "id">) => void;
}) {
  const [platform, setPlatform] = useState("");
  const [name, setName] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"saved" | "manual">("saved");
  const [selectedConnId, setSelectedConnId] = useState("");

  const reset = () => {
    setPlatform(""); setName(""); setConfig({});
    setMode("saved"); setSelectedConnId("");
  };
  const close = () => { reset(); onClose(); };

  const savedForPlatform = connections.filter((c) => c.platform === platform);

  const handlePlatformChange = (v: string) => {
    setPlatform(v);
    setConfig({});
    setSelectedConnId("");
    const hasSaved = connections.some((c) => c.platform === v);
    setMode(hasSaved ? "saved" : "manual");
  };

  const handleConnPick = (connId: string) => {
    setSelectedConnId(connId);
    const conn = connections.find((c) => c.id === connId);
    if (conn) {
      setConfig(conn.config as Record<string, string>);
      if (!name) setName(conn.name);
    }
  };

  const submit = () => {
    if (!platform || !name) return;
    onAdd({ platform, name, config, description: "", enabled: true });
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-teal-400" />
            Add Platform Hook
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Platform selector */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Platform</Label>
            <Select value={platform} onValueChange={handlePlatformChange}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select platform..." />
              </SelectTrigger>
              <SelectContent>
                {platforms.map((p) => {
                  const hasSaved = connections.some((c) => c.platform === p.platform);
                  return (
                    <SelectItem key={p.platform} value={p.platform}>
                      <span className="flex items-center gap-2">
                        <span>{PLATFORM_ICONS[p.platform] || "🔗"}</span>
                        {p.label}
                        {hasSaved && (
                          <span className="text-[9px] text-teal-400 border border-teal-500/40 rounded-full px-1.5 py-0.5">
                            {connections.filter((c) => c.platform === p.platform).length} saved
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Mode toggle: use saved vs manual */}
          {platform && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("saved")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-all",
                  mode === "saved"
                    ? "border-teal-500/60 bg-teal-500/10 text-teal-400"
                    : "border-border/40 text-muted-foreground hover:border-border"
                )}
              >
                <Link2 className="h-3.5 w-3.5" />
                Use saved connection
                {savedForPlatform.length > 0 && (
                  <span className="ml-1 bg-teal-500/20 text-teal-300 rounded-full px-1.5 text-[9px]">
                    {savedForPlatform.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setMode("manual"); setSelectedConnId(""); setConfig({}); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-all",
                  mode === "manual"
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                    : "border-border/40 text-muted-foreground hover:border-border"
                )}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Configure manually
              </button>
            </div>
          )}

          {/* Saved connections picker */}
          {platform && mode === "saved" && (
            <>
              {savedForPlatform.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/50 p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-2">
                    No saved connections for this platform yet.
                  </p>
                  <button
                    type="button"
                    className="text-xs text-teal-400 underline underline-offset-2"
                    onClick={() => setMode("manual")}
                  >
                    Configure manually instead
                  </button>
                </div>
              ) : (
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
                          : "border-border/40 hover:border-border"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-sm bg-gradient-to-br shrink-0",
                        PLATFORM_COLORS[c.platform] || "from-slate-500 to-gray-600"
                      )}>
                        {PLATFORM_ICONS[c.platform] || "🔗"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{c.name}</p>
                        {c.description && (
                          <p className="text-[10px] text-muted-foreground truncate">{c.description}</p>
                        )}
                      </div>
                      {selectedConnId === c.id && (
                        <CheckCheck className="h-4 w-4 text-teal-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Manual config */}
          {platform && mode === "manual" && (
            <HookConfigForm
              platform={platform}
              platforms={platforms}
              value={config}
              onChange={setConfig}
            />
          )}

          {/* Hook name */}
          {platform && (
            <div className="grid gap-1.5">
              <Label className="text-xs">Hook Name <span className="text-rose-400">*</span></Label>
              <Input
                placeholder="e.g. Customer Support Bot"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={close}>Cancel</Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={
              !platform || !name ||
              (mode === "saved" && !selectedConnId && savedForPlatform.length > 0)
            }
            className="bg-teal-600 hover:bg-teal-500"
          >
            Add Hook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Workspace Form Dialog ────────────────────────────────────────────────────
function WorkspaceDialog({
  open,
  onClose,
  existing,
  teams,
  platforms,
  connections,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  existing?: Workspace;
  teams: Team[];
  platforms: PlatformDef[];
  connections: ThirdPartyConnection[];
  onSave: (data: Partial<Workspace> & Pick<Workspace, "name">) => void;
}) {
  const [name, setName] = useState(existing?.name || "");
  const [desc, setDesc] = useState(existing?.description || "");
  const [teamIds, setTeamIds] = useState<string[]>(existing?.teamIds || []);
  const [primaryTeamId, setPrimaryTeamId] = useState(existing?.primaryTeamId || "");
  const [hooks, setHooks] = useState<PlatformHook[]>(existing?.platformHooks || []);
  const [addHookOpen, setAddHookOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setName(existing?.name || "");
      setDesc(existing?.description || "");
      setTeamIds(existing?.teamIds || []);
      setPrimaryTeamId(existing?.primaryTeamId || "");
      setHooks(existing?.platformHooks || []);
    }
  }, [open, existing]);

  const toggleTeam = (id: string) => {
    setTeamIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    if (!teamIds.includes(id) && !primaryTeamId) setPrimaryTeamId(id);
  };

  const addHook = (h: Omit<PlatformHook, "id">) => {
    const newHook: PlatformHook = { ...h, id: `hook_${Date.now()}` };
    setHooks((prev) => [...prev, newHook]);
  };

  const removeHook = (id: string) => setHooks((prev) => prev.filter((h) => h.id !== id));
  const toggleHook = (id: string) =>
    setHooks((prev) => prev.map((h) => h.id === id ? { ...h, enabled: !h.enabled } : h));

  const submit = () => {
    if (!name.trim()) return;
    onSave({
      id: existing?.id,
      name: name.trim(),
      description: desc,
      teamIds,
      primaryTeamId: primaryTeamId || teamIds[0] || "",
      platformHooks: hooks,
    });
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="w-[min(95vw,1280px)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-teal-400" />
              {existing ? "Edit Workspace" : "New Workspace"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            {/* Name + Description */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Workspace Name <span className="text-rose-400">*</span></Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My AI Workspace" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Description</Label>
                <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What this workspace does" />
              </div>
            </div>

            {/* Teams */}
            <div className="grid gap-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Teams
              </Label>
              {teams.length === 0 ? (
                <p className="text-xs text-muted-foreground">No teams yet. Create teams first.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {teams.map((t) => {
                    const active = teamIds.includes(t.id);
                    const isPrimary = primaryTeamId === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => toggleTeam(t.id)}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border p-3 cursor-pointer transition-all",
                          active
                            ? "border-teal-500/50 bg-teal-500/10"
                            : "border-border/40 hover:border-border"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold",
                          "bg-gradient-to-br from-violet-500 to-indigo-600 text-white"
                        )}>
                          {t.avatar || t.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{t.name}</p>
                          <p className="text-[10px] text-muted-foreground">{t.agents.length} agents</p>
                        </div>
                        {active && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setPrimaryTeamId(t.id); }}
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded-full border transition-colors",
                              isPrimary
                                ? "border-teal-400 text-teal-400 bg-teal-400/10"
                                : "border-border text-muted-foreground hover:border-teal-400"
                            )}
                          >
                            {isPrimary ? "Primary" : "Set Primary"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Platform Hooks */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  Platform Hooks
                </Label>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                  onClick={() => setAddHookOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add Hook
                </Button>
              </div>

              {hooks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/50 p-6 text-center">
                  <Plug className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No hooks yet. Add a platform to connect.</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {hooks.map((h) => {
                    const pLabel = platforms.find((p) => p.platform === h.platform)?.label || h.platform;
                    const color = PLATFORM_COLORS[h.platform] || "from-slate-500 to-gray-600";
                    const webhookUrl = existing
                      ? getWebhookUrl(existing.id, h.id, h.platform)
                      : "(Save workspace first to get URL)";

                    return (
                      <div key={h.id} className={cn(
                        "rounded-xl border p-3 transition-all",
                        h.enabled ? "border-border/50" : "border-border/20 opacity-60"
                      )}>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center text-base bg-gradient-to-br",
                            color
                          )}>
                            {PLATFORM_ICONS[h.platform] || "🔗"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{h.name}</p>
                            <p className="text-[11px] text-muted-foreground">{pLabel}</p>
                          </div>
                          <Switch
                            checked={h.enabled}
                            onCheckedChange={() => toggleHook(h.id)}
                            className="scale-75"
                          />
                          <Button
                            size="icon" variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-rose-400"
                            onClick={() => removeHook(h.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {existing && (
                          <div className="mt-2">
                            <WebhookUrlRow url={webhookUrl} />
                          </div>
                        )}
                        {!existing && (
                          <p className="mt-1.5 text-[10px] text-muted-foreground px-1">
                            💡 Save workspace to get webhook URL
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={submit} disabled={!name.trim()}
              className="bg-teal-600 hover:bg-teal-500">
              {existing ? "Save Changes" : "Create Workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddHookDialog
        open={addHookOpen}
        onClose={() => setAddHookOpen(false)}
        platforms={platforms}
        connections={connections}
        onAdd={addHook}
      />
    </>
  );
}

// ─── Workspace Card ───────────────────────────────────────────────────────────
function WorkspaceCard({
  workspace,
  teams,
  platforms,
  onEdit,
  onDelete,
}: {
  workspace: Workspace;
  teams: Team[];
  platforms: PlatformDef[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const wsTeams = teams.filter((t) => workspace.teamIds.includes(t.id));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-4 p-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/20">
          {workspace.avatar || workspace.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">{workspace.name}</h3>
          <p className="text-xs text-muted-foreground truncate">{workspace.description || "No description"}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-border/40 px-2 py-1">
            <Users className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">{workspace.teamIds.length}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-border/40 px-2 py-1">
            <Plug className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">{workspace.platformHooks.length}</span>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onEdit}>
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-400"
            onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7"
            onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/40 p-4 grid gap-4">
              {/* Teams */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Teams</p>
                {wsTeams.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No teams assigned</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {wsTeams.map((t) => (
                      <div key={t.id} className="flex items-center gap-1.5 rounded-lg border border-border/40 px-2.5 py-1.5">
                        <div className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                          {t.avatar || t.name[0]}
                        </div>
                        <span className="text-xs font-medium">{t.name}</span>
                        {workspace.primaryTeamId === t.id && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1 border-teal-500/50 text-teal-400">
                            primary
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Hooks */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Platform Hooks</p>
                {workspace.platformHooks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No hooks configured</p>
                ) : (
                  <div className="grid gap-2">
                    {workspace.platformHooks.map((h) => {
                      const pLabel = platforms.find((p) => p.platform === h.platform)?.label || h.platform;
                      const color = PLATFORM_COLORS[h.platform] || "from-slate-500 to-gray-600";
                      const url = getWebhookUrl(workspace.id, h.id, h.platform);
                      return (
                        <div key={h.id} className="rounded-xl border border-border/40 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-sm bg-gradient-to-br", color)}>
                              {PLATFORM_ICONS[h.platform] || "🔗"}
                            </div>
                            <div className="flex-1">
                              <span className="text-xs font-medium">{h.name}</span>
                              <span className="text-[10px] text-muted-foreground ml-2">· {pLabel}</span>
                            </div>
                            <Badge variant={h.enabled ? "default" : "outline"}
                              className={cn("text-[9px] h-4 px-1.5", h.enabled ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "")}>
                              {h.enabled ? "active" : "disabled"}
                            </Badge>
                          </div>
                          <WebhookUrlRow url={url} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Workspaces() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Workspace | undefined>();

  const { data: workspaces = [], isLoading: wsLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: api.listWorkspaces,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: api.listTeams,
  });

  const { data: platforms = [] } = useQuery({
    queryKey: ["platforms"],
    queryFn: api.listPlatforms,
  });

  const { data: connections = [] } = useQuery({
    queryKey: ["connections"],
    queryFn: api.listConnections,
  });

  const upsert = useMutation({
    mutationFn: api.upsertWorkspace,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      toast({ title: "Workspace saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: api.deleteWorkspace,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      toast({ title: "Workspace deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openNew = () => { setEditing(undefined); setDialogOpen(true); };
  const openEdit = (ws: Workspace) => { setEditing(ws); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(undefined); };

  const handleSave = (data: Partial<Workspace> & Pick<Workspace, "name">) => {
    upsert.mutate(data as any);
  };

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-teal-500/20 to-cyan-600/20 border border-teal-500/20">
              <BrainCircuit className="h-5 w-5 text-teal-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Workspaces</h1>
              <p className="text-sm text-muted-foreground">
                Group teams + messaging platform hooks. Messages from any platform trigger your AI teams.
              </p>
            </div>
          </div>
        </div>
        <Button onClick={openNew} className="gap-2 bg-teal-600 hover:bg-teal-500 shadow-lg shadow-teal-500/20">
          <Plus className="h-4 w-4" />
          New Workspace
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Workspaces", value: workspaces.length, icon: BrainCircuit, color: "text-teal-400" },
          { label: "Active Hooks", value: workspaces.reduce((s, w) => s + w.platformHooks.filter(h => h.enabled).length, 0), icon: Plug, color: "text-emerald-400" },
          { label: "Platforms", value: platforms.length, icon: Globe, color: "text-sky-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-border/40 bg-card/40 p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
              <Icon className={cn("h-5 w-5", color)} />
            </div>
            <div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Platform chips */}
      {platforms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {platforms.map((p) => (
            <div key={p.platform} className={cn(
              "flex items-center gap-1.5 rounded-full border border-border/30 px-3 py-1",
              "bg-gradient-to-r opacity-80 hover:opacity-100 transition-opacity text-xs"
            )}>
              <span>{PLATFORM_ICONS[p.platform] || "🔗"}</span>
              <span className="text-muted-foreground">{p.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Workspace list */}
      {wsLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          Loading workspaces...
        </div>
      ) : workspaces.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-gradient-to-br from-teal-500/10 to-cyan-600/10 border border-teal-500/20 mb-6">
            <BrainCircuit className="h-9 w-9 text-teal-400/60" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No workspaces yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Create a workspace to link your AI teams with messaging platforms like Telegram, Discord, Slack, WhatsApp, and more.
          </p>
          <Button onClick={openNew} className="gap-2 bg-teal-600 hover:bg-teal-500">
            <Plus className="h-4 w-4" />
            Create your first workspace
          </Button>
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="grid gap-4">
            {workspaces.map((ws) => (
              <WorkspaceCard
                key={ws.id}
                workspace={ws}
                teams={teams}
                platforms={platforms}
                onEdit={() => openEdit(ws)}
                onDelete={() => remove.mutate(ws.id)}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* How it works */}
      {workspaces.length > 0 && (
        <div className="rounded-2xl border border-border/30 bg-card/30 p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">How It Works</p>
          <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground">
            {[
              { icon: MessageCircle, step: "1. User sends message", desc: "A user messages your bot on any connected platform." },
              { icon: Zap, step: "2. AI team processes it", desc: "Your workspace's primary team handles the request via the agent graph." },
              { icon: CheckCheck, step: "3. Response is sent back", desc: "The AI response is automatically sent back to the user on the same platform." },
            ].map(({ icon: Icon, step, desc }) => (
              <div key={step} className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-teal-400" />
                </div>
                <div>
                  <p className="font-medium text-foreground/80 mb-0.5">{step}</p>
                  <p>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialog */}
      <WorkspaceDialog
        open={dialogOpen}
        onClose={closeDialog}
        existing={editing}
        teams={teams}
        platforms={platforms}
        connections={connections}
        onSave={handleSave}
      />
    </div>
  );
}
