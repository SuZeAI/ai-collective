import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { api, type Agent, type Team } from "@/lib/api";

export default function TeamBuilder() {
  const [teamList, setTeamList] = useState<Team[]>([]);
  const [agentList, setAgentList] = useState<Agent[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

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
