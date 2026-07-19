import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FolderKanban, Plus, Pencil, Trash2, Bot, Columns3, ListTodo, Map as MapIcon, BarChart3 } from "lucide-react";
import { api, canEditItem, canDeleteItem, type Staff, type Project } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useCompanyScope } from "@/hooks/use-company-scope";

const PLANNER_NONE = "__none__";

export default function Projects() {
  const { toast } = useToast();
  const scope = useCompanyScope();
  const [projects, setProjects] = useState<Project[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
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
    try {
      const [p, a] = await Promise.all([
        api.listProjects(scope.isOverall ? undefined : scope.company?.id),
        api.listStaff(),
      ]);
      setProjects(p);
      setStaff(a);
    } catch (e) {
      console.error(e);
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
      <div className="px-5 py-3 border-b border-border flex items-center gap-3 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
          <FolderKanban className="w-4.5 h-4.5 text-primary" />
        </div>
        <div className="mr-auto">
          <h1 className="text-base font-bold tracking-tight text-foreground leading-none">Projects</h1>
          <p className="text-[10px] text-muted-foreground mt-1">IT projects · issues, epics, sprints &amp; an AI planner</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate} className="h-9 gap-1 text-xs">
              <Plus className="w-3.5 h-3.5" /> New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Edit Project" : "Create Project"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Name</label>
                <Input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-xs" />
              </div>
              <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[80px] resize-none" />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Project lead</label>
                  <Select value={leadId} onValueChange={setLeadId}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PLANNER_NONE}>None</SelectItem>
                      {staff.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Bot className="w-3 h-3" /> Planner staff</label>
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

              <Button onClick={save} className="w-full" disabled={!key.trim() || !name.trim() || saving}>
                {editingId ? "Save Changes" : "Create Project"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        {projects.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
            <FolderKanban className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">No projects yet</p>
            <p className="text-xs mt-1">Create your first IT project to organize issues into epics and sprints.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => {
              const planner = p.plannerStaffId ? staffById.get(p.plannerStaffId) : undefined;
              return (
                <Card key={p.id} className="p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono font-bold">{p.key}</span>
                        <h3 className="text-sm font-bold text-foreground truncate">{p.name}</h3>
                      </div>
                      {p.description && <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">{p.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
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

                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Bot className="w-3 h-3" />
                    {planner ? <span>Planner: <span className="text-foreground/80 font-medium">{planner.name}</span></span> : <span className="opacity-60">No planner configured</span>}
                  </div>

                  <div className="grid grid-cols-4 gap-1 mt-auto pt-2 border-t border-border/30">
                    <Link to={`/projects/${p.key}/board`} className="flex flex-col items-center gap-1 py-1.5 rounded-md hover:bg-muted text-[9px] font-semibold text-muted-foreground hover:text-foreground">
                      <Columns3 className="w-3.5 h-3.5" /> Board
                    </Link>
                    <Link to={`/projects/${p.key}/backlog`} className="flex flex-col items-center gap-1 py-1.5 rounded-md hover:bg-muted text-[9px] font-semibold text-muted-foreground hover:text-foreground">
                      <ListTodo className="w-3.5 h-3.5" /> Backlog
                    </Link>
                    <Link to={`/projects/${p.key}/roadmap`} className="flex flex-col items-center gap-1 py-1.5 rounded-md hover:bg-muted text-[9px] font-semibold text-muted-foreground hover:text-foreground">
                      <MapIcon className="w-3.5 h-3.5" /> Roadmap
                    </Link>
                    <Link to={`/projects/${p.key}/reports`} className="flex flex-col items-center gap-1 py-1.5 rounded-md hover:bg-muted text-[9px] font-semibold text-muted-foreground hover:text-foreground">
                      <BarChart3 className="w-3.5 h-3.5" /> Reports
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
