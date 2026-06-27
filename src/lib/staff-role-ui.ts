export function getStaffRoleColor(role: string): string {
  if (role.includes("Manager")) return "bg-staff-pm/15 text-staff-pm";
  if (role.includes("Developer")) return "bg-staff-dev/15 text-staff-dev";
  if (role.includes("Research")) return "bg-staff-research/15 text-staff-research";
  if (role.includes("Marketing")) return "bg-staff-marketing/15 text-staff-marketing";
  if (role.includes("Review")) return "bg-staff-reviewer/15 text-staff-reviewer";
  return "bg-muted text-muted-foreground";
}

export function getStaffDotColor(role: string): string {
  if (role.includes("Manager")) return "bg-staff-pm";
  if (role.includes("Developer")) return "bg-staff-dev";
  if (role.includes("Research")) return "bg-staff-research";
  if (role.includes("Marketing")) return "bg-staff-marketing";
  if (role.includes("Review")) return "bg-staff-reviewer";
  return "bg-muted-foreground";
}
