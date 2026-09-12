import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FlaskConical, Pencil, Plus, Trash2, Users, GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { StaffAvatar, departmentAvatarIconOptions } from "@/components/StaffAvatar";
import { AvatarPicker, isHexColor, type AvatarMode } from "@/components/AvatarPicker";
import { api, buildCustomGraphPayload, canDeleteItem, canEditItem, type Staff, type CustomFlow, type Department, type DepartmentMode, type DeleteImpact } from "@/lib/api";
import { useCompanyScope, CATALOG_COMPANY_ID } from "@/hooks/use-company-scope";
import CustomFlowEditor from "@/components/department/CustomFlowEditor";
import { DepartmentTestDialog } from "@/components/department/DepartmentTestDialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export type DepartmentTestMessage = {
  id: string;
  staffId: string;
  content: string;
  step: number;
  timestamp: string;
};

export default function DepartmentBuilder() {
  const scope = useCompanyScope();
  const { toast } = useToast();
  const [departmentList, setDepartmentList] = useState<Department[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [mode, setMode] = useState<DepartmentMode>("sequential");
  const [flow, setFlow] = useState<CustomFlow | null>(null);
  const [maxSteps, setMaxSteps] = useState("6");
  const [avatarMode, setAvatarMode] = useState<AvatarMode>("initial");
  const [avatarIcon, setAvatarIcon] = useState("users");
  const [avatarColor, setAvatarColor] = useState("#0EA5E9");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [draggedStaff, setDraggedStaff] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testingDepartment, setTestingDepartment] = useState<Department | null>(null);
  const [testPrompt, setTestPrompt] = useState("Run a quick kickoff discussion and align responsibilities.");
  const [testStepLimit, setTestStepLimit] = useState("6");
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState("");
  const [testMessages, setTestMessages] = useState<DepartmentTestMessage[]>([]);
  const [testThinkingStaff, setTestThinkingStaff] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  // Per-run stop token (not a single shared flag): stopping test A while test
  // B is already running must only affect A's own loop, not silently flip a
  // ref that B's loop also reads. runTeamTest creates a fresh token per run
  // and only clears/finalizes state if it's still the active one when it ends.
  const activeTestRunRef = useRef<{ stopped: boolean; controller: AbortController } | null>(null);
  const [copied, setCopied] = useState(false);
  const [personnelSearch, setPersonnelSearch] = useState("");

  const filteredStaff = useMemo(() => {
    const term = personnelSearch.trim().toLowerCase();
    if (!term) return staffList;
    return staffList.filter(
      (a) =>
        a.name.toLowerCase().includes(term) ||
        (a.role || "").toLowerCase().includes(term) ||
        (a.skills || []).some((s) => s.name.toLowerCase().includes(term))
    );
  }, [staffList, personnelSearch]);

  const companyId = scope.isOverall ? CATALOG_COMPANY_ID : scope.company?.id;

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const [departments, staff] = await Promise.all([api.listDepartments(companyId), api.listStaff(companyId)]);
        if (cancelled) return;
        setDepartmentList(departments);
        setStaffList(staff);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const staffById = useMemo(() => {
    const map = new Map<string, Staff>();
    staffList.forEach((a) => map.set(a.id, a));
    return map;
  }, [staffList]);

  // Stable reference for CustomFlowEditor's `staff` prop — a fresh array
  // literal on every render (even with identical content) makes its
  // reconciliation effect re-run every render, which feeds back into a
  // render loop via onChange/setFlow. Only recompute when the selection or
  // underlying staff data actually changes.
  const customFlowStaff = useMemo(
    () => selectedStaff.map((id) => staffById.get(id)).filter((a): a is Staff => Boolean(a)),
    [selectedStaff, staffById],
  );

  const toggleStaff = (id: string) => {
    setSelectedStaff((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);
  };

  const resetForm = () => {
    setEditingDepartmentId(null);
    setName("");
    setDesc("");
    setSelectedStaff([]);
    setMode("sequential");
    setFlow(null);
    setMaxSteps("6");
    setAvatarMode("initial");
    setAvatarIcon("users");
    setAvatarColor("#0EA5E9");
    setAvatarUrl("");
    setPersonnelSearch("");
  };

  const handleDragStart = (staffId: string) => {
    setDraggedStaff(staffId);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (targetStaffId: string) => {
    if (!draggedStaff || draggedStaff === targetStaffId) {
      setDraggedStaff(null);
      return;
    }

    const draggedIndex = selectedStaff.indexOf(draggedStaff);
    const targetIndex = selectedStaff.indexOf(targetStaffId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedStaff(null);
      return;
    }

    const newStaff = [...selectedStaff];
    newStaff.splice(draggedIndex, 1);
    newStaff.splice(targetIndex, 0, draggedStaff);
    setSelectedStaff(newStaff);
    setDraggedStaff(null);
  };

  const removeStaff = (staffId: string) => {
    setSelectedStaff((prev) => prev.filter((a) => a !== staffId));
  };

  const openCreateDialog = () => {
    resetForm();
    setOpen(true);
  };

  const openEditDialog = (department: Department) => {
    setEditingDepartmentId(department.id);
    setName(department.name);
    setDesc(department.description ?? "");
    setSelectedStaff(department.staff || []);
    setMode((department.mode as DepartmentMode) ?? "sequential");
    setFlow(department.flow ?? null);
    setMaxSteps(String(department.maxSteps ?? 6));
    setAvatarMode(department.avatar_url ? "image" : department.avatar_icon ? "icon" : "initial");
    setAvatarIcon(department.avatar_icon || "users");
    setAvatarColor(isHexColor(department.avatar_color || "") ? (department.avatar_color as string) : "#0EA5E9");
    setAvatarUrl(department.avatar_url || "");
    setOpen(true);
  };

  const saveDepartment = async () => {
    if (!name.trim() || selectedStaff.length === 0 || !companyId) return;
    const existing = editingDepartmentId ? departmentList.find((t) => t.id === editingDepartmentId) : undefined;
    const parsedSteps = Number(maxSteps);
    const finalSteps = Number.isFinite(parsedSteps) ? Math.max(1, Math.min(10, Math.floor(parsedSteps))) : 6;
    try {
      const saved = await api.upsertDepartment({
        id: editingDepartmentId ?? undefined,
        name: name.trim(),
        description: desc,
        staff: selectedStaff,
        activeTasks: existing?.activeTasks ?? 0,
        avatar: name.trim()[0]?.toUpperCase() || "T",
        avatar_icon: avatarMode === "icon" ? avatarIcon : "",
        avatar_color: isHexColor(avatarColor) ? avatarColor : "",
        avatar_url: avatarMode === "image" ? avatarUrl.trim() : "",
        mode: mode,
        maxSteps: finalSteps,
        flow: mode === "custom" ? flow : null,
        company_id: companyId,
      });
      setDepartmentList((prev) => {
        const idx = prev.findIndex((t) => t.id === saved.id);
        if (idx === -1) return [...prev, saved];
        const next = [...prev];
        next[idx] = saved;
        return next;
      });
      // A department created while a specific office is selected joins that
      // office; ones created under "Overall" stay unattached (shared/default).
      if (!editingDepartmentId && scope.company && !scope.company.departmentIds.includes(saved.id)) {
        try {
          await api.upsertCompany({
            ...scope.company,
            departmentIds: [...scope.company.departmentIds, saved.id],
          });
          window.dispatchEvent(new CustomEvent("companyChanged"));
        } catch (err) {
          console.error("Failed to attach department to office:", err);
          toast({ title: "Department saved, but could not attach to office", description: String((err as Error).message ?? err), variant: "destructive" });
        }
      }
      resetForm();
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast({ title: "Could not save department", description: String((e as Error).message ?? e), variant: "destructive" });
    }
  };

  const [pendingDelete, setPendingDelete] = useState<{ department: Department; impact: DeleteImpact } | null>(null);

  const deleteDepartment = async (id: string) => {
    try {
      await api.deleteDepartment(id);
      setDepartmentList((prev) => prev.filter((t) => t.id !== id));
      if (editingDepartmentId === id) {
        resetForm();
        setOpen(false);
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Could not delete department", description: String((e as Error).message ?? e), variant: "destructive" });
    }
  };

  const requestDeleteDepartment = async (department: Department) => {
    try {
      const impact = await api.getDepartmentDeleteImpact(department.id);
      setPendingDelete({ department, impact });
    } catch (e) {
      console.error(e);
      toast({ title: "Could not check delete impact", description: String((e as Error).message ?? e), variant: "destructive" });
    }
  };

  const openTestDialog = (department: Department) => {
    setTestingDepartment(department);
    setTestMessages([]);
    setTestError("");
    setTestPrompt("Run a quick kickoff discussion and align responsibilities.");
    setTestStepLimit("6");
    setTestOpen(true);
  };

  const stopDepartmentTest = () => {
    if (activeTestRunRef.current) {
      activeTestRunRef.current.stopped = true;
      // Actually cancel the in-flight backend run — without this the stream
      // (and the LLM/tool calls behind it) keeps running server-side even
      // though the UI stops rendering new messages.
      activeTestRunRef.current.controller.abort();
    }
    setIsTesting(false);
  };

  const copyMessages = () => {
    const text = testMessages.map((m) => `[Step ${m.step}] ${m.staffId}: ${m.content}`).join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runDepartmentTest = async () => {
    if (!testingDepartment || isTesting) return;

    if (testingDepartment.staff.length === 0) {
      setTestError("This department has no staff to test.");
      return;
    }

    const parsedStep = Number(testStepLimit);
    const stepLimit = Number.isFinite(parsedStep) ? Math.max(1, Math.min(10, Math.floor(parsedStep))) : 6;

    const runToken = { stopped: false, controller: new AbortController() };
    activeTestRunRef.current = runToken;
    setIsTesting(true);
    setTestError("");
    setTestMessages([]);
    setTestThinkingStaff(new Set());

    try {
      let stepCounter = 0;
      const customGraph = buildCustomGraphPayload(testingDepartment);
      const testMode = testingDepartment.mode === "custom" && !customGraph ? "sequential" : (testingDepartment.mode ?? "sequential");
      for await (const event of api.runStaffGraphStream({
        user_input: testPrompt.trim() || "Coordinate a department execution plan.",
        staff: testingDepartment.staff,
        max_rounds: stepLimit,
        mode: testMode,
        custom_graph: customGraph,
        signal: runToken.controller.signal,
        department_id: testingDepartment.id,
      })) {
        if (runToken.stopped) break;
        // A newer run has since started (dialog reopened for another team) —
        // stop consuming/mutating shared state on its behalf.
        if (activeTestRunRef.current !== runToken) break;

        if (event.error) {
          setTestError(event.error);
          break;
        }

        // Handle different event types
        const eventType = event.type;
        const staffId = event.agent_id || event.staffId || event.agent_name || event.staffName;

        // Handle thinking state (LLM request start)
        if (eventType === "llm_request_start") {
          if (!staffId) continue;
          setTestThinkingStaff((prev) => new Set([...prev, staffId]));
        }
        // Remove thinking state (LLM response complete)
        else if (eventType === "llm_response_complete") {
          if (!staffId) continue;
          setTestThinkingStaff((prev) => {
            const next = new Set(prev);
            next.delete(staffId);
            return next;
          });
        }
        // Only add message when turn is complete
        else if (eventType === "turn_complete" && event.turn) {
          stepCounter += 1;
          const turn = event.turn;
          const turnStaffId = turn.agent_id || turn.staffId || turn.agent_name || turn.staffName;
          if (!turnStaffId) continue;
          const item: DepartmentTestMessage = {
            id: `${Date.now()}-${stepCounter}-${turnStaffId}`,
            staffId: turnStaffId,
            content: turn.content || "(No response)",
            step: turn.turn,
            timestamp: new Date().toISOString(),
          };
          setTestThinkingStaff((prev) => {
            const next = new Set(prev);
            next.delete(turnStaffId);
            return next;
          });
          setTestMessages((prev) => [...prev, item]);
        }
        // Fallback for old-style turn objects (if not wrapped in turn_complete event)
        else if (event.content && !eventType) {
          stepCounter += 1;
          if (!staffId) continue;
          const item: DepartmentTestMessage = {
            id: `${Date.now()}-${stepCounter}-${staffId}`,
            staffId: staffId,
            content: event.content || "(No response)",
            step: event.turn,
            timestamp: new Date().toISOString(),
          };
          setTestMessages((prev) => [...prev, item]);
        }
      }
    } catch (e) {
      const isAbort = e instanceof DOMException && e.name === "AbortError";
      if (!isAbort && activeTestRunRef.current === runToken) {
        setTestError(e instanceof Error ? e.message : "Failed to run department test discussion.");
      }
    } finally {
      if (activeTestRunRef.current === runToken) {
        activeTestRunRef.current = null;
        setIsTesting(false);
        setTestThinkingStaff(new Set());
      }
    }
  };

  // departmentList is already fetched scoped to companyId, so no client-side filter is needed.
  const visibleDepartments = departmentList;

  const selectPersonnelNode = (
    <div className="space-y-2">
      <label className="text-sm font-medium">Select Personnel</label>
      <p className="text-xs text-muted-foreground">Choose personnel to add to this department.</p>
      {staffList.length > 0 && (
        <Input
          placeholder="Search personnel..."
          value={personnelSearch}
          onChange={(e) => setPersonnelSearch(e.target.value)}
          className="h-8 text-xs bg-background/50"
        />
      )}
      <div className={cn(
        "border border-input rounded-lg p-3 overflow-y-auto bg-muted/50 transition-all",
        mode === "custom" ? "h-[200px]" : "h-[320px]"
      )}>
        <div className="space-y-2 pb-8">
          {filteredStaff.length ? (
            filteredStaff.map((a) => (
              <label key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-background cursor-pointer">
                <Checkbox checked={selectedStaff.includes(a.id)} onCheckedChange={() => toggleStaff(a.id)} />
                <span className="text-sm font-medium">{a.name}</span>
                <span className="text-xs text-muted-foreground">({a.role})</span>
                {a.skill_ids?.length ? (
                  <span className="text-xs text-muted-foreground ml-auto">
                    • {a.skills?.map((s) => s.name).join(", ")}
                  </span>
                ) : null}
              </label>
            ))
          ) : (
            <p className="text-xs text-muted-foreground py-4 text-center">No matching personnel found.</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Departments</h1>
          <p className="text-muted-foreground mt-1">
            {scope.company
              ? <>Departments of office <span className="font-semibold text-foreground">{scope.company.name}</span>. New departments join this office.</>
              : "Assemble departments and project departments for corporate tasks."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}><Plus className="w-4 h-4 mr-2" /> New Department</Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl w-[96vw] max-h-[90vh] overflow-y-auto overflow-x-hidden p-6">
            <DialogHeader><DialogTitle>{editingDepartmentId ? "Edit Department" : "Create Department"}</DialogTitle></DialogHeader>
            <div className={cn(
              "pt-2 grid grid-cols-1 gap-6",
              mode === "custom"
                ? "xl:grid-cols-[360px_1fr]"
                : "xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]"
            )}>
              <div className="space-y-4 min-w-0 pr-2 pb-1">
                <Input placeholder="Department name" value={name} onChange={(e) => setName(e.target.value)} />
                <Input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />

                <AvatarPicker
                  label="Department Icon"
                  mode={avatarMode}
                  onModeChange={setAvatarMode}
                  icon={avatarIcon}
                  onIconChange={setAvatarIcon}
                  color={avatarColor}
                  onColorChange={setAvatarColor}
                  url={avatarUrl}
                  onUrlChange={setAvatarUrl}
                  iconOptions={departmentAvatarIconOptions}
                  previewFallback={name.trim()[0]?.toUpperCase() || "T"}
                  defaultColor="#0EA5E9"
                  urlPlaceholder="https://example.com/department-avatar.png"
                />

                <div className="space-y-2">
                  <label className="text-sm font-medium">Workflow Mode</label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as DepartmentMode)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                  >
                    <option value="sequential">Sequential Pipeline (members work in sequence)</option>
                    <option value="mesh">Mesh Collaboration (all members interact)</option>
                    <option value="ring">Circular Workflow (members pass work in a loop)</option>
                    <option value="supervisor">Managerial Delegation (lead delegates to department)</option>
                    <option value="tree">Hierarchical Tree (manager delegates down branches)</option>
                    <option value="custom">Custom Flow (drag-and-drop your own routing)</option>
                  </select>
                  {mode === "custom" && (
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                      Draw the flow on the right: connect nodes to route work. Branch one node into several to run them in parallel, merge several back into one, or loop back (bounded by Max Steps).
                    </p>
                  )}
                  {mode === "supervisor" && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      First member in the order will be the <strong>lead manager</strong>. Remaining members are workers.
                    </p>
                  )}
                  {mode === "tree" && selectedStaff.length > 0 && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      Members arranged as a hierarchy tree: <strong>{staffById.get(selectedStaff[0])?.name ?? "Member 1"}</strong> is root.
                      {selectedStaff.length > 1 && <> Children: <strong>{[selectedStaff[1], selectedStaff[2]].filter(Boolean).map(id => staffById.get(id)?.name).filter(Boolean).join(", ")}</strong>.</>}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Steps (for tasks)</label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={maxSteps}
                    onChange={(e) => setMaxSteps(e.target.value)}
                    placeholder="Default: 6"
                  />
                </div>
                {mode === "custom" && (
                  <div className="pt-2">
                    {selectPersonnelNode}
                  </div>
                )}
                <Button onClick={saveDepartment} className="w-full" disabled={!name.trim() || selectedStaff.length === 0}>
                  {editingDepartmentId ? "Save Changes" : "Create Department"}
                </Button>
              </div>

              <div className="space-y-4 min-w-0 pr-2 pb-1">
                {mode === "custom" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Custom Flow</label>
                    <p className="text-xs text-muted-foreground font-medium">
                      Drag from a node's right handle to another node's left handle to route work. Move nodes freely; select an edge and press Delete to remove it.
                    </p>
                    <CustomFlowEditor
                      staff={customFlowStaff}
                      initialFlow={flow}
                      onChange={setFlow}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {selectPersonnelNode}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Personnel Workflow Order</label>
                      <p className="text-xs text-muted-foreground">Drag to reorder personnel. If the list is long, scroll here.</p>
                      <div className="border border-input rounded-lg p-3 h-[320px] overflow-y-auto bg-muted/50">
                        <div className="space-y-2 pb-8">
                          {selectedStaff.length > 0 ? (
                            selectedStaff.map((staffId, index) => {
                              const staff = staffById.get(staffId);
                              if (!staff) return null;
                              return (
                                <div
                                  key={staffId}
                                  draggable
                                  onDragStart={() => handleDragStart(staffId)}
                                  onDragOver={handleDragOver}
                                  onDrop={() => handleDrop(staffId)}
                                  className={`flex items-center gap-3 p-3 rounded-lg border-2 border-dashed transition-all cursor-move ${
                                    draggedStaff === staffId
                                      ? "border-primary bg-primary/8 opacity-50"
                                      : "border-transparent bg-card hover:bg-muted/30 hover:border-border"
                                  }`}
                                >
                                  <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-xs font-bold text-primary">
                                        {index + 1}
                                      </span>
                                      <span className="text-sm font-medium">{staff.name}</span>
                                      <span className="text-xs text-muted-foreground">({staff.role})</span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => removeStaff(staffId)}
                                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                    title="Remove member"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              );
                            })
                          ) : (
                            <div className="h-full flex items-center justify-center text-center text-xs text-muted-foreground px-4 py-8">
                              Select personnel from the left panel to start arranging workflow order.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </header>

      <DepartmentTestDialog
        testOpen={testOpen}
        setTestOpen={setTestOpen}
        stopDepartmentTest={stopDepartmentTest}
        testingDepartment={testingDepartment}
        testMessages={testMessages}
        copyMessages={copyMessages}
        copied={copied}
        testPrompt={testPrompt}
        setTestPrompt={setTestPrompt}
        isTesting={isTesting}
        testStepLimit={testStepLimit}
        setTestStepLimit={setTestStepLimit}
        runDepartmentTest={runDepartmentTest}
        testThinkingStaff={testThinkingStaff}
        testError={testError}
        staffById={staffById}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete department?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting <span className="font-semibold text-foreground">{pendingDelete?.department.name}</span>{" "}
              {pendingDelete?.impact.affected_companies.length
                ? `will unlink it from ${pendingDelete.impact.affected_companies.map((c) => c.name).join(", ")}. `
                : ""}
              Its staff are not affected — they stay in the company, just no longer rostered under this department.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) deleteDepartment(pendingDelete.department.id);
                setPendingDelete(null);
              }}
              className="bg-rose-600 hover:bg-rose-500 text-white"
            >
              Delete department
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {visibleDepartments.length === 0 && scope.ready && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {scope.company
              ? `No departments in "${scope.company.name}" yet. Create one, or switch to Overall to see everything.`
              : "No departments yet. Create your first department."}
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visibleDepartments.map((department, i) => (
          <motion.div
            key={department.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <StaffAvatar
                staff={{ ...department, avatar: department.avatar || department.name?.slice(0, 1).toUpperCase() || "T" }}
                className={`w-10 h-10 ${department.avatar_color ? "" : "bg-primary/10 text-primary"}`}
                iconClassName="w-5 h-5"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold">{department.name}</h3>
                <p className="text-xs text-muted-foreground">{department.description}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => openTestDialog(department)} aria-label={`Test ${department.name}`}>
                  <FlaskConical className="w-4 h-4" />
                </Button>
                {canEditItem(department) && (
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(department)} aria-label={`Edit ${department.name}`}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
                {canDeleteItem(department) && (
                  <Button variant="ghost" size="icon" onClick={() => requestDeleteDepartment(department)} aria-label={`Delete ${department.name}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {department.staff.map((staffId) => {
                const staff = staffById.get(staffId);
                if (!staff) return null;
                return (
                  <span key={staffId} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-medium">
                    <StaffAvatar
                      staff={staff}
                      className="w-5 h-5 rounded-md text-[10px] bg-background/80"
                      iconClassName="w-3 h-3"
                    />
                    {staff.name}
                  </span>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
              <span>{department.activeTasks} active tasks</span>
              <span className="px-2 py-1 rounded bg-muted/50">
                {department.mode === "mesh" ? "🔗 Mesh" : department.mode === "ring" ? "🔄 Ring" : department.mode === "supervisor" ? "👑 Manager" : department.mode === "tree" ? "🌲 Tree" : department.mode === "custom" ? "🧩 Custom" : "📋 Sequential"} • {department.maxSteps || 6} steps
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
