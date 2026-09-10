import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FlaskConical, Pencil, Plus, Trash2, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { StaffAvatar, avatarIconOptions } from "@/components/StaffAvatar";
import { AvatarPicker, isHexColor, type AvatarMode } from "@/components/AvatarPicker";
import { AppendFromOverallDialog } from "@/components/AppendFromOverallDialog";
import { StaffTestDialog } from "@/components/StaffTestDialog";
import { api, canDeleteItem, canEditItem, type Staff, type Skill, type Department } from "@/lib/api";
import { getStaffDotColor, getStaffRoleColor } from "@/lib/staff-role-ui";
import { useCompanyScope } from "@/hooks/use-company-scope";

const roles = [
  "Other Position",
  "Chief Executive Officer (CEO)",
  "Chief Technology Officer (CTO)",
  "Chief Operating Officer (COO)",
  "Chief Financial Officer (CFO)",
  "Chief Marketing Officer (CMO)",
  "Project Manager",
  "Product Owner",
  "Scrum Master",
  "Software Developer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Mobile Developer",
  "DevOps Engineer",
  "Cloud Architect",
  "Solutions Architect",
  "AI Engineer",
  "Machine Learning Engineer",
  "Data Scientist",
  "Data Engineer",
  "Data Analyst",
  "Business Analyst",
  "System Administrator",
  "Database Administrator",
  "Security Engineer",
  "Network Engineer",
  "QA Specialist",
  "Reviewer / QA Specialist",
  "Technical Writer",
  "UI/UX Designer",
  "Product Designer",
  "Graphic Designer",
  "Illustrator",
  "Video Editor",
  "Creative Director",
  "Researcher",
  "Marketing Specialist",
  "Social Media Manager",
  "SEO Specialist",
  "Content Writer",
  "Copywriter",
  "PR Specialist",
  "Brand Manager",
  "Growth Hacker",
  "Community Manager",
  "Sales Representative",
  "Account Executive",
  "Business Development Manager",
  "Customer Success Manager",
  "Customer Service Rep",
  "Support Specialist",
  "Help Desk Technician",
  "HR Specialist",
  "Recruiter",
  "Trainer",
  "Educator",
  "Operations Coordinator",
  "Office Manager",
  "Executive Assistant",
  "Administrative Assistant",
  "Virtual Assistant",
  "Finance Analyst",
  "Accountant",
  "Auditor",
  "Investment Analyst",
  "Risk Analyst",
  "Tax Consultant",
  "Legal Advisor",
  "Compliance Officer",
  "Lawyer",
  "Patent Attorney",
  "Procurement Specialist",
  "Logistics Coordinator",
  "Supply Chain Analyst",
  "Medical Consultant",
  "Healthcare Advisor",
  "Architect",
  "Engineer",
  "Journalist",
  "Translator",
  "Event Planner",
  "Real Estate Advisor",
  "Travel Consultant",
] as const;

export default function StaffBuilder() {
  const scope = useCompanyScope();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [skillCatalog, setSkillCatalog] = useState<Skill[]>([]);
  const [departmentList, setDepartmentList] = useState<Department[]>([]);

  const [open, setOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [desc, setDesc] = useState("");
  const [avatarMode, setAvatarMode] = useState<AvatarMode>("initial");
  const [avatarIcon, setAvatarIcon] = useState("bot");
  const [avatarColor, setAvatarColor] = useState("#3b82f6");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [subagentEnabled, setSubagentEnabled] = useState(false);
  const [testingStaff, setTestingStaff] = useState<Staff | null>(null);
  const [testPrompt, setTestPrompt] = useState("");
  const [testOutput, setTestOutput] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");
  const testRunIdRef = useRef(0);

  const filteredRoles = useMemo(() => {
    const term = role.trim().toLowerCase();
    if (!term) return roles;
    return roles.filter((r) => r.toLowerCase().includes(term));
  }, [role]);

  const filteredSkillCatalog = useMemo(() => {
    const term = skillSearch.trim().toLowerCase();
    if (!term) return skillCatalog;
    return skillCatalog.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.kind.toLowerCase().includes(term) ||
        (s.third_party || "").toLowerCase().includes(term)
    );
  }, [skillCatalog, skillSearch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [staff, skills, departments] = await Promise.all([api.listStaff(), api.listSkills(), api.listDepartments()]);
        if (cancelled) return;
        setStaffList(staff);
        setSkillCatalog(skills);
        setDepartmentList(departments);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedSkills = useMemo(() => {
    const byId = new Map(skillCatalog.map((s) => [s.id, s] as const));
    return selectedSkillIds.map((id) => byId.get(id)).filter((s): s is Skill => s !== undefined);
  }, [skillCatalog, selectedSkillIds]);

  const validSkillIdSet = useMemo(() => new Set(skillCatalog.map((s) => s.id)), [skillCatalog]);

  const sanitizeSkillIds = (ids: string[]) => {
    const seen = new Set<string>();
    return ids.filter((id) => {
      if (!validSkillIdSet.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };

  const toggleSkill = (id: string) => {
    setSelectedSkillIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const removeSelectedSkill = (id: string) => {
    setSelectedSkillIds((prev) => prev.filter((x) => x !== id));
  };

  const resetForm = () => {
    setEditingStaffId(null);
    setName("");
    setRole("");
    setDesc("");
    setAvatarMode("initial");
    setAvatarIcon("bot");
    setAvatarColor("#3b82f6");
    setAvatarUrl("");
    setSelectedSkillIds([]);
    setSubagentEnabled(false);
  };

  const openCreateDialog = () => {
    resetForm();
    setOpen(true);
  };

  const openEditDialog = (staff: Staff) => {
    setEditingStaffId(staff.id);
    setName(staff.name);
    setRole(staff.role || "");
    setDesc(staff.description ?? "");
    setAvatarMode(staff.avatar_url ? "image" : staff.avatar_icon ? "icon" : "initial");
    setAvatarIcon(staff.avatar_icon || "bot");
    setAvatarColor(isHexColor(staff.avatar_color || "") ? (staff.avatar_color as string) : "#3b82f6");
    setAvatarUrl(staff.avatar_url || "");
    setSelectedSkillIds(sanitizeSkillIds(staff.skill_ids || []));
    setSubagentEnabled(staff.subagent_enabled ?? false);
    setOpen(true);
  };

  const saveStaff = async () => {
    const normalizedRole = role.trim();
    if (!name.trim() || !normalizedRole) return;
    const normalizedSkillIds = sanitizeSkillIds(selectedSkillIds);
    try {
      const saved = await api.upsertStaff({
        id: editingStaffId ?? undefined,
        name: name.trim(),
        role: normalizedRole,
        description: desc,
        skill_ids: normalizedSkillIds,
        status: "idle",
        avatar: name.trim()[0]?.toUpperCase(),
        avatar_icon: avatarMode === "icon" ? avatarIcon : "",
        avatar_color: isHexColor(avatarColor) ? avatarColor : "",
        avatar_url: avatarMode === "image" ? avatarUrl.trim() : "",
        subagent_enabled: subagentEnabled,
      });
      setSelectedSkillIds(normalizedSkillIds);
      setStaffList((prev) => {
        const idx = prev.findIndex((a) => a.id === saved.id);
        if (idx === -1) return [...prev, saved];
        const next = [...prev];
        next[idx] = saved;
        return next;
      });
      resetForm();
      setOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteStaff = async (id: string) => {
    try {
      await api.deleteStaff(id);
      setStaffList((prev) => prev.filter((a) => a.id !== id));
      if (editingStaffId === id) {
        resetForm();
        setOpen(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openTestDialog = (staff: Staff) => {
    // Invalidate any in-flight test run for a previously-open staff member so
    // a late response can't land in this (possibly different) staff's dialog.
    testRunIdRef.current += 1;
    setTestingStaff(staff);
    setTestPrompt("");
    setTestOutput("");
    setTestError("");
    setIsTesting(false);
    setTestOpen(true);
  };

  const runStaffTest = async () => {
    if (!testingStaff || !testPrompt.trim() || isTesting) return;
    const runId = ++testRunIdRef.current;
    setIsTesting(true);
    setTestOutput("");
    setTestError("");
    setCopied(false);
    try {
      const result = await api.chat({
        prompt: testPrompt.trim(),
        staffId: testingStaff.id,
      });
      if (testRunIdRef.current !== runId) return;
      setTestOutput(result.response || "(No response)");
    } catch (e) {
      if (testRunIdRef.current !== runId) return;
      const errorMsg = e instanceof Error ? e.message : "Failed to call test endpoint";
      setTestError(errorMsg);
      setTestOutput("");
    } finally {
      if (testRunIdRef.current === runId) {
        setIsTesting(false);
      }
    }
  };

  const copyOutput = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const visibleStaff = useMemo(
    () => (scope.isOverall ? staffList : staffList.filter((a) => scope.staffIds.has(a.id))),
    [staffList, scope],
  );

  return (
    <div>
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff</h1>
          <p className="text-muted-foreground mt-1">
            {scope.company
              ? <>Personnel of office <span className="font-semibold text-foreground">{scope.company.name}</span> (members of its departments).</>
              : "Hire and manage your company's personnel roster."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {scope.company && (
            <AppendFromOverallDialog
              title={`Append staff to "${scope.company.name}"`}
              description="Pick existing staff from Overall and add them to one of this office's departments."
              items={staffList
                .filter((a) => !scope.staffIds.has(a.id))
                .map((a) => ({ id: a.id, name: a.name, sub: a.role }))}
              emptyText="Every human from Overall is already part of this office."
              targets={departmentList
                .filter((t) => scope.departmentIds.has(t.id) && canEditItem(t))
                .map((t) => ({ id: t.id, name: t.name }))}
              targetLabel="Add to department"
              noTargetText="No department in this office can be edited by you. Create your own department first."
              copyLabel="Create independent copies for this office (edits to the copied staff won't affect Overall)."
              onAppend={async (ids, targetId, makeCopy) => {
                const department = departmentList.find((t) => t.id === targetId);
                if (!department) return;
                let staffIdsToAdd = ids;
                if (makeCopy) {
                  staffIdsToAdd = [];
                  for (const id of ids) {
                    const src = staffList.find((a) => a.id === id);
                    if (!src) continue;
                    const copied = await api.upsertStaff({
                      name: src.name,
                      role: src.role,
                      description: src.description,
                      system_prompt: src.system_prompt,
                      skill_ids: src.skill_ids || [],
                      status: "idle",
                      avatar: src.avatar,
                      avatar_icon: src.avatar_icon,
                      avatar_color: src.avatar_color,
                      avatar_url: src.avatar_url,
                      subagent_enabled: src.subagent_enabled,
                    });
                    setStaffList((prev) => [...prev, copied]);
                    staffIdsToAdd.push(copied.id);
                  }
                }
                const merged = [...new Set([...(department.staff || []), ...staffIdsToAdd])];
                const saved = await api.upsertDepartment({ ...department, staff: merged });
                setDepartmentList((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
                // Refresh the office scope so the new staff show up.
                window.dispatchEvent(new CustomEvent("companyChanged"));
              }}
            />
          )}
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" /> New Human
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto overflow-x-hidden p-6">
            <DialogHeader>
              <DialogTitle>{editingStaffId ? "Edit Human Profile" : "Hire Human"}</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6 pt-2">
              {/* Left Column: Profile Attributes */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Full Name</label>
                  <Input
                    placeholder="Human name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (role.trim()) {
                          saveStaff();
                        }
                      }
                    }}
                  />
                </div>

                <div className="space-y-1.5 relative">
                  <label className="text-sm font-medium">Position / Role</label>
                  <div className="relative">
                    <Input
                      placeholder="Type a position or pick from suggestions"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setShowSuggestions(false);
                          if (name.trim()) {
                            saveStaff();
                          }
                        }
                      }}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground/60">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                  {showSuggestions && (role.trim() || filteredRoles.length > 0) && (
                    <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover/95 backdrop-blur-md text-popover-foreground shadow-lg p-1 space-y-0.5">
                      {role.trim() && !roles.some(r => r.toLowerCase() === role.trim().toLowerCase()) && (
                        <button
                          type="button"
                          className="w-full text-left px-2.5 py-1.5 text-xs rounded-sm hover:bg-accent hover:text-accent-foreground text-blue-600 dark:text-blue-400 transition-colors font-semibold border-b border-border/40 pb-1.5 mb-1 flex items-center justify-between"
                          onMouseDown={() => {
                            setRole(role.trim());
                            setShowSuggestions(false);
                          }}
                        >
                          <span className="truncate">Use custom: "{role.trim()}"</span>
                          <span className="text-[9px] uppercase tracking-wider bg-blue-100 dark:bg-blue-950 px-1 py-0.5 rounded text-blue-700 dark:text-blue-300 ml-2 shrink-0">Custom</span>
                        </button>
                      )}
                      {filteredRoles.map((r) => (
                        <button
                          key={r}
                          type="button"
                          className="w-full text-left px-2.5 py-1.5 text-xs rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors font-medium"
                          onMouseDown={() => {
                            setRole(r);
                            setShowSuggestions(false);
                          }}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground leading-normal">You can type a custom position or select an existing one.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    placeholder="Description (optional)"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (name.trim() && role.trim()) {
                          saveStaff();
                        }
                      }
                    }}
                  />
                </div>

                <AvatarPicker
                  label="Avatar Customization"
                  mode={avatarMode}
                  onModeChange={setAvatarMode}
                  icon={avatarIcon}
                  onIconChange={setAvatarIcon}
                  color={avatarColor}
                  onColorChange={setAvatarColor}
                  url={avatarUrl}
                  onUrlChange={setAvatarUrl}
                  iconOptions={avatarIconOptions}
                  previewFallback={name.trim()[0]?.toUpperCase() || "A"}
                  defaultColor="#3b82f6"
                  urlPlaceholder="https://example.com/avatar.png"
                />

                <div className="rounded-md border p-3 bg-muted/5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Manager Mode</div>
                      <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">
                        Delegate work to other department members via subagents and run tools in parallel.
                      </p>
                    </div>
                    <Switch checked={subagentEnabled} onCheckedChange={setSubagentEnabled} />
                  </div>
                </div>
              </div>

              {/* Right Column: Skills Assignment */}
              <div className="space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <label className="text-sm font-medium">Skills Assignment</label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-lg border p-3 bg-muted/30 h-[450px] flex flex-col">
                      <div className="text-xs font-medium text-muted-foreground mb-2">Available Skills</div>
                      {skillCatalog.length ? (
                        <>
                          <Input
                            placeholder="Search skills..."
                            value={skillSearch}
                            onChange={(e) => setSkillSearch(e.target.value)}
                            className="h-8 text-xs mb-2 bg-background/50 shrink-0"
                          />
                          <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
                            {filteredSkillCatalog.length ? (
                              filteredSkillCatalog.map((s) => (
                                <label
                                  key={s.id}
                                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                                >
                                  <Checkbox
                                    checked={selectedSkillIds.includes(s.id)}
                                    onCheckedChange={() => toggleSkill(s.id)}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium truncate">{s.name}</p>
                                    <p className="text-[9px] text-muted-foreground truncate">{s.kind}{s.third_party ? ` • ${s.third_party}` : ""}</p>
                                  </div>
                                </label>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground py-4 text-center">No matching skills found.</p>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground py-4 text-center">No skills registered yet.</p>
                      )}
                    </div>

                    <div className="rounded-lg border p-3 bg-muted/20 h-[450px] flex flex-col">
                      <div className="text-xs font-medium text-muted-foreground mb-2">Equipped Skills</div>
                      <div className="overflow-y-auto pr-1 flex-1">
                        {selectedSkills.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {selectedSkills.map((s) => (
                              <Badge key={s.id} variant="secondary" className="inline-flex items-center gap-1 max-w-full text-[10px]">
                                <span className="truncate max-w-[120px]">{s.name}</span>
                                <button
                                  type="button"
                                  onClick={() => removeSelectedSkill(s.id)}
                                  className="ml-1 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                                  aria-label={`Remove ${s.name}`}
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground py-4 text-center">No skills selected.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t mt-4">
              <Button onClick={saveStaff} className="w-full" disabled={!name.trim() || !role}>
                {editingStaffId ? "Save Changes" : "Hire Person"}
              </Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </header>

      <StaffTestDialog
        testOpen={testOpen}
        setTestOpen={setTestOpen}
        setIsTesting={setIsTesting}
        setTestError={setTestError}
        testingStaff={testingStaff}
        testOutput={testOutput}
        testError={testError}
        copyOutput={copyOutput}
        copied={copied}
        testPrompt={testPrompt}
        setTestPrompt={setTestPrompt}
        isTesting={isTesting}
        runStaffTest={runStaffTest}
      />

      {visibleStaff.length === 0 && scope.ready && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">
            {scope.company
              ? `No staff in "${scope.company.name}" yet — add them to one of its departments, or switch to Overall.`
              : "No staff yet. Hire your first one."}
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleStaff.map((staff, i) => (
          <motion.div
            key={staff.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-5"
          >
            <div className="flex items-start gap-4">
              <StaffAvatar
                staff={staff}
                className={`w-10 h-10 ${staff.avatar_color ? "" : getStaffRoleColor(staff.role)}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold truncate">{staff.name}</h3>
                  <div className="flex items-center gap-2">
                    {canEditItem(staff) && (
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(staff)} aria-label={`Edit ${staff.name}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                    {canDeleteItem(staff) && (
                      <Button variant="ghost" size="icon" onClick={() => deleteStaff(staff.id)} aria-label={`Delete ${staff.name}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                    <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        staff.status === "active" ? "bg-staff-dev animate-pulse" : "bg-muted-foreground/30"
                      }`}
                    />
                    <span className="text-[10px] font-mono text-muted-foreground capitalize">{staff.status}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`w-1.5 h-1.5 rounded-full ${getStaffDotColor(staff.role)}`} />
                  <span className="text-xs text-muted-foreground">{staff.role}</span>
                  {staff.subagent_enabled ? (
                    <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                      Manager Mode
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={() => openTestDialog(staff)}>
                    <FlaskConical className="w-3.5 h-3.5 mr-1.5" />
                    Test
                  </Button>
                </div>

                {staff.skill_ids?.length ? (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {staff.skills?.slice(0, 3).map((s) => (
                      <Badge key={s.id} variant="secondary" className="text-[10px]">
                        {s.name}
                      </Badge>
                    ))}
                    {staff.skill_ids.length > 3 ? (
                      <span className="text-[10px] text-muted-foreground">+{staff.skill_ids.length - 3}</span>
                    ) : null}
                  </div>
                ) : null}

                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{staff.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
