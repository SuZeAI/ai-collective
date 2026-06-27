import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Plug, Copy, CheckCheck, ChevronDown, ChevronRight,
  BrainCircuit, Users, Webhook, Settings2, RefreshCw,
  MessageCircle, Zap, Globe, Link2, Download,
} from "lucide-react";
import { api, canDeleteItem, canEditItem, type Company, type PlatformHook, type PlatformDef, type Department, type ThirdPartyConnection, type CompanyType } from "@/lib/api";
import { COMPANY_TYPES, COMPANY_TYPE_MAP, companyTypeOf } from "@/lib/company-types";
import { useLanguage } from "@/contexts/LanguageContext";
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

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string) || "/api/v1";

function getWebhookUrl(companyId: string, hookId: string, platform: string): string {
  return `${API_BASE}/webhook/${platform}/${companyId}/${hookId}`;
}

const PLATFORM_ICONS: Record<string, string> = {
  telegram: "✈️", discord: "🎮", slack: "💬", departments: "🟦",
  whatsapp_business: "💚", facebook_messenger: "💙", instagram: "📸",
  line_messaging: "🟢", viber_messaging: "💜", zalo_messaging: "🔵",
  signal_messaging: "🔒", skype_messaging: "🌐", wire_messaging: "⚡",
  wechat_messaging: "🟩", snapchat_messaging: "👻",
};

const PLATFORM_COLORS: Record<string, string> = {
  telegram: "from-sky-500 to-blue-600",
  discord: "from-indigo-500 to-violet-600",
  slack: "from-amber-500 to-orange-500",
  departments: "from-blue-500 to-indigo-600",
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

// ─── Company Form Dialog ────────────────────────────────────────────────────
function CompanyDialog({
  open,
  onClose,
  existing,
  departments,
  platforms,
  connections,
  onSave,
  companies = [],
}: {
  open: boolean;
  onClose: () => void;
  existing?: Company;
  departments: Department[];
  platforms: PlatformDef[];
  connections: ThirdPartyConnection[];
  onSave: (data: Partial<Company> & Pick<Company, "name">) => void;
  companies?: Company[];
}) {
  const { t: lang } = useLanguage();
  const [name, setName] = useState(existing?.name || "");
  const [desc, setDesc] = useState(existing?.description || "");
  const [type, setType] = useState<CompanyType>(existing?.type ?? "general");
  const [departmentIds, setDepartmentIds] = useState<string[]>(existing?.departmentIds || []);
  const [primaryDepartmentId, setPrimaryDepartmentId] = useState(existing?.primaryDepartmentId || "");
  const [hooks, setHooks] = useState<PlatformHook[]>(existing?.platformHooks || []);
  const [addHookOpen, setAddHookOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setName(existing?.name || "");
      setDesc(existing?.description || "");
      setType(existing?.type ?? "general");
      setDepartmentIds(existing?.departmentIds || []);
      setPrimaryDepartmentId(existing?.primaryDepartmentId || "");
      setHooks(existing?.platformHooks || []);
    }
  }, [open, existing]);

  const handleImportFromOffice = (wsId: string) => {
    const sourceWs = companies.find((w) => w.id === wsId);
    if (sourceWs) {
      setDepartmentIds(sourceWs.departmentIds || []);
      setPrimaryDepartmentId(sourceWs.primaryDepartmentId || "");
      // Generate new IDs for imported hooks to prevent collisions
      const importedHooks = (sourceWs.platformHooks || []).map((h, index) => ({
        ...h,
        id: `hook_imported_${Date.now()}_${index}`,
      }));
      setHooks(importedHooks);
    }
  };

  const toggleDepartment = (id: string) => {
    setDepartmentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    if (!departmentIds.includes(id) && !primaryDepartmentId) setPrimaryDepartmentId(id);
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
      type,
      departmentIds,
      primaryDepartmentId: primaryDepartmentId || departmentIds[0] || "",
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
              {existing ? "Edit Company" : "New Company"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            {/* Import from another office (Only shown when creating a new office) */}
            {!existing && companies.length > 0 && (
              <div className="rounded-xl border border-dashed border-teal-500/30 bg-teal-500/5 p-4 grid gap-3">
                <div className="flex items-center gap-2.5">
                  <Download className="h-4 w-4 text-teal-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Import settings from another Company</h4>
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      Clone departments and platform hooks instantly from an existing company.
                    </p>
                  </div>
                </div>
                <div className="max-w-md">
                  <Select onValueChange={handleImportFromOffice}>
                    <SelectTrigger className="h-8 text-xs bg-background/50">
                      <SelectValue placeholder="Choose office to import from..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((ws) => (
                        <SelectItem key={ws.id} value={ws.id} className="text-xs">
                          {ws.name} ({ws.departmentIds.length} departments, {ws.platformHooks.length} hooks)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Name + Description */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Company Name <span className="text-rose-400">*</span></Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My AI Company" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Description</Label>
                <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What this company does" />
              </div>
            </div>

            {/* Company type — drives which options are suggested inside it */}
            <div className="grid gap-1.5">
              <Label className="text-xs">{lang.companyTypeLabel}</Label>
              <Select value={type} onValueChange={(v) => setType(v as CompanyType)}>
                <SelectTrigger className="h-9 text-xs w-full sm:w-[260px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPANY_TYPES.map((ct) => (
                    <SelectItem key={ct.value} value={ct.value} className="text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <ct.icon className="h-3.5 w-3.5" />
                        {lang.companyTypes[ct.value]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Departments */}
            <div className="grid gap-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Departments
              </Label>
              {departments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No departments yet. Create departments first.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {departments.map((t) => {
                    const active = departmentIds.includes(t.id);
                    const isPrimary = primaryDepartmentId === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => toggleDepartment(t.id)}
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
                          <p className="text-[10px] text-muted-foreground">{t.staff.length} personnel</p>
                        </div>
                        {active && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setPrimaryDepartmentId(t.id); }}
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
                      : "(Save company first to get URL)";

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
                            💡 Save office to get webhook URL
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
              {existing ? "Save Changes" : "Create Office"}
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

// ─── Company Card ───────────────────────────────────────────────────────────
function CompanyCard({
  company,
  departments,
  platforms,
  onEdit,
  onDelete,
}: {
  company: Company;
  departments: Department[];
  platforms: PlatformDef[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t: lang } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const wsDepartments = departments.filter((t) => company.departmentIds.includes(t.id));
  const wsType = companyTypeOf(company);
  const wsTypeDef = COMPANY_TYPE_MAP[wsType];

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
          {company.avatar || company.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate">{company.name}</h3>
            <span className={cn("shrink-0 inline-flex items-center gap-1 rounded-full text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 border", wsTypeDef.accent)}>
              <wsTypeDef.icon className="h-2.5 w-2.5" />
              {lang.companyTypes[wsType]}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{company.description || "No description"}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-border/40 px-2 py-1">
            <Users className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">{company.departmentIds.length}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-border/40 px-2 py-1">
            <Plug className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">{company.platformHooks.length}</span>
          </div>
          {canEditItem(company) && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onEdit}>
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {canDeleteItem(company) && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-400"
              onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
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
              {/* Departments */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Departments</p>
                {wsDepartments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No departments assigned</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {wsDepartments.map((t) => (
                      <div key={t.id} className="flex items-center gap-1.5 rounded-lg border border-border/40 px-2.5 py-1.5">
                        <div className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                          {t.avatar || t.name[0]}
                        </div>
                        <span className="text-xs font-medium">{t.name}</span>
                        {company.primaryDepartmentId === t.id && (
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
                {company.platformHooks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No hooks configured</p>
                ) : (
                  <div className="grid gap-2">
                    {company.platformHooks.map((h) => {
                      const pLabel = platforms.find((p) => p.platform === h.platform)?.label || h.platform;
                      const color = PLATFORM_COLORS[h.platform] || "from-slate-500 to-gray-600";
                      const url = getWebhookUrl(company.id, h.id, h.platform);
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
export default function Companies() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Company | undefined>();
  const [deleting, setDeleting] = useState<Company | undefined>();

  const { data: companies = [], isLoading: wsLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: api.listCompanies,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: api.listDepartments,
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
    mutationFn: api.upsertCompany,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "Office saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: api.deleteCompany,
    onSuccess: () => {
      // The company and all of its related data (departments, documents,
      // office-builder sessions, …) are cleaned up server-side. Refresh the
      // department list so deleted ones stop showing in the New Company dialog.
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["departments"] });
      toast({ title: "Company deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id);
    setDeleting(undefined);
  };

  const openNew = () => { setEditing(undefined); setDialogOpen(true); };
  const openEdit = (ws: Company) => { setEditing(ws); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(undefined); };

  const handleSave = (data: Partial<Company> & Pick<Company, "name">) => {
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
              <h1 className="text-2xl font-bold tracking-tight">Manage Companies</h1>
              <p className="text-sm text-muted-foreground">
                Create and control companies — group departments + messaging platform hooks. Messages from any platform trigger your departments.
              </p>
            </div>
          </div>
        </div>
        <Button onClick={openNew} className="gap-2 bg-teal-600 hover:bg-teal-500 shadow-lg shadow-teal-500/20">
          <Plus className="h-4 w-4" />
          New Company
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Companies", value: companies.length, icon: BrainCircuit, color: "text-teal-400" },
          { label: "Active Hooks", value: companies.reduce((s, w) => s + w.platformHooks.filter(h => h.enabled).length, 0), icon: Plug, color: "text-emerald-400" },
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

      {/* Company list */}
      {wsLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          Loading companies...
        </div>
      ) : companies.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-gradient-to-br from-teal-500/10 to-cyan-600/10 border border-teal-500/20 mb-6">
            <BrainCircuit className="h-9 w-9 text-teal-400/60" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No companies yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Create a company to link your departments with messaging platforms like Telegram, Discord, Slack, WhatsApp, and more.
          </p>
          <Button onClick={openNew} className="gap-2 bg-teal-600 hover:bg-teal-500">
            <Plus className="h-4 w-4" />
            Create your first company
          </Button>
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="grid gap-4">
            {companies.map((ws) => (
              <CompanyCard
                key={ws.id}
                company={ws}
                departments={departments}
                platforms={platforms}
                onEdit={() => openEdit(ws)}
                onDelete={() => setDeleting(ws)}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* How it works */}
      {companies.length > 0 && (
        <div className="rounded-2xl border border-border/30 bg-card/30 p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">How It Works</p>
          <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground">
            {[
              { icon: MessageCircle, step: "1. User sends message", desc: "A user messages your bot on any connected platform." },
              { icon: Zap, step: "2. Department processes it", desc: "Your office's primary department handles the request via the personnel graph." },
              { icon: CheckCheck, step: "3. Response is sent back", desc: "The response is automatically sent back to the user on the same platform." },
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
      <CompanyDialog
        open={dialogOpen}
        onClose={closeDialog}
        existing={editing}
        departments={departments}
        platforms={platforms}
        connections={connections}
        onSave={handleSave}
        companies={companies}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete company?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? (
                <>
                  Are you sure you want to delete <span className="font-semibold text-foreground">{deleting.name}</span>?
                  This permanently removes the company along with all of its related data — departments links,
                  platform hooks, document library, and office-builder history. This action cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-rose-600 hover:bg-rose-500 text-white"
            >
              Delete company
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
