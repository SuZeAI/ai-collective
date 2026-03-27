import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AgentAvatar, skillAvatarIconOptions } from "@/components/AgentAvatar";
import { api, type Skill, type SkillToolConfigField, type SkillToolPreset } from "@/lib/api";

type ToolName = string;
type AvatarMode = "initial" | "icon" | "image";
type ToolConfigValue = string | boolean;

function toTitleCaseFromToolName(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function toToolPreset(toolName: string): SkillToolPreset {
  const title = toTitleCaseFromToolName(toolName);
  return {
    tool_name: toolName,
    label: title,
    third_party: title,
    config_fields: [],
  };
}

function boolFromUnknown(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function getConfigVariableNames(config: Record<string, unknown> | undefined): string[] {
  if (!config) return [];
  return Object.keys(config).filter((key) => key.trim().length > 0);
}

function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

function buildDefaultConfigValues(preset: SkillToolPreset | undefined): Record<string, ToolConfigValue> {
  if (!preset) return {};
  const next: Record<string, ToolConfigValue> = {};

  for (const field of preset.config_fields || []) {
    if (field.input === "boolean") {
      next[field.key] = boolFromUnknown(field.default, false);
      continue;
    }
    next[field.key] = String(field.default ?? "");
  }

  return next;
}

function buildConfigValuesForEdit(
  preset: SkillToolPreset | undefined,
  config: Record<string, unknown> | undefined,
): Record<string, ToolConfigValue> {
  const defaults = buildDefaultConfigValues(preset);
  if (!preset || !config) return defaults;

  const next = { ...defaults };
  for (const field of preset.config_fields || []) {
    const current = config[field.key];
    if (current === undefined || current === null) continue;
    if (field.input === "boolean") {
      next[field.key] = boolFromUnknown(current, boolFromUnknown(field.default, false));
      continue;
    }
    next[field.key] = String(current);
  }
  return next;
}

function buildConfigFromValues(
  preset: SkillToolPreset | undefined,
  values: Record<string, ToolConfigValue>,
): Record<string, unknown> {
  if (!preset) return {};
  const config: Record<string, unknown> = {};

  for (const field of preset.config_fields || []) {
    const value = values[field.key];
    if (field.input === "boolean") {
      config[field.key] = Boolean(value);
      continue;
    }
    config[field.key] = String(value ?? "").trim();
  }

  return config;
}

function validateRequiredConfig(
  preset: SkillToolPreset | undefined,
  values: Record<string, ToolConfigValue>,
): boolean {
  if (!preset) return true;

  for (const field of preset.config_fields || []) {
    if (!field.required) continue;

    const value = values[field.key];
    if (field.input === "boolean") continue;
    if (!String(value ?? "").trim()) return false;
  }

  return true;
}

export default function Skills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [toolPresets, setToolPresets] = useState<SkillToolPreset[]>([]);
  const [open, setOpen] = useState(false);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);

  const [toolName, setToolName] = useState<ToolName>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [configValues, setConfigValues] = useState<Record<string, ToolConfigValue>>({});

  const [avatarMode, setAvatarMode] = useState<AvatarMode>("initial");
  const [avatarIcon, setAvatarIcon] = useState("wrench");
  const [avatarColor, setAvatarColor] = useState("#3b82f6");
  const [avatarUrl, setAvatarUrl] = useState("");

  const presetByTool = useMemo(() => {
    return new Map(toolPresets.map((preset) => [preset.tool_name, preset]));
  }, [toolPresets]);

  const selectedPreset = useMemo(() => {
    if (!toolName) return null;
    return presetByTool.get(toolName) ?? toToolPreset(toolName);
  }, [presetByTool, toolName]);

  const handleToolChange = (nextToolName: ToolName) => {
    setToolName(nextToolName);
    const nextPreset = presetByTool.get(nextToolName) ?? toToolPreset(nextToolName);
    setConfigValues(buildDefaultConfigValues(nextPreset));
    if (!editingSkillId) {
      setName(nextPreset.label || "");
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, backendPresets] = await Promise.all([
          api.listSkills(),
          api.listSkillToolPresets().catch(async () => {
            const tools = await api.listSkillTools();
            return tools.map(toToolPreset);
          }),
        ]);
        if (cancelled) return;

        const uniquePresets = Array.from(
          new Map(
            backendPresets
              .filter((preset) => String(preset.tool_name || "").trim().length > 0)
              .map((preset) => [preset.tool_name, preset]),
          ).values(),
        );

        setSkills(list);
        setToolPresets(uniquePresets);

        if (uniquePresets.length > 0) {
          const firstTool = uniquePresets[0].tool_name;
          setToolName((current) => (current && uniquePresets.some((preset) => preset.tool_name === current) ? current : firstTool));
          setConfigValues((current) => (Object.keys(current).length > 0 ? current : buildDefaultConfigValues(uniquePresets[0])));
          setName((current) => current || uniquePresets[0].label || "");
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (editingSkillId) return;
    if (!selectedPreset) return;
    setName(selectedPreset.label || "");
    setConfigValues(buildDefaultConfigValues(selectedPreset));
  }, [selectedPreset, editingSkillId]);

  const resetForm = () => {
    const defaultPreset = toolPresets[0];
    setEditingSkillId(null);
    setToolName(defaultPreset?.tool_name ?? "");
    setName(defaultPreset?.label ?? "");
    setDescription("");
    setConfigValues(buildDefaultConfigValues(defaultPreset));
    setAvatarMode("initial");
    setAvatarIcon("wrench");
    setAvatarColor("#3b82f6");
    setAvatarUrl("");
  };

  const openCreateDialog = () => {
    resetForm();
    setOpen(true);
  };

  const openEditDialog = (skill: Skill) => {
    const skillToolName = String(skill.tool_name || "").trim();
    const inferredByThirdParty = toolPresets.find(
      (preset) => preset.third_party.trim().toLowerCase() === String(skill.third_party || "").trim().toLowerCase(),
    )?.tool_name;
    const inferredToolName: ToolName = skillToolName || inferredByThirdParty || toolPresets[0]?.tool_name || "";

    const preset = presetByTool.get(inferredToolName) ?? toToolPreset(inferredToolName);

    setEditingSkillId(skill.id);
    setToolName(inferredToolName);
    setName(skill.name ?? "");
    setDescription(skill.description ?? "");
    setConfigValues(buildConfigValuesForEdit(preset, (skill.config as Record<string, unknown> | undefined) ?? {}));

    setAvatarMode(skill.avatar_url ? "image" : skill.avatar_icon ? "icon" : "initial");
    setAvatarIcon(skill.avatar_icon || "wrench");
    setAvatarColor(isHexColor(skill.avatar_color || "") ? (skill.avatar_color as string) : "#3b82f6");
    setAvatarUrl(skill.avatar_url || "");

    setOpen(true);
  };

  const isValid = (): boolean => {
    if (!name.trim()) return false;
    if (!toolName.trim()) return false;
    return validateRequiredConfig(selectedPreset ?? undefined, configValues);
  };

  const saveSkill = async () => {
    if (!isValid()) return;

    const config = buildConfigFromValues(selectedPreset ?? undefined, configValues);

    try {
      const saved = await api.upsertSkill({
        id: editingSkillId ?? undefined,
        name: name.trim(),
        description: description.trim(),
        kind: "integration",
        third_party: selectedPreset?.third_party ?? toTitleCaseFromToolName(toolName),
        tool_name: toolName,
        config,
        avatar: name.trim()[0]?.toUpperCase() || "S",
        avatar_icon: avatarMode === "icon" ? avatarIcon : "",
        avatar_color: isHexColor(avatarColor) ? avatarColor : "",
        avatar_url: avatarMode === "image" ? avatarUrl.trim() : "",
        code: null,
      });
      setSkills((prev) => {
        const idx = prev.findIndex((s) => s.id === saved.id);
        if (idx === -1) return [...prev, saved];
        const next = [...prev];
        next[idx] = saved;
        return next;
      });
      setOpen(false);
      resetForm();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteSkill = async (id: string) => {
    try {
      await api.deleteSkill(id);
      setSkills((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const updateConfigValue = (field: SkillToolConfigField, value: ToolConfigValue) => {
    setConfigValues((prev) => ({ ...prev, [field.key]: value }));
  };

  return (
    <div>
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Skills</h1>
          <p className="text-muted-foreground mt-1">Create reusable skills and assign them to agents.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}><Plus className="w-4 h-4 mr-2" /> New Skill</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingSkillId ? "Edit Skill" : "Create Skill"}</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <Select value={toolName} onValueChange={handleToolChange}>
                <SelectTrigger><SelectValue placeholder="Preset" /></SelectTrigger>
                <SelectContent>
                  {toolPresets.map((p) => (
                    <SelectItem key={p.tool_name} value={p.tool_name}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input placeholder="Skill name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />

              <div className="space-y-3">
                <div className="text-sm font-medium">Avatar</div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                  <Select value={avatarMode} onValueChange={(value) => setAvatarMode(value as AvatarMode)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Avatar style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="initial">Initials</SelectItem>
                      <SelectItem value="icon">Icon</SelectItem>
                      <SelectItem value="image">Image URL</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2 justify-start sm:justify-end">
                    <span className="text-xs text-muted-foreground">Preview</span>
                    <AgentAvatar
                      agent={{
                        avatar: name.trim()[0]?.toUpperCase() || "S",
                        avatar_icon: avatarMode === "icon" ? avatarIcon : "",
                        avatar_color: isHexColor(avatarColor) ? avatarColor : "",
                        avatar_url: avatarMode === "image" ? avatarUrl.trim() : "",
                      }}
                      className="w-10 h-10"
                    />
                  </div>
                </div>

                {avatarMode === "icon" ? (
                  <Select value={avatarIcon} onValueChange={setAvatarIcon}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick icon" />
                    </SelectTrigger>
                    <SelectContent>
                      {skillAvatarIconOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}

                {avatarMode === "image" ? (
                  <Input
                    placeholder="https://example.com/skill-avatar.png"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                  />
                ) : null}

                <div className="flex items-center gap-3">
                  <Input
                    type="color"
                    value={isHexColor(avatarColor) ? avatarColor : "#3b82f6"}
                    onChange={(e) => setAvatarColor(e.target.value)}
                    className="w-14 p-1 h-10"
                  />
                  <Input
                    placeholder="#3b82f6"
                    value={avatarColor}
                    onChange={(e) => setAvatarColor(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-md border p-3 space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Tool Config</div>
                {selectedPreset && selectedPreset.config_fields.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {selectedPreset.config_fields.map((field) => {
                      const fieldValue = configValues[field.key];

                      if (field.input === "select") {
                        const current = String(fieldValue ?? field.default ?? "");
                        return (
                          <div key={field.key} className="space-y-1">
                            <div className="text-sm">{field.label}</div>
                            <Select value={current} onValueChange={(value) => updateConfigValue(field, value)}>
                              <SelectTrigger><SelectValue placeholder={field.placeholder || field.label} /></SelectTrigger>
                              <SelectContent>
                                {(field.options || []).map((option) => (
                                  <SelectItem key={option} value={option}>{option}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {field.description ? <p className="text-xs text-muted-foreground">{field.description}</p> : null}
                          </div>
                        );
                      }

                      if (field.input === "boolean") {
                        return (
                          <label key={field.key} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={Boolean(fieldValue)}
                              onChange={(e) => updateConfigValue(field, e.target.checked)}
                            />
                            {field.label}
                          </label>
                        );
                      }

                      if (field.input === "textarea") {
                        return (
                          <div key={field.key} className="space-y-1">
                            <div className="text-sm">{field.label}</div>
                            <Textarea
                              placeholder={field.placeholder || field.label}
                              value={String(fieldValue ?? "")}
                              onChange={(e) => updateConfigValue(field, e.target.value)}
                              rows={field.rows || 4}
                            />
                            {field.description ? <p className="text-xs text-muted-foreground">{field.description}</p> : null}
                          </div>
                        );
                      }

                      return (
                        <div key={field.key} className="space-y-1">
                          <div className="text-sm">{field.label}</div>
                          <Input
                            placeholder={field.placeholder || field.label}
                            value={String(fieldValue ?? "")}
                            onChange={(e) => updateConfigValue(field, e.target.value)}
                          />
                          {field.description ? <p className="text-xs text-muted-foreground">{field.description}</p> : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">This tool has no configurable fields.</p>
                )}
              </div>

              <Button className="w-full" onClick={saveSkill} disabled={!isValid()}>
                {editingSkillId ? "Save Changes" : "Create Skill"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {skills.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="glass-card p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-3">
                  <AgentAvatar
                    agent={{ ...s, avatar: s.avatar || s.name?.slice(0, 1).toUpperCase() || "S" }}
                    className="w-10 h-10"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {s.third_party ? s.third_party : s.kind}
                    </div>
                    {s.description ? (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{s.description}</p>
                    ) : null}
                    {getConfigVariableNames(s.config).length ? (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        Variables: {getConfigVariableNames(s.config).join(", ")}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <Badge variant="secondary" className="text-[10px]">{s.kind}</Badge>
                      {s.tool_name ? <Badge variant="secondary" className="text-[10px]">{s.tool_name}</Badge> : null}
                      {s.kind === "custom-js" ? <Badge variant="secondary" className="text-[10px]">code</Badge> : null}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEditDialog(s)} aria-label={`Edit ${s.name}`}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteSkill(s.id)} aria-label={`Delete ${s.name}`}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
