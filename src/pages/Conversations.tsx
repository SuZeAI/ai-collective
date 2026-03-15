import { motion } from "framer-motion";
import { conversations, getAgent, getAgentRoleColor } from "@/data/mock-data";

export default function Conversations() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Conversations</h1>
        <p className="text-muted-foreground mt-1">Agent communication logs across tasks.</p>
      </header>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-agent-dev animate-pulse" />
          <span className="text-sm font-medium text-muted-foreground">Task: Create landing page for AI startup</span>
        </div>
        <div className="p-6 space-y-5">
          {conversations.map((msg, i) => {
            const agent = getAgent(msg.agentId);
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
                    <span className="text-[10px] text-muted-foreground font-mono">{msg.timestamp}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-1">{msg.content}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
