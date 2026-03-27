export function getAgentRoleColor(role: string): string {
  if (role.includes("Manager")) return "bg-agent-pm/15 text-agent-pm";
  if (role.includes("Developer")) return "bg-agent-dev/15 text-agent-dev";
  if (role.includes("Research")) return "bg-agent-research/15 text-agent-research";
  if (role.includes("Marketing")) return "bg-agent-marketing/15 text-agent-marketing";
  if (role.includes("Review")) return "bg-agent-reviewer/15 text-agent-reviewer";
  return "bg-muted text-muted-foreground";
}

export function getAgentDotColor(role: string): string {
  if (role.includes("Manager")) return "bg-agent-pm";
  if (role.includes("Developer")) return "bg-agent-dev";
  if (role.includes("Research")) return "bg-agent-research";
  if (role.includes("Marketing")) return "bg-agent-marketing";
  if (role.includes("Review")) return "bg-agent-reviewer";
  return "bg-muted-foreground";
}
