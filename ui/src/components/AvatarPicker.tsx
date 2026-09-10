import { StaffAvatar } from "@/components/StaffAvatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type AvatarMode = "initial" | "icon" | "image";

export function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

type AvatarPickerProps = {
  label: string;
  mode: AvatarMode;
  onModeChange: (mode: AvatarMode) => void;
  icon: string;
  onIconChange: (icon: string) => void;
  color: string;
  onColorChange: (color: string) => void;
  url: string;
  onUrlChange: (url: string) => void;
  iconOptions: readonly { value: string; label: string }[];
  previewFallback: string;
  defaultColor: string;
  urlPlaceholder: string;
};

export function AvatarPicker({
  label,
  mode,
  onModeChange,
  icon,
  onIconChange,
  color,
  onColorChange,
  url,
  onUrlChange,
  iconOptions,
  previewFallback,
  defaultColor,
  urlPlaceholder,
}: AvatarPickerProps) {
  return (
    <div className="space-y-3 border rounded-lg p-3 bg-muted/10">
      <div className="text-sm font-medium">{label}</div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
        <Select value={mode} onValueChange={(v) => onModeChange(v as AvatarMode)}>
          <SelectTrigger>
            <SelectValue placeholder="Avatar style" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="initial">Initials</SelectItem>
            <SelectItem value="icon">Icon</SelectItem>
            <SelectItem value="image">Image URL</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Preview</span>
          <StaffAvatar
            staff={{
              avatar: previewFallback,
              avatar_icon: mode === "icon" ? icon : "",
              avatar_color: isHexColor(color) ? color : "",
              avatar_url: mode === "image" ? url.trim() : "",
            }}
            className="w-10 h-10"
          />
        </div>
      </div>

      {mode === "icon" ? (
        <Select value={icon} onValueChange={onIconChange}>
          <SelectTrigger>
            <SelectValue placeholder="Pick icon" />
          </SelectTrigger>
          <SelectContent>
            {iconOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {mode === "image" ? (
        <Input placeholder={urlPlaceholder} value={url} onChange={(e) => onUrlChange(e.target.value)} />
      ) : null}

      <div className="flex items-center gap-3">
        <Input
          type="color"
          value={isHexColor(color) ? color : defaultColor}
          onChange={(e) => onColorChange(e.target.value)}
          className="w-14 p-1 h-10 cursor-pointer"
        />
        <Input placeholder={defaultColor} value={color} onChange={(e) => onColorChange(e.target.value)} />
      </div>
    </div>
  );
}
