import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FlaskConical, Pencil, Plus, Square, Trash2, Users, Copy, Check, Clock, GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { api, type Agent, type Team } from "@/lib/api";

type TeamTestMessage = {
  id: string;
  agentId: string;
  content: string;
  step: number;
  timestamp: string;
};

export default function TeamBuilder() {
  const [teamList, setTeamList] = useState<Team[]>([]);
  const [agentList, setAgentList] = useState<Agent[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [mode, setMode] = useState<"mesh" | "sequential">("sequential");
  const [maxSteps, setMaxSteps] = useState("6");
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [draggedAgent, setDraggedAgent] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testingTeam, setTestingTeam] = useState<Team | null>(null);
  const [testPrompt, setTestPrompt] = useState("Run a quick kickoff discussion and align responsibilities.");
  const [testStepLimit, setTestStepLimit] = useState("6");
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState("");
  const [testMessages, setTestMessages] = useState<TeamTestMessage[]>([]);
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
    setMode(team.mode ?? "sequential");
    setMaxSteps(String(team.maxSteps ?? 6));
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

    try {
      let stepCounter = 0;
      for await (const turn of api.runAgentGraphStream({
        user_input: testPrompt.trim() || "Coordinate a team execution plan.",
        agents: testingTeam.agents,
        max_rounds: stepLimit,
        mode: testingTeam.mode ?? "sequential",
      })) {
        if (stopTestRef.current) break;

        if (turn.error) {
          setTestError(turn.error);
          break;
        }

        stepCounter += 1;
        const item: TeamTestMessage = {
          id: `${Date.now()}-${stepCounter}-${turn.agent_id}`,
          agentId: turn.agent_id,
          content: turn.content || "(No response)",
          step: turn.turn,
          timestamp: new Date().toISOString(),
        };
        setTestMessages((prev) => [...prev, item]);
      }
    } catch (e) {
      setTestError(e instanceof Error ? e.message : "Failed to run team test discussion.");
    } finally {
      setIsTesting(false);
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
          <DialogContent>
            <DialogHeader><DialogTitle>{editingTeamId ? "Edit Team" : "Create Team"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <Input placeholder="Team name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Agents</label>
                <div className="border border-input rounded-lg p-3 max-h-48 overflow-y-auto bg-muted/50">
                  <div className="space-y-2">
                    {agentList.map((a) => (
                      <label key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-background cursor-pointer">
                        <Checkbox checked={selectedAgents.includes(a.id)} onCheckedChange={() => toggleAgent(a.id)} />
                        <span className="text-sm font-medium">{a.name}</span>
                        <span className="text-xs text-muted-foreground">({a.role})</span>
                        {a.skill_ids?.length ? (
                          <span className="text-xs text-muted-foreground ml-auto">
                            • {a.skills?.map(s => s.name).join(', ')}
                          </span>
                        ) : null}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {selectedAgents.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Agent Execution Order</label>
                  <p className="text-xs text-muted-foreground">Drag to reorder agents (order will be used in tests)</p>
                  <div className="border border-input rounded-lg p-3 bg-muted/50 space-y-2">
                    {selectedAgents.map((agentId, index) => {
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
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 opacity-50"
                              : "border-transparent bg-background hover:bg-muted/50 hover:border-slate-300"
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
                    })}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Execution Mode</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as "mesh" | "sequential")}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                >
                  <option value="sequential">Sequential (agents take turns)</option>
                  <option value="mesh">Mesh (all agents interact simultaneously)</option>
                </select>
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
                  className="min-h-[90px] text-sm resize-none border-2 border-slate-200 dark:border-slate-700 focus:border-blue-500"
                  disabled={isTesting}
                />
              </div>
              <div className="grid grid-cols-[120px_100px_1fr] gap-2 items-end">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Max Steps</label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={testStepLimit}
                    onChange={(e) => setTestStepLimit(e.target.value)}
                    disabled={isTesting}
                    className="text-sm border-2 border-slate-200 dark:border-slate-700"
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
                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  {testMessages.length} messages
                </span>
              </div>
              <div className="flex-1 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-3 overflow-y-auto space-y-2">
                {testMessages.length > 0 ? (
                  testMessages.map((m) => {
                    const agent = agentById.get(m.agentId);
                    const ts = new Date(m.timestamp);
                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-3 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-900/20">
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300">#{m.step}</span>
                          </span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {agent?.name ?? m.agentId}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto flex items-center gap-1">
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
                        <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                          {m.content}
                        </p>
                      </motion.div>
                    );
                  })
                ) : isTesting ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-3" />
                      <p className="text-sm text-slate-600 dark:text-slate-400">🔄 Streaming discussion...</p>
                    </div>
                  </div>
                ) : testError ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center p-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700">
                      <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">🚨 Error</p>
                      <p className="text-sm text-red-600 dark:text-red-300">{testError}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Run test to start streaming the discussion...</p>
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
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
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
                    {agent.avatar} {agent.name}
                  </span>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
              <span>{team.activeTasks} active tasks</span>
              <span className="px-2 py-1 rounded bg-muted/50">
                {team.mode === "mesh" ? "🔗 Mesh" : "📋 Sequential"} • {team.maxSteps || 6} steps
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
