import { memo } from "react";
import { type SkillToolPreset } from "@/lib/api";

// Memoized so retyping in the preset-search box only re-renders rows whose
// membership in the filtered list actually changed, not every row on every
// keystroke — same pattern as KanbanCard/StaffCard/PlanStats elsewhere.
export const PresetSuggestionRow = memo(function PresetSuggestionRow({
  preset,
  onSelect,
}: {
  preset: SkillToolPreset;
  onSelect: (preset: SkillToolPreset) => void;
}) {
  return (
    <button
      type="button"
      className="w-full text-left px-2.5 py-1.5 text-xs rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors font-medium"
      onMouseDown={() => onSelect(preset)}
    >
      {preset.label} <span className="text-[10px] text-muted-foreground ml-1">({preset.tool_name})</span>
    </button>
  );
});
