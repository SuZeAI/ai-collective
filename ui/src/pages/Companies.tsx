import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, ChevronDown, ChevronRight,
  BrainCircuit, Users, Settings2, RefreshCw, Download,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, canDeleteItem, canEditItem, type Company, type Department, type CompanyType, type CompanyDeleteImpact } from "@/lib/api";
import { setActiveCompanyId } from "@/hooks/use-company-scope";
import { COMPANY_TYPES, COMPANY_TYPE_MAP, companyTypeOf } from "@/lib/company-types";
import { useLanguage } from "@/contexts/LanguageContext";
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
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Company Form Dialog ────────────────────────────────────────────────────
// Platform/app connections were moved out of this dialog to the per-company
// Platform page (/platform). This dialog only manages a company's identity and
// its department assignments.
function CompanyDialog({
  open,
  onClose,
  existing,
  departments,
  onSave,
  companies = [],
}: {
  open: boolean;
  onClose: () => void;
  existing?: Company;
  departments: Department[];
  onSave: (data: Partial<Company> & Pick<Company, "name">) => void;
  companies?: Company[];
}) {
  const { t: lang } = useLanguage();
  const [name, setName] = useState(existing?.name || "");
  const [desc, setDesc] = useState(existing?.description || "");
  const [type, setType] = useState<CompanyType>(existing?.type ?? "general");
  const [departmentIds, setDepartmentIds] = useState<string[]>(existing?.departmentIds || []);
  const [primaryDepartmentId, setPrimaryDepartmentId] = useState(existing?.primaryDepartmentId || "");

  useEffect(() => {
    if (open) {
      setName(existing?.name || "");
      setDesc(existing?.description || "");
      setType(existing?.type ?? "general");
      setDepartmentIds(existing?.departmentIds || []);
      setPrimaryDepartmentId(existing?.primaryDepartmentId || "");
    }
  }, [open, existing]);

  const handleImportFromOffice = (wsId: string) => {
    const sourceWs = companies.find((w) => w.id === wsId);
    if (sourceWs) {
      setDepartmentIds(sourceWs.departmentIds || []);
      setPrimaryDepartmentId(sourceWs.primaryDepartmentId || "");
    }
  };

  const toggleDepartment = (id: string) => {
    setDepartmentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    if (!departmentIds.includes(id) && !primaryDepartmentId) setPrimaryDepartmentId(id);
  };

  const submit = () => {
    if (!name.trim()) return;
    onSave({
      id: existing?.id,
      name: name.trim(),
      description: desc,
      type,
      departmentIds,
      primaryDepartmentId: primaryDepartmentId || departmentIds[0] || "",
    });
    onClose();
  };

  return (
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
                  <h4 className="text-xs font-semibold text-foreground">{lang.companiesPage.importFromOffice}</h4>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    Clone departments instantly from an existing company.
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
                        {ws.name} ({ws.departmentIds.length} departments)
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
              <p className="text-xs text-muted-foreground">{lang.companiesPage.noDepartmentsYet}</p>
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
  );
}

// ─── Company Card ───────────────────────────────────────────────────────────
function CompanyCard({
  company,
  departments,
  onEdit,
  onDelete,
}: {
  company: Company;
  departments: Department[];
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
                  <p className="text-xs text-muted-foreground">{lang.companiesPage.noDepartmentsAssigned}</p>
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Companies() {
  const { t: lang } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Company | undefined>();
  const [deleting, setDeleting] = useState<Company | undefined>();
  const [deletingImpact, setDeletingImpact] = useState<CompanyDeleteImpact | null>(null);

  const { data: companies = [], isLoading: wsLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: api.listCompanies,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api.listDepartments(),
  });

  const upsert = useMutation({
    mutationFn: (data: Partial<Company> & Pick<Company, "name">) =>
      api.upsertCompany(data),
    onSuccess: (saved, variables) => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      const isNew = !variables.id;
      if (isNew && saved?.id) {
        // Switch the active company to the one we just created so it shows up
        // selected in the left rail, then drop the user into it. setActiveCompanyId
        // persists the choice and broadcasts "activeCompanyChanged", which the
        // sidebar listens to — it re-fetches its company list (so the new entry
        // appears) and highlights the selection.
        setActiveCompanyId(saved.id);
        navigate("/dashboard");
      } else {
        // Edit: just nudge the sidebar to re-read names/avatars.
        window.dispatchEvent(new CustomEvent("companyChanged"));
      }
      toast({ title: lang.companiesPage.officeSaved });
    },
    onError: (e: Error) => toast({ title: lang.companiesPage.error, description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: api.deleteCompany,
    onSuccess: () => {
      // The company and all of its related data (departments, documents,
      // office-builder sessions, …) are cleaned up server-side. Refresh the
      // department list so deleted ones stop showing in the New Company dialog.
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["departments"] });
      window.dispatchEvent(new CustomEvent("companyChanged"));
      toast({ title: lang.companiesPage.companyDeleted });
    },
    onError: (e: Error) => toast({ title: lang.companiesPage.error, description: e.message, variant: "destructive" }),
  });

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id);
    setDeleting(undefined);
    setDeletingImpact(null);
  };

  const requestDelete = async (ws: Company) => {
    setDeleting(ws);
    setDeletingImpact(null);
    try {
      setDeletingImpact(await api.getCompanyDeleteImpact(ws.id));
    } catch (e) {
      console.error(e);
      toast({ title: "Could not check delete impact", description: String((e as Error).message ?? e), variant: "destructive" });
    }
  };

  const openNew = () => { setEditing(undefined); setDialogOpen(true); };
  const openEdit = (ws: Company) => { setEditing(ws); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(undefined); };

  const handleSave = (data: Partial<Company> & Pick<Company, "name">) => {
    upsert.mutate(data);
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
                Create and control companies — group departments into a company. Connect messaging apps from each
                company's Platform page.
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
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Companies", value: companies.length, icon: BrainCircuit, color: "text-teal-400" },
          { label: "Departments", value: departments.length, icon: Users, color: "text-violet-400" },
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
          <h2 className="text-xl font-semibold mb-2">{lang.companiesPage.noCompaniesYet}</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Create a company to group your departments. Once created, select it and open its Platform page to connect
            Telegram, Discord, Slack, WhatsApp, and more.
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
                onEdit={() => openEdit(ws)}
                onDelete={() => requestDelete(ws)}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Dialog */}
      <CompanyDialog
        open={dialogOpen}
        onClose={closeDialog}
        existing={editing}
        departments={departments}
        onSave={handleSave}
        companies={companies}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) { setDeleting(undefined); setDeletingImpact(null); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{lang.companiesPage.deleteCompanyTitle}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {deleting ? (
                  <p>
                    Are you sure you want to delete <span className="font-semibold text-foreground">{deleting.name}</span>?
                    This action cannot be undone.
                  </p>
                ) : null}
                {deletingImpact ? (
                  <ul className="mt-2 list-disc pl-4 space-y-0.5">
                    {deletingImpact.removed_teams > 0 && <li>{deletingImpact.removed_teams} department(s) removed</li>}
                    {deletingImpact.removed_staff > 0 && <li>{deletingImpact.removed_staff} staff member(s) removed</li>}
                    {deletingImpact.removed_skills > 0 && <li>{deletingImpact.removed_skills} skill(s) removed</li>}
                    {deletingImpact.removed_tasks > 0 && <li>{deletingImpact.removed_tasks} task(s) removed</li>}
                    {deletingImpact.removed_documents > 0 && <li>{deletingImpact.removed_documents} document(s) removed</li>}
                    {deletingImpact.kept_departments.map((d) => (
                      <li key={d.id} className="text-amber-500">
                        "{d.name}" is kept — still used by {d.shared_with.join(", ")}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs">{lang.companiesPage.checkingImpact}</p>
                )}
              </div>
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
