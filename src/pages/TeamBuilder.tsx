import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FlaskConical, Pencil, Plus, Square, Trash2, Users, Copy, Check, Clock, GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { AgentAvatar, teamAvatarIconOptions } from "@/components/AgentAvatar";
import { api, type Agent, type Team } from "@/lib/api";

type TeamTestMessage = {
  id: string;
  agentId: string;
  content: string;
  step: number;
  timestamp: string;
};

type AvatarMode = "initial" | "icon" | "image";

function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

export default function TeamBuilder() {
  const [teamList, setTeamList] = useState<Team[]>([]);
  const [agentList, setAgentList] = useState<Agent[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [mode, setMode] = useState<"mesh" | "sequential" | "ring" | "supervisor" | "tree">("sequential");
  const [maxSteps, setMaxSteps] = useState("6");
  const [avatarMode, setAvatarMode] = useState<AvatarMode>("initial");
  const [avatarIcon, setAvatarIcon] = useState("users");
  const [avatarColor, setAvatarColor] = useState("#0EA5E9");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [draggedAgent, setDraggedAgent] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testingTeam, setTestingTeam] = useState<Team | null>(null);
  const [testPrompt, setTestPrompt] = useState("Run a quick kickoff discussion and align responsibilities.");
  const [testStepLimit, setTestStepLimit] = useState("6");
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState("");
  const [testMessages, setTestMessages] = useState<TeamTestMessage[]>([]);
  const [testThinkingAgents, setTestThinkingAgents] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const stopTestRef = useRef(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [teams, agents] = await Promise.all([api.listTeams(), api.listAgents()]);
        if (cancelled) return;
        setTeamList(teams);
        setAgentList(agents);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const agentById = useMemo(() => {
    const map = new Map<string, Agent>();
    agentList.forEach((a) => map.set(a.id, a));
    return map;
  }, [agentList]);

  const toggleAgent = (id: string) => {
    setSelectedAgents((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);
  };

  const resetForm = () => {
    setEditingTeamId(null);
    setName("");
    setDesc("");
    setSelectedAgents([]);
    setMode("sequential");
    setMaxSteps("6");
    setAvatarMode("initial");
    setAvatarIcon("users");
    setAvatarColor("#0EA5E9");
    setAvatarUrl("");
  };

  const handleDragStart = (agentId: string) => {
    setDraggedAgent(agentId);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (targetAgentId: string) => {
    if (!draggedAgent || draggedAgent === targetAgentId) {
      setDraggedAgent(null);
      return;
    }

    const draggedIndex = selectedAgents.indexOf(draggedAgent);
    const targetIndex = selectedAgents.indexOf(targetAgentId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedAgent(null);
      return;
    }

    const newAgents = [...selectedAgents];
    newAgents.splice(draggedIndex, 1);
    newAgents.splice(targetIndex, 0, draggedAgent);
    setSelectedAgents(newAgents);
    setDraggedAgent(null);
  };

  const removeAgent = (agentId: string) => {
    setSelectedAgents((prev) => prev.filter((a) => a !== agentId));
  };

  const openCreateDialog = () => {
    resetForm();
    setOpen(true);
  };

  const openEditDialog = (team: Team) => {
    setEditingTeamId(team.id);
    setName(team.name);
    setDesc(team.description ?? "");
    setSelectedAgents(team.agents || []);
    setMode((team.mode as "mesh" | "sequential" | "ring" | "supervisor" | "tree") ?? "sequential");
    setMaxSteps(String(team.maxSteps ?? 6));
    setAvatarMode(team.avatar_url ? "image" : team.avatar_icon ? "icon" : "initial");
    setAvatarIcon(team.avatar_icon || "users");
    setAvatarColor(isHexColor(team.avatar_color || "") ? (team.avatar_color as string) : "#0EA5E9");
    setAvatarUrl(team.avatar_url || "");
    setOpen(true);
  };

  const saveTeam = async () => {
    if (!name.trim() || selectedAgents.length === 0) return;
    const existing = editingTeamId ? teamList.find((t) => t.id === editingTeamId) : undefined;
    const parsedSteps = Number(maxSteps);
    const finalSteps = Number.isFinite(parsedSteps) ? Math.max(1, Math.min(10, Math.floor(parsedSteps))) : 6;
    try {
      const saved = await api.upsertTeam({
        id: editingTeamId ?? undefined,
        name: name.trim(),
        description: desc,
        agents: selectedAgents,
        activeTasks: existing?.activeTasks ?? 0,
        avatar: name.trim()[0]?.toUpperCase() || "T",
        avatar_icon: avatarMode === "icon" ? avatarIcon : "",
        avatar_color: isHexColor(avatarColor) ? avatarColor : "",
        avatar_url: avatarMode === "image" ? avatarUrl.trim() : "",
        mode: mode,
        maxSteps: finalSteps,
      });
      setTeamList((prev) => {
        const idx = prev.findIndex((t) => t.id === saved.id);
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

  const deleteTeam = async (id: string) => {
    try {
      await api.deleteTeam(id);
      setTeamList((prev) => prev.filter((t) => t.id !== id));
      if (editingTeamId === id) {
        resetForm();
        setOpen(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openTestDialog = (team: Team) => {
    setTestingTeam(team);
    setTestMessages([]);
    setTestError("");
    setTestPrompt("Run a quick kickoff discussion and align responsibilities.");
    setTestStepLimit("6");
    setTestOpen(true);
  };

  const stopTeamTest = () => {
    stopTestRef.current = true;
    setIsTesting(false);
  };

  const copyMessages = () => {
    const text = testMessages.map((m) => `[Step ${m.step}] ${m.agentId}: ${m.content}`).join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runTeamTest = async () => {
    if (!testingTeam || isTesting) return;
    
    if (testingTeam.agents.length === 0) {
      setTestError("This team has no agents to test.");
      return;
    }

    const parsedStep = Number(testStepLimit);
    const stepLimit = Number.isFinite(parsedStep) ? Math.max(1, Math.min(10, Math.floor(parsedStep))) : 6;

    stopTestRef.current = false;
    setIsTesting(true);
    setTestError("");
    setTestMessages([]);
    setTestThinkingAgents(new Set());

    try {
      let stepCounter = 0;
      for await (const event of api.runAgentGraphStream({
        user_input: testPrompt.trim() || "Coordinate a team execution plan.",
        agents: testingTeam.agents,
        max_rounds: stepLimit,
        mode: testingTeam.mode ?? "sequential",
        conversation_id: testingTeam.id,
      })) {
        if (stopTestRef.current) break;

        if (event.error) {
          setTestError(event.error);
          break;
        }

        // Handle different event types
        const eventType = event.type;
        const agentId = event.agent_id || event.agentId || event.agent_name || event.agentName;
        
        // Handle thinking state (LLM request start)
        if (eventType === "llm_request_start") {
          if (!agentId) continue;
          setTestThinkingAgents((prev) => new Set([...prev, agentId]));
        }
        // Remove thinking state (LLM response complete)
        else if (eventType === "llm_response_complete") {
          if (!agentId) continue;
          setTestThinkingAgents((prev) => {
            const next = new Set(prev);
            next.delete(agentId);
            return next;
          });
        }
        // Only add message when turn is complete
        else if (eventType === "turn_complete" && event.turn) {
          stepCounter += 1;
          const turn = event.turn;
          const turnAgentId = turn.agent_id || turn.agentId || turn.agent_name || turn.agentName;
          if (!turnAgentId) continue;
          const item: TeamTestMessage = {
            id: `${Date.now()}-${stepCounter}-${turnAgentId}`,
            agentId: turnAgentId,
            content: turn.content || "(No response)",
            step: turn.turn,
            timestamp: new Date().toISOString(),
          };
          setTestThinkingAgents((prev) => {
            const next = new Set(prev);
            next.delete(turnAgentId);
            return next;
          });
          setTestMessages((prev) => [...prev, item]);
        }
        // Fallback for old-style turn objects (if not wrapped in turn_complete event)
        else if (event.content && !eventType) {
          stepCounter += 1;
          if (!agentId) continue;
          const item: TeamTestMessage = {
            id: `${Date.now()}-${stepCounter}-${agentId}`,
            agentId: agentId,
            content: event.content || "(No response)",
            step: event.turn,
            timestamp: new Date().toISOString(),
          };
          setTestMessages((prev) => [...prev, item]);
        }
      }
    } catch (e) {
      setTestError(e instanceof Error ? e.message : "Failed to run team test discussion.");
    } finally {
      setIsTesting(false);
      setTestThinkingAgents(new Set());
    }
  };

  return (
    <div>
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
          <p className="text-muted-foreground mt-1">Assemble agent teams for complex tasks.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}><Plus className="w-4 h-4 mr-2" /> New Team</Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl w-[96vw] max-h-[90vh] overflow-y-auto overflow-x-hidden p-6">
            <DialogHeader><DialogTitle>{editingTeamId ? "Edit Team" : "Create Team"}</DialogTitle></DialogHeader>
            <div className="pt-2 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-4">
              <div className="space-y-4 min-w-0 pr-2 pb-1">
                <Input placeholder="Team name" value={name} onChange={(e) => setName(e.target.value)} />
                <Input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />

                <div className="space-y-3">
                  <div className="text-sm font-medium">Team Avatar</div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                    <select
                      value={avatarMode}
                      onChange={(e) => setAvatarMode(e.target.value as AvatarMode)}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                    >
                      <option value="initial">Initials</option>
                      <option value="icon">Icon</option>
                      <option value="image">Image URL</option>
                    </select>

                    <div className="flex items-center gap-2 justify-start sm:justify-end">
                      <span className="text-xs text-muted-foreground">Preview</span>
                      <AgentAvatar
                        agent={{
                          avatar: name.trim()[0]?.toUpperCase() || "T",
                          avatar_icon: avatarMode === "icon" ? avatarIcon : "",
                          avatar_color: isHexColor(avatarColor) ? avatarColor : "",
                          avatar_url: avatarMode === "image" ? avatarUrl.trim() : "",
                        }}
                        className="w-10 h-10"
                      />
                    </div>
                  </div>

                  {avatarMode === "icon" ? (
                    <select
                      value={avatarIcon}
                      onChange={(e) => setAvatarIcon(e.target.value)}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                    >
                      {teamAvatarIconOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : null}

                  {avatarMode === "image" ? (
                    <Input
                      placeholder="https://example.com/team-avatar.png"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                    />
                  ) : null}

                  <div className="flex items-center gap-3">
                    <Input
                      type="color"
                      value={isHexColor(avatarColor) ? avatarColor : "#0EA5E9"}
                      onChange={(e) => setAvatarColor(e.target.value)}
                      className="w-14 p-1 h-10"
                    />
                    <Input
                      placeholder="#0EA5E9"
                      value={avatarColor}
                      onChange={(e) => setAvatarColor(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Execution Mode</label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as "mesh" | "sequential" | "ring" | "supervisor" | "tree")}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                  >
                    <option value="sequential">Sequential (agents take turns)</option>
                    <option value="mesh">Mesh (all agents interact simultaneously)</option>
                    <option value="ring">Ring (agents loop in circular order)</option>
                    <option value="supervisor">Supervisor (lead delegates to workers)</option>
                    <option value="tree">Tree (root delegates down branches, leaves return to root)</option>
                  </select>
                  {mode === "supervisor" && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      First agent in the order will be the <strong>lead</strong>. Remaining agents are <strong>workers</strong>.
                    </p>
                  )}
                  {mode === "tree" && selectedAgents.length > 0 && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      Agents arranged as a binary tree: <strong>{agentById.get(selectedAgents[0])?.name ?? "Agent 1"}</strong> is root.
                      {selectedAgents.length > 1 && <> Children: <strong>{[selectedAgents[1], selectedAgents[2]].filter(Boolean).map(id => agentById.get(id)?.name).filter(Boolean).join(", ")}</strong>.</>}
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
                <Button onClick={saveTeam} className="w-full" disabled={!name.trim() || selectedAgents.length === 0}>
                  {editingTeamId ? "Save Changes" : "Create Team"}
                </Button>
              </div>

              <div className="space-y-4 min-w-0 pr-2 pb-1">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Agents</label>
                    <p className="text-xs text-muted-foreground">Choose agents on the left, then reorder on the right.</p>
                    <div className="border border-input rounded-lg p-3 h-[320px] overflow-y-auto bg-muted/50">
                      <div className="space-y-2">
                        {agentList.map((a) => (
                          <label key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-background cursor-pointer">
                            <Checkbox checked={selectedAgents.includes(a.id)} onCheckedChange={() => toggleAgent(a.id)} />
                            <span className="text-sm font-medium">{a.name}</span>
                            <span className="text-xs text-muted-foreground">({a.role})</span>
                            {a.skill_ids?.length ? (
                              <span className="text-xs text-muted-foreground ml-auto">
                                • {a.skills?.map((s) => s.name).join(", ")}
                              </span>
                            ) : null}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Agent Execution Order</label>
                    <p className="text-xs text-muted-foreground">Drag to reorder agents. If the list is long, scroll here.</p>
                    <div className="border border-input rounded-lg p-3 h-[320px] overflow-y-auto bg-muted/50 space-y-2">
                      {selectedAgents.length > 0 ? (
                        selectedAgents.map((agentId, index) => {
                          const agent = agentById.get(agentId);
                          if (!agent) return null;
                          return (
                            <div
                              key={agentId}
                              draggable
                              onDragStart={() => handleDragStart(agentId)}
                              onDragOver={handleDragOver}
                              onDrop={() => handleDrop(agentId)}
                              className={`flex items-center gap-3 p-3 rounded-lg border-2 border-dashed transition-all cursor-move ${
                                draggedAgent === agentId
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
                                  <span className="text-sm font-medium">{agent.name}</span>
                                  <span className="text-xs text-muted-foreground">({agent.role})</span>
                                </div>
                              </div>
                              <button
                                onClick={() => removeAgent(agentId)}
                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                title="Remove agent"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <div className="h-full flex items-center justify-center text-center text-xs text-muted-foreground px-4">
                          Select agents from the left panel to start arranging execution order.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <Dialog
        open={testOpen}
        onOpenChange={(next) => {
          setTestOpen(next);
          if (!next) stopTeamTest();
        }}
      >
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
          <DialogHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl">Test Team Discussion</DialogTitle>
                {testingTeam && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {testingTeam.name} • {testingTeam.agents.length} agents • {testingTeam.mode}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {testMessages.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyMessages}
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
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-sm font-semibold block mb-2">Discussion Prompt</label>
                <Textarea
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  placeholder="What should this team discuss?"
                  className="min-h-[90px] text-sm resize-none border-2 border-border focus:border-primary"
                  disabled={isTesting}
                />
              </div>
              <div className="grid grid-cols-[120px_100px_1fr] gap-2 items-end">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Max Steps</label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={testStepLimit}
                    onChange={(e) => setTestStepLimit(e.target.value)}
                    disabled={isTesting}
                    className="text-sm border-2 border-border"
                  />
                </div>
                <Button
                  onClick={runTeamTest}
                  disabled={!testingTeam || isTesting}
                  className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 h-9"
                >
                  <FlaskConical className="w-4 h-4 mr-1.5" />
                  {isTesting ? "Running" : "Run"}
                </Button>
                <Button
                  variant="outline"
                  onClick={stopTeamTest}
                  disabled={!isTesting}
                  className="h-9"
                >
                  <Square className="w-4 h-4 mr-1.5" />
                  Stop
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 flex-1 overflow-hidden">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Discussion Output</label>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                  {testMessages.length} messages
                </span>
              </div>
              <div className="flex-1 rounded-lg border-2 border-border bg-muted/20 p-3 overflow-y-auto space-y-2">
                {testMessages.length > 0 || testThinkingAgents.size > 0 ? (
                  <>
                    {testMessages.map((m) => {
                      const agent = agentById.get(m.agentId);
                      const ts = new Date(m.timestamp);
                      return (
                        <motion.div
                          key={m.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-lg border border-border bg-card p-3 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10">
                              <span className="text-xs font-bold text-primary">#{m.step}</span>
                            </span>
                            <span className="text-sm font-semibold text-foreground">
                              {agent?.name ?? m.agentId}
                            </span>
                            <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {isNaN(ts.getTime())
                                ? m.timestamp
                                : ts.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  })}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
                            {m.content}
                          </p>
                        </motion.div>
                      );
                    })}
                    
                    {/* Thinking indicators for test */}
                    {testThinkingAgents.size > 0 && (
                      Array.from(testThinkingAgents).map((agentId) => {
                        const agent = agentById.get(agentId);
                        return (
                          <motion.div
                            key={`thinking-${agentId}`}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-lg border border-primary/20 bg-primary/8 p-3"
                          >
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.2s" }} />
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.4s" }} />
                              </div>
                              <span className="text-sm font-semibold text-primary">
                                {agent?.name ?? agentId} is thinking...
                              </span>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </>
                ) : isTesting ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin w-8 h-8 border-2 border-muted border-t-primary rounded-full mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Streaming discussion...</p>
                    </div>
                  </div>
                ) : testError ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center p-6 rounded-lg bg-destructive/8 border border-destructive/30">
                      <p className="text-sm font-semibold text-destructive mb-1">Error</p>
                      <p className="text-sm text-destructive/80">{testError}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground">Run test to start streaming the discussion...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {teamList.map((team, i) => (
          <motion.div
            key={team.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <AgentAvatar
                agent={{ ...team, avatar: team.avatar || team.name?.slice(0, 1).toUpperCase() || "T" }}
                className={`w-10 h-10 ${team.avatar_color ? "" : "bg-primary/10 text-primary"}`}
                iconClassName="w-5 h-5"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold">{team.name}</h3>
                <p className="text-xs text-muted-foreground">{team.description}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => openTestDialog(team)} aria-label={`Test ${team.name}`}>
                  <FlaskConical className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEditDialog(team)} aria-label={`Edit ${team.name}`}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteTeam(team.id)} aria-label={`Delete ${team.name}`}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {team.agents.map((agentId) => {
                const agent = agentById.get(agentId);
                if (!agent) return null;
                return (
                  <span key={agentId} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-medium">
                    <AgentAvatar
                      agent={agent}
                      className="w-5 h-5 rounded-md text-[10px] bg-background/80"
                      iconClassName="w-3 h-3"
                    />
                    {agent.name}
                  </span>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
              <span>{team.activeTasks} active tasks</span>
              <span className="px-2 py-1 rounded bg-muted/50">
                {team.mode === "mesh" ? "🔗 Mesh" : team.mode === "ring" ? "🔄 Ring" : team.mode === "supervisor" ? "👑 Supervisor" : team.mode === "tree" ? "🌲 Tree" : "📋 Sequential"} • {team.maxSteps || 6} steps
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
