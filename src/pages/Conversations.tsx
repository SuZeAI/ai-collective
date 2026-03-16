import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type Agent, type Message } from "@/lib/api";
import { getAgentRoleColor } from "@/lib/agent-role-ui";

export default function Conversations() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [msgs, ags] = await Promise.all([
          api.listConversations(),
          api.listAgents(),
        ]);
        if (cancelled) return;
        setMessages(msgs);
        setAgents(ags);
        if (ags.length > 0) {
          setSelectedAgentId((prev) => prev || ags[0].id);
        }
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
    agents.forEach((a) => map.set(a.id, a));
    return map;
  }, [agents]);

  const sendPrompt = async () => {
    const value = prompt.trim();
    if (!value || !selectedAgentId || isSending) return;
    setIsSending(true);
    try {
      const reply = await api.chat({
        prompt: value,
        agentId: selectedAgentId,
      });
      const saved = await api.addConversation({
        agentId: selectedAgentId,
        content: reply.response,
        taskId: "task1",
      });
      setMessages((prev) => [...prev, saved]);
      setPrompt("");
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Conversations</h1>
        <p className="text-muted-foreground mt-1">Agent communication logs across active teams and tasks.</p>
      </header>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-agent-dev animate-pulse" />
          <span className="text-sm font-medium text-muted-foreground">Live agent conversations</span>
        </div>
        <div className="p-4 border-b border-border">
          <div className="grid gap-2 md:grid-cols-[220px_1fr_auto]">
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendPrompt();
              }}
              placeholder="Enter prompt to chat with selected agent"
              disabled={isSending || !selectedAgentId}
            />
            <Button onClick={sendPrompt} disabled={isSending || !selectedAgentId || !prompt.trim()}>
              <Send className="w-4 h-4 mr-2" />
              {isSending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
        <div className="p-6 space-y-5">
          {messages.map((msg, i) => {
            const agent = agentById.get(msg.agentId);
            if (!agent) return null;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex gap-4 items-start"
              >
                <div className={`mt-0.5 w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold ${getAgentRoleColor(agent.role)}`}>
                  {agent.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{agent.name}</span>
                    <span className="text-[10px] text-muted-foreground">{agent.role}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {(() => {
                        const d = new Date(msg.timestamp);
                        return isNaN(d.getTime())
                          ? msg.timestamp
                          : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                      })()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-1">{msg.content}</p>
                </div>
              </motion.div>
            );
          })}
          {messages.length === 0 && (
            <div className="text-sm text-muted-foreground">No messages yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
