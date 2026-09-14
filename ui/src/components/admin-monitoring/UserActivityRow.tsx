import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { type AdminUserActivity } from "@/lib/api";
import { formatCost, formatTokens } from "@/lib/format";

// Memoized so switching tabs/dialogs elsewhere on the page doesn't re-render
// every row in this table — same pattern as KanbanCard/StaffCard/PlanStats.
export const UserActivityRow = memo(function UserActivityRow({ user }: { user: AdminUserActivity }) {
  return (
    <TableRow>
      <TableCell>
        <span className="text-xs font-medium">{user.name}</span>
        <p className="text-[10px] text-muted-foreground">{user.email}</p>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={`text-[10px] capitalize ${
            user.role === "admin" || user.role === "system"
              ? "text-primary border-primary/40"
              : "text-muted-foreground"
          }`}
        >
          {user.role}
        </Badge>
      </TableCell>
      <TableCell className="text-right text-xs tabular-nums">{user.staff}</TableCell>
      <TableCell className="text-right text-xs tabular-nums">{user.departments}</TableCell>
      <TableCell className="text-right text-xs tabular-nums">{user.tasks}</TableCell>
      <TableCell className="text-right text-xs tabular-nums">
        {formatTokens(user.inputTokens + user.outputTokens)}
      </TableCell>
      <TableCell className="text-right text-xs tabular-nums font-semibold">{formatCost(user.cost)}</TableCell>
    </TableRow>
  );
});
