import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderKanban, Plus, Pencil, Trash2, Bot, UserCircle2,
  Columns3, ListTodo, Map as MapIcon, BarChart3, ListChecks,
} from "lucide-react";
import { api, canEditItem, canDeleteItem, type Staff, type Project, type Task } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCompanyScope } from "@/hooks/use-company-scope";
import { cn } from "@/lib/utils";

const PLANNER_NONE = "__none__";

const QUICK_LINKS = [
  { to: "board", label: "Board", icon: Columns3 },
  { to: "backlog", label: "Backlog", icon: ListTodo },
  { to: "roadmap", label: "Roadmap", icon: MapIcon },
  { to: "reports", label: "Reports", icon: BarChart3 },
] as const;

export default function Projects() {
  const { toast } = useToast();
  const scope = useCompanyScope();
  const [projects, setProjects] = useState<Project[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [leadId, setLeadId] = useState(PLANNER_NONE);
  const [plannerStaffId, setPlannerStaffId] = useState(PLANNER_NONE);
  const [plannerSystemPrompt, setPlannerSystemPrompt] = useState("");
  const [saving, setSaving] = useState(false);

  const staffById = useMemo(() => new Map(staff.map((a) => [a.id, a])), [staff]);
  const existingKeys = useMemo(() => new Set(projects.map((p) => p.key)), [projects]);
  const withPlannerCount = useMemo(() => projects.filter((p) => p.plannerStaffId).length, [projects]);
  // Real issue count per project, from actual task rows — NOT project.issueCounter,
  // which is a monotonic key-allocation counter (for KEY-1, KEY-2, ...) that never
  // decreases, so it drifts above the true count once any issue is deleted.
  const issuesByProject = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tasks) {
      if (!t.projectId) continue;
      m.set(t.projectId, (m.get(t.projectId) ?? 0) + 1);
    }
    return m;
  }, [tasks]);
  const totalIssues = useMemo(
    () => projects.reduce((sum, p) => sum + (issuesByProject.get(p.id) ?? 0), 0),
    [projects, issuesByProject],
  );

  // Project keys are never typed by hand: derived from the current company's
  // name (initials for multi-word names, first letters for a single word). A
  // company name with no usable Latin letters (e.g. Japanese) falls back to a
  // sequential "PROJECT-1", "PROJECT-2", ... default.
  const deriveKeyFromCompany = (companyName: string) => {
    const asciiWords = companyName.trim().split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
    const base = (
      asciiWords.length > 1
        ? asciiWords.map((w) => w.match(/[a-zA-Z]/)?.[0] ?? "").join("")
        : asciiWords[0]?.replace(/[^a-zA-Z]/g, "").slice(0, 4) ?? ""
    ).toUpperCase();

    if (base) {
      let candidate = base;
      let n = 2;
      while (existingKeys.has(candidate)) {
        candidate = `${base}${n}`;
        n += 1;
      }
      return candidate;
    }

    let n = 1;
    let candidate = `PROJECT-${n}`;
    while (existingKeys.has(candidate)) {
      n += 1;
      candidate = `PROJECT-${n}`;
    }
    return candidate;
  };

  const load = async () => {
    setLoading(true);
    try {
      const [p, a, tsk] = await Promise.all([
        api.listProjects(scope.isOverall ? undefined : scope.company?.id),
        api.listStaff(),
        api.listTasks(),
      ]);
      setProjects(p);
      setStaff(a);
      setTasks(tsk);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Reload when the active office changes (this page only renders inside a
  // company via RequireCompany, but scope.company still needs to resolve).
  useEffect(() => { if (!scope.pending) void load(); }, [scope.isOverall, scope.company?.id, scope.pending]);

  const resetForm = () => {
    setEditingId(null);
    setKey("");
    setName("");
    setDescription("");
    setLeadId(PLANNER_NONE);
    setPlannerStaffId(PLANNER_NONE);
    setPlannerSystemPrompt("");
  };

  const openCreate = () => {
    resetForm();
    setKey(deriveKeyFromCompany(scope.company?.name ?? ""));
    setOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditingId(p.id);
    setKey(p.key);
    setName(p.name);
    setDescription(p.description ?? "");
    setLeadId(p.leadId || PLANNER_NONE);
    setPlannerStaffId(p.plannerStaffId || PLANNER_NONE);
    setPlannerSystemPrompt(p.plannerSystemPrompt ?? "");
    setOpen(true);
  };

  const save = async () => {
    if (!key.trim() || !name.trim()) return;
    setSaving(true);
    try {
      await api.upsertProject({
        id: editingId ?? undefined,
        key: key.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim(),
        leadId: leadId === PLANNER_NONE ? "" : leadId,
        plannerStaffId: plannerStaffId === PLANNER_NONE ? "" : plannerStaffId,
        plannerSystemPrompt: plannerSystemPrompt.trim(),
        companyId: scope.company?.id ?? "",
      });
      resetForm();
      setOpen(false);
      await load();
    } catch (e) {
      toast({ title: "Could not save project", description: String((e as Error).message ?? e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Project) => {
    if (!confirm(`Delete project "${p.name}"? Its issues, epics and sprints will be deleted too.`)) return;
    try {
      await api.deleteProject(p.id);
      await load();
    } catch (e) {
      toast({ title: "Could not delete", description: String((e as Error).message ?? e), variant: "destructive" });
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border/60 flex items-start justify-between gap-4 flex-shrink-0 bg-gradient-to-b from-muted/30 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-gradient-to-br from-cyan-500/20 to-teal-600/20 border border-cyan-500/20">
            <FolderKanban className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground leading-none">Projects</h1>
            <p className="text-xs text-muted-foreground mt-1.5">IT projects · issues, epics, sprints &amp; an AI planner</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {projects.length > 0 && (
            <div className="hidden sm:flex items-center gap-4 pr-4 border-r border-border/60">
              <div className="text-center">
                <p className="text-lg font-bold leading-none text-foreground">{projects.length}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Projects</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold leading-none text-foreground">{totalIssues}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Issues</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold leading-none text-foreground">{withPlannerCount}</p>
                <p className="text-[10px] text-muted-foreground mt-1">With planner</p>
              </div>
            </div>
          )}

          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreate} className="h-9 gap-1.5 text-xs bg-teal-600 hover:bg-teal-500 shadow-lg shadow-teal-600/20">
                <Plus className="w-3.5 h-3.5" /> New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-cyan-400" />
                  {editingId ? "Edit Project" : "Create Project"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-3">
                  <span className="shrink-0 px-2.5 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono font-bold">
                    {key || "KEY"}
                  </span>
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Name</label>
                    <Input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-xs" />
                  </div>
                </div>
                <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[80px] resize-none text-xs" />

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <UserCircle2 className="w-3 h-3" /> Project lead
                    </label>
                    <Select value={leadId} onValueChange={setLeadId}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={PLANNER_NONE}>None</SelectItem>
                        {staff.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Bot className="w-3 h-3" /> Planner staff
                    </label>
                    <Select value={plannerStaffId} onValueChange={setPlannerStaffId}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={PLANNER_NONE}>None</SelectItem>
                        {staff.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Planner instructions (optional override)</label>
                  <Textarea
                    placeholder="How should the planner break work into issues? Leave blank to use the selected staff's own system prompt."
                    value={plannerSystemPrompt}
                    onChange={(e) => setPlannerSystemPrompt(e.target.value)}
                    className="min-h-[80px] resize-none text-xs"
                  />
                </div>

                <Button
                  onClick={save}
                  className="w-full bg-teal-600 hover:bg-teal-500"
                  disabled={!key.trim() || !name.trim() || saving}
                >
                  {editingId ? "Save Changes" : "Create Project"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[172px] rounded-2xl border border-border/40 bg-card/40 animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full flex flex-col items-center justify-center text-center"
          >
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-gradient-to-br from-cyan-500/10 to-teal-600/10 border border-cyan-500/20 mb-6">
              <FolderKanban className="w-9 h-9 text-cyan-400/60" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">No projects yet</h2>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Create your first IT project to organize issues into epics and sprints, with an AI planner to help.
            </p>
            <Button onClick={openCreate} className="gap-2 bg-teal-600 hover:bg-teal-500">
              <Plus className="h-4 w-4" /> Create your first project
            </Button>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => {
                const planner = p.plannerStaffId ? staffById.get(p.plannerStaffId) : undefined;
                const lead = p.leadId ? staffById.get(p.leadId) : undefined;
                return (
                  <motion.div
                    layout
                    key={p.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className="group rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 flex flex-col gap-3 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/5 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/projects/${p.key}/board`} className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-mono font-bold shrink-0">
                            {p.key}
                          </span>
                          <h3 className="text-sm font-bold text-foreground truncate group-hover:text-cyan-400 transition-colors">{p.name}</h3>
                        </div>
                        <p className={cn(
                          "text-[11px] text-muted-foreground mt-1.5 line-clamp-2",
                          !p.description && "italic opacity-60",
                        )}>
                          {p.description || "No description"}
                        </p>
                      </Link>
                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canEditItem(p) && (
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteItem(p) && (
                          <button onClick={() => remove(p)} className="p-1.5 rounded-md hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <ListChecks className="w-3 h-3" />
                        <span>{issuesByProject.get(p.id) ?? 0} issues</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Bot className="w-3 h-3 shrink-0" />
                        {planner ? <span className="text-foreground/80 font-medium truncate">{planner.name}</span> : <span className="opacity-60">No planner</span>}
                      </div>
                    </div>

                    {lead && (
                      <div className="flex items-center gap-1.5 -mt-1 text-[10px] text-muted-foreground">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold bg-gradient-to-br from-violet-500 to-indigo-600 text-white shrink-0">
                          {lead.name[0]}
                        </div>
                        <span>Led by <span className="text-foreground/80 font-medium">{lead.name}</span></span>
                      </div>
                    )}

                    <div className="grid grid-cols-4 gap-1 mt-auto pt-2 border-t border-border/30">
                      {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
                        <Link
                          key={to}
                          to={`/projects/${p.key}/${to}`}
                          className="flex flex-col items-center gap-1 py-1.5 rounded-lg hover:bg-cyan-500/10 text-[9px] font-semibold text-muted-foreground hover:text-cyan-400 transition-colors"
                        >
                          <Icon className="w-3.5 h-3.5" /> {label}
                        </Link>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
