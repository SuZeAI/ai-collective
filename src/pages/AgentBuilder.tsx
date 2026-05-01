import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FlaskConical, Pencil, Plus, Trash2, X, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AgentAvatar, avatarIconOptions } from "@/components/AgentAvatar";
import { api, type Agent, type Skill } from "@/lib/api";
import { getAgentDotColor, getAgentRoleColor } from "@/lib/agent-role-ui";

const roles = [
  "Other Agent",
  "Project Manager",
  "Research Agent",
  "Developer Agent",
  "Marketing Agent",
  "Reviewer Agent",
  "Support Agent",
  "Community Agent",
  "Sales Agent",
  "HR Agent",
  "Ops Agent",
  "Finance Agent",
  "Customer Service Agent",
  "Product Manager Agent",
  "QA Agent",
  "UI/UX Designer Agent",
  "Data Analyst Agent",
  "Data Scientist Agent",
  "Business Analyst Agent",
  "Legal Advisor Agent",
  "Compliance Agent",
  "Procurement Agent",
  "Logistics Agent",
  "Supply Chain Agent",
  "Recruiter Agent",
  "Trainer Agent",
  "Teacher Agent",
  "Doctor Agent",
  "Nurse Agent",
  "Pharmacist Agent",
  "Psychologist Agent",
  "Architect Agent",
  "Civil Engineer Agent",
  "Mechanical Engineer Agent",
  "Electrical Engineer Agent",
  "Accountant Agent",
  "Auditor Agent",
  "Lawyer Agent",
  "Journalist Agent",
  "Content Creator Agent",
  "Translator Agent",
  "Event Planner Agent",
  "Real Estate Agent",
  "Travel Consultant Agent",
] as const;

type AvatarMode = "initial" | "icon" | "image";

function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

export default function AgentBuilder() {
  const [agentList, setAgentList] = useState<Agent[]>([]);
  const [skillCatalog, setSkillCatalog] = useState<Skill[]>([]);

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
  const [testingAgent, setTestingAgent] = useState<Agent | null>(null);
  const [testPrompt, setTestPrompt] = useState("");
  const [testOutput, setTestOutput] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [agents, skills] = await Promise.all([api.listAgents(), api.listSkills()]);
        if (cancelled) return;
        setAgentList(agents);
        setSkillCatalog(skills);
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

  return (
    <div>
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
          <p className="text-muted-foreground mt-1">Create and manage your AI agent roster.</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" /> New Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto overflow-x-hidden p-6">
            <DialogHeader>
              <DialogTitle>{editingAgentId ? "Edit Agent" : "Create Agent"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <Input placeholder="Agent name" value={name} onChange={(e) => setName(e.target.value)} />

              <div className="space-y-1.5">
                <Input
                  list="agent-role-options"
                  placeholder="Type a role or pick from suggestions"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
                <datalist id="agent-role-options">
                  {roles.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">You can type a custom role or select an existing one.</p>
              </div>

              <Input placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />

              <div className="space-y-3">
                <div className="text-sm font-medium">Avatar</div>
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

                  <div className="flex items-center gap-2 justify-start sm:justify-end">
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
                    className="w-14 p-1 h-10"
                  />
                  <Input
                    placeholder="#3b82f6"
                    value={avatarColor}
                    onChange={(e) => setAvatarColor(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Skills</div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="rounded-md border p-3 space-y-2 bg-muted/30">
                    <div className="text-xs font-medium text-muted-foreground">Select skills to assign</div>
                    {skillCatalog.length ? (
                      <div className="space-y-2 max-h-56 overflow-auto pr-1">
                        {skillCatalog.map((s) => (
                          <label
                            key={s.id}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedSkillIds.includes(s.id)}
                              onCheckedChange={() => toggleSkill(s.id)}
                            />
                            <span className="text-sm font-medium">{s.name}</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              ({s.kind}
                              {s.third_party ? ` • ${s.third_party}` : ""})
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No skills yet. Create skills in the Skills page.</p>
                    )}
                  </div>

                  <div className="rounded-md border p-3 space-y-2 bg-muted/20">
                    <div className="text-xs font-medium text-muted-foreground">Selected skills</div>
                    <div className="max-h-56 overflow-auto pr-1">
                      {selectedSkills.length ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedSkills.map((s) => (
                            <Badge key={s.id} variant="secondary" className="inline-flex items-center gap-1 max-w-full">
                              <span className="truncate max-w-[180px]">{s.name}</span>
                              {s.third_party ? <span className="text-muted-foreground">({s.third_party})</span> : null}
                              <button
                                type="button"
                                onClick={() => removeSelectedSkill(s.id)}
                                className="ml-1 inline-flex items-center justify-center"
                                aria-label={`Remove ${s.name}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No skills selected yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <Button onClick={saveAgent} className="w-full" disabled={!name.trim() || !role}>
                {editingAgentId ? "Save Changes" : "Create Agent"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
                <DialogTitle className="text-xl">Test Agent</DialogTitle>
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
                placeholder="Enter a prompt to test this agent..."
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agentList.map((agent, i) => (
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
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(agent)} aria-label={`Edit ${agent.name}`}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteAgent(agent.id)} aria-label={`Delete ${agent.name}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
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

                <div className="flex items-center gap-2 mt-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${getAgentDotColor(agent.role)}`} />
                  <span className="text-xs text-muted-foreground">{agent.role}</span>
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
