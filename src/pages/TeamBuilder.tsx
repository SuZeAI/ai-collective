import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FlaskConical, Pencil, Plus, Square, Trash2, Users } from "lucide-react";
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
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testingTeam, setTestingTeam] = useState<Team | null>(null);
  const [testPrompt, setTestPrompt] = useState("Run a quick kickoff discussion and align responsibilities.");
  const [testStepLimit, setTestStepLimit] = useState("6");
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState("");
  const [testMessages, setTestMessages] = useState<TeamTestMessage[]>([]);
  const [open, setOpen] = useState(false);
  const stopTestRef = useRef(false);

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
    setOpen(true);
  };

  const saveTeam = async () => {
    if (!name.trim() || selectedAgents.length === 0) return;
    const existing = editingTeamId ? teamList.find((t) => t.id === editingTeamId) : undefined;
    try {
      const saved = await api.upsertTeam({
        id: editingTeamId ?? undefined,
        name: name.trim(),
        description: desc,
        agents: selectedAgents,
        activeTasks: existing?.activeTasks ?? 0,
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

  const runTeamTest = async () => {
    if (!testingTeam || isTesting) return;
    const participants = testingTeam.agents
      .map((id) => agentById.get(id))
      .filter(Boolean) as Agent[];
    if (participants.length === 0) {
      setTestError("This team has no available agents to test.");
      return;
    }

    const parsedStep = Number(testStepLimit);
    const stepLimit = Number.isFinite(parsedStep) ? Math.max(1, Math.min(10, Math.floor(parsedStep))) : 6;

    stopTestRef.current = false;
    setIsTesting(true);
    setTestError("");
    setTestMessages([]);

    let history = "";
    try {
      for (let step = 0; step < stepLimit; step += 1) {
        if (stopTestRef.current) break;
        const speaker = participants[step % participants.length];
        const prompt = [
          `You are in team: ${testingTeam.name}.`,
          `Scenario: ${testPrompt.trim() || "Coordinate a team execution plan."}`,
          "Continue the discussion in 1-2 concise sentences.",
          history ? `Previous discussion:\n${history}` : "No previous messages yet.",
        ].join("\n\n");

        const result = await api.chat({
          agentId: speaker.id,
          prompt,
        });

        const content = (result.response || "").trim() || "(No response)";
        const item: TeamTestMessage = {
          id: `${Date.now()}-${step}-${speaker.id}`,
          agentId: speaker.id,
          content,
          step: step + 1,
          timestamp: new Date().toISOString(),
        };
        setTestMessages((prev) => [...prev, item]);
        history = `${history}\n${speaker.name}: ${content}`.trim();
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
                {agentList.map((a) => (
                  <label key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer">
                    <Checkbox checked={selectedAgents.includes(a.id)} onCheckedChange={() => toggleAgent(a.id)} />
                    <span className="text-sm font-medium">{a.name}</span>
                    <span className="text-xs text-muted-foreground">({a.role})</span>
                    {a.skills?.length ? (
                      <span className="text-xs text-muted-foreground">• {a.skills.length} skills</span>
                    ) : null}
                  </label>
                ))}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Team Discussion{testingTeam ? `: ${testingTeam.name}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Textarea
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              placeholder="What should this team discuss?"
              className="min-h-[90px]"
              disabled={isTesting}
            />
            <div className="grid grid-cols-[140px_1fr] gap-2 items-center">
              <label className="text-xs text-muted-foreground">Max Steps (1-10)</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={testStepLimit}
                onChange={(e) => setTestStepLimit(e.target.value)}
                disabled={isTesting}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={runTeamTest} disabled={!testingTeam || isTesting}>
                <FlaskConical className="w-4 h-4 mr-2" />
                {isTesting ? "Running..." : "Run Test"}
              </Button>
              <Button variant="outline" onClick={stopTeamTest} disabled={!isTesting}>
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
            </div>

            <div className="rounded-md border p-3 h-[260px] overflow-y-auto space-y-2">
              {testMessages.map((m) => {
                const agent = agentById.get(m.agentId);
                const ts = new Date(m.timestamp);
                return (
                  <div key={m.id} className="rounded-md border border-border/70 p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold">Step {m.step}</span>
                      <span className="text-xs text-muted-foreground">{agent?.name ?? m.agentId}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {isNaN(ts.getTime()) ? m.timestamp : ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{m.content}</p>
                  </div>
                );
              })}
              {isTesting && (
                <div className="text-xs text-muted-foreground">Streaming discussion...</div>
              )}
              {!isTesting && testMessages.length === 0 && !testError && (
                <div className="text-xs text-muted-foreground">Run test to start streaming the discussion.</div>
              )}
              {testError && <div className="text-xs text-rose-500">{testError}</div>}
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
            <div className="text-xs text-muted-foreground font-mono">{team.activeTasks} active tasks</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
