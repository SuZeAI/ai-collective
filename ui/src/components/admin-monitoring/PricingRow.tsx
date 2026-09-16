import { memo } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { type ModelPricing } from "@/lib/api";

// Memoized so switching tabs/dialogs elsewhere on the page doesn't re-render
// every row in this table — same pattern as KanbanCard/StaffCard/PlanStats.
export const PricingRow = memo(function PricingRow({
  pricing, onEdit, onDelete,
}: {
  pricing: ModelPricing; onEdit: (p: ModelPricing) => void; onDelete: (model: string) => void;
}) {
  return (
    <TableRow>
      <TableCell className="text-xs font-medium">{pricing.model}</TableCell>
      <TableCell className="text-xs capitalize text-muted-foreground">{pricing.provider || "—"}</TableCell>
      <TableCell className="text-right text-xs tabular-nums">${pricing.inputPricePerMillion.toFixed(2)}</TableCell>
      <TableCell className="text-right text-xs tabular-nums">${pricing.outputPricePerMillion.toFixed(2)}</TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(pricing)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(pricing.model)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});
