import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FlaskConical, Pencil, Plus, Trash2, X, Copy, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AgentAvatar, avatarIconOptions } from "@/components/AgentAvatar";
import { AppendFromOverallDialog } from "@/components/AppendFromOverallDialog";
import { api, canDeleteItem, canEditItem, type Agent, type Skill, type Team } from "@/lib/api";
import { getAgentDotColor, getAgentRoleColor } from "@/lib/agent-role-ui";
import { useWorkspaceScope } from "@/hooks/use-workspace-scope";

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

type AvatarMode = "initial" | "icon" | "image";

function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

export default function AgentBuilder() {
  const scope = useWorkspaceScope();
  const [agentList, setAgentList] = useState<Agent[]>([]);
  const [skillCatalog, setSkillCatalog] = useState<Skill[]>([]);
  const [teamList, setTeamList] = useState<Team[]>([]);

  const [open, setOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [desc, setDesc] = useState("");
  const [avatarMode, setAvatarMode] = useState<AvatarMode>("initial");
  const [avatarIcon, setAvatarIcon] = useState("bot");
  const [avatarColor, setAvatarColor] = useState("#3b82f6");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [subagentEnabled, setSubagentEnabled] = useState(false);
  const [testingAgent, setTestingAgent] = useState<Agent | null>(null);
  const [testPrompt, setTestPrompt] = useState("");
  const [testOutput, setTestOutput] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");

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
        const [agents, skills, teams] = await Promise.all([api.listAgents(), api.listSkills(), api.listTeams()]);
        if (cancelled) return;
        setAgentList(agents);
        setSkillCatalog(skills);
        setTeamList(teams);
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
    return selectedSkillIds.map((id) => byId.get(id)).filter(Boolean) as Skill[];
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
    setEditingAgentId(null);
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

  const openEditDialog = (agent: Agent) => {
    setEditingAgentId(agent.id);
    setName(agent.name);
    setRole(agent.role || "");
    setDesc(agent.description ?? "");
    setAvatarMode(agent.avatar_url ? "image" : agent.avatar_icon ? "icon" : "initial");
    setAvatarIcon(agent.avatar_icon || "bot");
    setAvatarColor(isHexColor(agent.avatar_color || "") ? (agent.avatar_color as string) : "#3b82f6");
    setAvatarUrl(agent.avatar_url || "");
    setSelectedSkillIds(sanitizeSkillIds(agent.skill_ids || []));
    setSubagentEnabled(agent.subagent_enabled ?? false);
    setOpen(true);
  };

  const saveAgent = async () => {
    const normalizedRole = role.trim();
    if (!name.trim() || !normalizedRole) return;
    const normalizedSkillIds = sanitizeSkillIds(selectedSkillIds);
    try {
      const saved = await api.upsertAgent({
        id: editingAgentId ?? undefined,
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
      setAgentList((prev) => {
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

  const deleteAgent = async (id: string) => {
    try {
      await api.deleteAgent(id);
      setAgentList((prev) => prev.filter((a) => a.id !== id));
      if (editingAgentId === id) {
        resetForm();
        setOpen(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openTestDialog = (agent: Agent) => {
    setTestingAgent(agent);
    setTestPrompt("");
    setTestOutput("");
    setTestOpen(true);
  };

  const runAgentTest = async () => {
    if (!testingAgent || !testPrompt.trim() || isTesting) return;
    setIsTesting(true);
    setTestOutput("");
    setTestError("");
    setCopied(false);
    try {
      const result = await api.chat({
        prompt: testPrompt.trim(),
        agentId: testingAgent.id,
      });
      setTestOutput(result.response || "(No response)");
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Failed to call test endpoint";
      setTestError(errorMsg);
      setTestOutput("");
    } finally {
      setIsTesting(false);
    }
  };

  const copyOutput = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const visibleAgents = useMemo(
    () => (scope.isOverall ? agentList : agentList.filter((a) => scope.agentIds.has(a.id))),
    [agentList, scope],
  );

  return (
    <div>
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Humans</h1>
          <p className="text-muted-foreground mt-1">
            {scope.workspace
              ? <>Personnel of office <span className="font-semibold text-foreground">{scope.workspace.name}</span> (members of its departments).</>
              : "Hire and manage your company's personnel roster."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {scope.workspace && (
            <AppendFromOverallDialog
              title={`Append humans to "${scope.workspace.name}"`}
              description="Pick existing humans from Overall and add them to one of this office's departments."
              items={agentList
                .filter((a) => !scope.agentIds.has(a.id))
                .map((a) => ({ id: a.id, name: a.name, sub: a.role }))}
              emptyText="Every human from Overall is already part of this office."
              targets={teamList
                .filter((t) => scope.teamIds.has(t.id) && canEditItem(t))
                .map((t) => ({ id: t.id, name: t.name }))}
              targetLabel="Add to department"
              noTargetText="No department in this office can be edited by you. Create your own department first."
              copyLabel="Create independent copies for this office (edits to the copied humans won't affect Overall)."
              onAppend={async (ids, targetId, makeCopy) => {
                const team = teamList.find((t) => t.id === targetId);
                if (!team) return;
                let agentIdsToAdd = ids;
                if (makeCopy) {
                  agentIdsToAdd = [];
                  for (const id of ids) {
                    const src = agentList.find((a) => a.id === id);
                    if (!src) continue;
                    const copied = await api.upsertAgent({
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
                    setAgentList((prev) => [...prev, copied]);
                    agentIdsToAdd.push(copied.id);
                  }
                }
                const merged = [...new Set([...(team.agents || []), ...agentIdsToAdd])];
                const saved = await api.upsertTeam({ ...team, agents: merged });
                setTeamList((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
                // Refresh the office scope so the new humans show up.
                window.dispatchEvent(new CustomEvent("workspaceChanged"));
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
              <DialogTitle>{editingAgentId ? "Edit Human Profile" : "Hire Human"}</DialogTitle>
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
                          saveAgent();
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
                            saveAgent();
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
                          saveAgent();
                        }
                      }
                    }}
                  />

                <div className="space-y-3 border rounded-lg p-3 bg-muted/10">
                  <div className="text-sm font-medium">Avatar Customization</div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                    <Select value={avatarMode} onValueChange={(v) => setAvatarMode(v as AvatarMode)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Avatar style" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="initial">Initials</SelectItem>
                        <SelectItem value="icon">Icon</SelectItem>
                        <SelectItem value="image">Image URL</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Preview</span>
                      <AgentAvatar
                        agent={{
                          avatar: name.trim()[0]?.toUpperCase() || "A",
                          avatar_icon: avatarMode === "icon" ? avatarIcon : "",
                          avatar_color: isHexColor(avatarColor) ? avatarColor : "",
                          avatar_url: avatarMode === "image" ? avatarUrl.trim() : "",
                        }}
                        className="w-10 h-10"
                      />
                    </div>
                  </div>

                  {avatarMode === "icon" ? (
                    <Select value={avatarIcon} onValueChange={setAvatarIcon}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick icon" />
                      </SelectTrigger>
                      <SelectContent>
                        {avatarIconOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}

                  {avatarMode === "image" ? (
                    <Input
                      placeholder="https://example.com/avatar.png"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                    />
                  ) : null}

                  <div className="flex items-center gap-3">
                    <Input
                      type="color"
                      value={isHexColor(avatarColor) ? avatarColor : "#3b82f6"}
                      onChange={(e) => setAvatarColor(e.target.value)}
                      className="w-14 p-1 h-10 cursor-pointer"
                    />
                    <Input
                      placeholder="#3b82f6"
                      value={avatarColor}
                      onChange={(e) => setAvatarColor(e.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded-md border p-3 bg-muted/5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Manager Mode</div>
                      <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">
                        Delegate work to other team members via subagents and run tools in parallel.
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
              <Button onClick={saveAgent} className="w-full" disabled={!name.trim() || !role}>
                {editingAgentId ? "Save Changes" : "Hire Person"}
              </Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </header>

      <Dialog
        open={testOpen}
        onOpenChange={(next) => {
          setTestOpen(next);
          if (!next) {
            setIsTesting(false);
            setTestError("");
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
          <DialogHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl">Test Capability</DialogTitle>
                {testingAgent && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {testingAgent.name} • {testingAgent.role}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {testOutput && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyOutput(testOutput)}
                    className="h-8 w-8 p-0"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4 px-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <FlaskConical className="w-4 h-4" /> Test Prompt
              </label>
              <Textarea
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                placeholder="Enter a prompt to test this person's capability..."
                className="min-h-[90px] text-sm resize-none border-border focus:border-primary"
                disabled={isTesting}
              />
              <Button
                onClick={runAgentTest}
                disabled={!testingAgent || !testPrompt.trim() || isTesting}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 h-9"
              >
                <FlaskConical className="w-4 h-4 mr-2" />
                {isTesting ? (
                  <>
                    <div className="animate-spin w-3 h-3 mr-2 border-2 border-white border-t-transparent rounded-full" />
                    Testing...
                  </>
                ) : (
                  "Run Test"
                )}
              </Button>
            </div>

            <div className="flex flex-col gap-2 flex-1 overflow-hidden">
              <label className="text-sm font-semibold">Output</label>
              {testError ? (
                <div className="flex-1 rounded-lg border border-destructive/30 bg-destructive/8 p-4 overflow-y-auto">
                  <p className="text-sm text-destructive font-mono font-semibold mb-2">🚨 Error</p>
                  <p className="text-sm text-destructive/80 whitespace-pre-wrap break-words">
                    {testError}
                  </p>
                </div>
              ) : testOutput ? (
                <div className="flex-1 rounded-lg border border-border bg-muted/30 p-4 overflow-y-auto">
                  <pre className="text-sm font-mono text-foreground whitespace-pre-wrap break-words leading-relaxed">
                    {testOutput}
                  </pre>
                </div>
              ) : (
                <div className="flex-1 rounded-lg border-2 border-dashed border-border bg-muted/20 p-4 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">Output will appear here after running test...</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {visibleAgents.length === 0 && scope.ready && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">
            {scope.workspace
              ? `No humans in "${scope.workspace.name}" yet — add them to one of its departments, or switch to Overall.`
              : "No humans yet. Hire your first one."}
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleAgents.map((agent, i) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-5"
          >
            <div className="flex items-start gap-4">
              <AgentAvatar
                agent={agent}
                className={`w-10 h-10 ${agent.avatar_color ? "" : getAgentRoleColor(agent.role)}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold truncate">{agent.name}</h3>
                  <div className="flex items-center gap-2">
                    {canEditItem(agent) && (
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(agent)} aria-label={`Edit ${agent.name}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                    {canDeleteItem(agent) && (
                      <Button variant="ghost" size="icon" onClick={() => deleteAgent(agent.id)} aria-label={`Delete ${agent.name}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                    <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        agent.status === "active" ? "bg-agent-dev animate-pulse" : "bg-muted-foreground/30"
                      }`}
                    />
                    <span className="text-[10px] font-mono text-muted-foreground capitalize">{agent.status}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`w-1.5 h-1.5 rounded-full ${getAgentDotColor(agent.role)}`} />
                  <span className="text-xs text-muted-foreground">{agent.role}</span>
                  {agent.subagent_enabled ? (
                    <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                      Manager Mode
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={() => openTestDialog(agent)}>
                    <FlaskConical className="w-3.5 h-3.5 mr-1.5" />
                    Test
                  </Button>
                </div>

                {agent.skill_ids?.length ? (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {agent.skills?.slice(0, 3).map((s) => (
                      <Badge key={s.id} variant="secondary" className="text-[10px]">
                        {s.name}
                      </Badge>
                    ))}
                    {agent.skill_ids.length > 3 ? (
                      <span className="text-[10px] text-muted-foreground">+{agent.skill_ids.length - 3}</span>
                    ) : null}
                  </div>
                ) : null}

                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{agent.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
