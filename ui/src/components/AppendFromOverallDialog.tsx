import { useMemo, useState } from "react";
import { Import, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export type AppendItem = {
  id: string;
  name: string;
  /** Secondary line, e.g. role or description. */
  sub?: string;
  /** Small badge on the right, e.g. workflow mode or tool name. */
  badge?: string;
};

export type AppendTarget = {
  id: string;
  name: string;
};

type AppendFromOverallDialogProps = {
  /** Dialog title, e.g. "Append staff from Overall". */
  title: string;
  /** Helper text under the title. */
  description?: string;
  /** Candidates from Overall that are not part of the office yet. */
  items: AppendItem[];
  /** Shown when `items` is empty. */
  emptyText: string;
  /** Optional target choices (e.g. which department receives the staff). */
  targets?: AppendTarget[];
  /** Label for the target select, e.g. "Add to department". */
  targetLabel?: string;
  /** Shown when `targets` is provided but empty. */
  noTargetText?: string;
  /** Compact trigger for tight headers. */
  size?: "sm" | "default";
  /**
   * When set, shows a "create independent copies" checkbox (checked by default)
   * and its value is passed to onAppend as `makeCopy`.
   */
  copyLabel?: string;
  onAppend: (ids: string[], targetId?: string, makeCopy?: boolean) => Promise<void>;
};

/**
 * "Append from Overall" picker: lets the user pull items that exist in the
 * Overall pool (shared "default" items + their own) into the selected office.
 */
export function AppendFromOverallDialog({
  title,
  description,
  items,
  emptyText,
  targets,
  targetLabel,
  noTargetText,
  size = "default",
  copyLabel,
  onAppend,
}: AppendFromOverallDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [targetId, setTargetId] = useState("");
  const [makeCopy, setMakeCopy] = useState(true);
  const [busy, setBusy] = useState(false);

  const needsTarget = targets !== undefined;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) => it.name.toLowerCase().includes(q) || (it.sub || "").toLowerCase().includes(q),
    );
  }, [items, search]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const reset = () => {
    setSearch("");
    setSelected([]);
    setTargetId("");
    setMakeCopy(true);
  };

  const apply = async () => {
    if (selected.length === 0 || (needsTarget && !targetId)) return;
    setBusy(true);
    try {
      await onAppend(selected, needsTarget ? targetId : undefined, copyLabel ? makeCopy : undefined);
      toast({ title: "Appended from Overall", description: `${selected.length} item(s) added to this office.` });
      reset();
      setOpen(false);
    } catch (e) {
      const detail = e instanceof Error ? e.message : "Failed to append items";
      toast({ title: "Append from Overall", description: detail, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          size={size}
          variant="outline"
          className={size === "sm" ? "h-8 gap-1 text-xs" : undefined}
        >
          <Import className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4 mr-2"} />
          Append from Overall
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg w-[95vw]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {/* min-w-0 keeps long nowrap (truncate) rows from blowing the grid track past the dialog width */}
        <div className="space-y-3 pt-2 min-w-0">
          {description && <p className="text-xs text-muted-foreground">{description}</p>}

          {needsTarget && (
            (targets?.length ?? 0) > 0 ? (
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder={targetLabel || "Select target"} />
                </SelectTrigger>
                <SelectContent>
                  {targets!.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {noTargetText || "No editable target in this office yet."}
              </p>
            )
          )}

          {items.length > 0 && (
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}

          <div className="border rounded-lg p-2 h-[300px] overflow-y-auto space-y-1">
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8 px-4">{emptyText}</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8 px-4">No matches.</p>
            ) : (
              filtered.map((it) => (
                <label
                  key={it.id}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5 cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox checked={selected.includes(it.id)} onCheckedChange={() => toggle(it.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{it.name}</p>
                    {it.sub && <p className="text-xs text-muted-foreground truncate">{it.sub}</p>}
                  </div>
                  {it.badge && (
                    <Badge variant="outline" className="text-[10px] shrink-0">{it.badge}</Badge>
                  )}
                </label>
              ))
            )}
          </div>

          {copyLabel && (
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={makeCopy}
                onCheckedChange={(v) => setMakeCopy(v === true)}
                className="mt-0.5"
              />
              <span className="text-xs text-muted-foreground">{copyLabel}</span>
            </label>
          )}

          <Button
            className="w-full"
            onClick={apply}
            disabled={busy || selected.length === 0 || (needsTarget && !targetId)}
          >
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Append {selected.length > 0 ? `(${selected.length})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
