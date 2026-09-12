import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Pencil, Plus, ShieldCheck, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { StaffAvatar, skillAvatarIconOptions } from "@/components/StaffAvatar";
import { api, canDeleteItem, canEditItem, type Skill, type SkillToolConfigField, type SkillToolPreset, type DeleteImpact } from "@/lib/api";
import { useCompanyScope, CATALOG_COMPANY_ID } from "@/hooks/use-company-scope";
import { useToast } from "@/hooks/use-toast";

type ToolName = string;
type AvatarMode = "initial" | "icon" | "image";
type ToolConfigValue = string | boolean;

const GOOGLE_TOOL_NAMES = new Set(["sheet", "drive", "docs", "slides", "calendar"]);

type GoogleAuthConfig = {
  auth_email: string;
  token_path: string;
  credentials_path: string;
  service_account_path: string;
};

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

// Memoized so retyping in the preset-search box only re-renders rows whose
// membership in the filtered list actually changed, not every row on every
// keystroke — same pattern as KanbanCard/StaffCard/PlanStats elsewhere.
const PresetSuggestionRow = memo(function PresetSuggestionRow({
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

function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

function sanitizeEmailForTokenPath(email: string): string {
  const normalized = String(email || "").trim().toLowerCase();
  const safe = normalized.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe || "default";
}

function ensureGoogleAuthConfig(
  config: Record<string, unknown>,
  toolName: string,
  oauthAuthEmail: string,
  oauthTokenPath: string,
  oauthCredentialsPath: string,
  oauthServiceAccountPath: string,
): Record<string, unknown> {
  if (!GOOGLE_TOOL_NAMES.has(toolName)) {
    return config;
  }

  const authEmail = String(oauthAuthEmail || config.auth_email || "").trim();
  const fallbackTokenPath = `secrets/google/${toolName}/token_${sanitizeEmailForTokenPath(authEmail)}.json`;
  const tokenPath = String(oauthTokenPath || config.token_path || fallbackTokenPath).trim();
  const credentialsPath = String(oauthCredentialsPath || config.credentials_path || "").trim();
  const serviceAccountPath = String(oauthServiceAccountPath || config.service_account_path || "").trim();

  const googleAuthConfig: GoogleAuthConfig = {
    auth_email: authEmail,
    token_path: tokenPath,
    credentials_path: credentialsPath,
    service_account_path: serviceAccountPath,
  };

  return {
    ...config,
    ...googleAuthConfig,
  };
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
  const scope = useCompanyScope();
  const { toast } = useToast();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [toolPresets, setToolPresets] = useState<SkillToolPreset[]>([]);
  const [open, setOpen] = useState(false);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);

  const [toolName, setToolName] = useState<ToolName>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instruction, setInstruction] = useState("");
  const [configValues, setConfigValues] = useState<Record<string, ToolConfigValue>>({});

  const [avatarMode, setAvatarMode] = useState<AvatarMode>("initial");
  const [avatarIcon, setAvatarIcon] = useState("wrench");
  const [avatarColor, setAvatarColor] = useState("#3b82f6");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [oauthUrl, setOauthUrl] = useState("");
  const [oauthState, setOauthState] = useState("");
  const [oauthStatus, setOauthStatus] = useState<"idle" | "pending" | "authorized" | "error">("idle");
  const [oauthMessage, setOauthMessage] = useState("");
  const [oauthAuthEmail, setOauthAuthEmail] = useState("");
  const [oauthTokenPath, setOauthTokenPath] = useState("");
  const [oauthCredentialsPath, setOauthCredentialsPath] = useState("");
  const [oauthServiceAccountPath, setOauthServiceAccountPath] = useState("");
  const pollRef = useRef<number | null>(null);
  // Bumped whenever the open form changes (create/edit/reset) so a still-running
  // poll from a previous skill's OAuth flow can't write its result into a
  // different, currently-open form.
  const oauthSessionRef = useRef(0);

  const presetByTool = useMemo(() => {
    return new Map(toolPresets.map((preset) => [preset.tool_name, preset]));
  }, [toolPresets]);

  const [showPresetSuggestions, setShowPresetSuggestions] = useState(false);
  const [presetSearch, setPresetSearch] = useState("");

  const filteredPresets = useMemo(() => {
    const term = presetSearch.trim().toLowerCase();
    if (!term) return toolPresets;
    return toolPresets.filter(
      (p) =>
        p.label.toLowerCase().includes(term) ||
        p.tool_name.toLowerCase().includes(term)
    );
  }, [toolPresets, presetSearch]);

  const selectedPreset = useMemo(() => {
    if (!toolName) return null;
    return presetByTool.get(toolName) ?? toToolPreset(toolName);
  }, [presetByTool, toolName]);

  useEffect(() => {
    if (selectedPreset) {
      setPresetSearch(selectedPreset.label || "");
    }
  }, [selectedPreset]);

  const handleToolChange = useCallback((nextToolName: ToolName) => {
    setToolName(nextToolName);
    const nextPreset = presetByTool.get(nextToolName) ?? toToolPreset(nextToolName);
    setConfigValues(buildDefaultConfigValues(nextPreset));
    if (!editingSkillId) {
      setName(nextPreset.label || "");
    }
  }, [presetByTool, editingSkillId]);

  const handlePresetSelect = useCallback((p: SkillToolPreset) => {
    handleToolChange(p.tool_name);
    setPresetSearch(p.label);
    setShowPresetSuggestions(false);
  }, [handleToolChange]);

  const companyId = scope.isOverall ? CATALOG_COMPANY_ID : scope.company?.id;

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const [list, backendPresets] = await Promise.all([
          api.listSkills(companyId),
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
  }, [companyId]);

  useEffect(() => {
    if (editingSkillId) return;
    if (!selectedPreset) return;
    setName(selectedPreset.label || "");
    setConfigValues(buildDefaultConfigValues(selectedPreset));
  }, [selectedPreset, editingSkillId]);

  const resetForm = () => {
    oauthSessionRef.current += 1;
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setAuthDialogOpen(false);
    const defaultPreset = toolPresets[0];
    setEditingSkillId(null);
    setToolName(defaultPreset?.tool_name ?? "");
    setName(defaultPreset?.label ?? "");
    setDescription("");
    setInstruction("");
    setConfigValues(buildDefaultConfigValues(defaultPreset));
    setAvatarMode("initial");
    setAvatarIcon("wrench");
    setAvatarColor("#3b82f6");
    setAvatarUrl("");
    setOauthUrl("");
    setOauthState("");
    setOauthStatus("idle");
    setOauthMessage("");
    setOauthAuthEmail("");
    setOauthTokenPath("");
    setOauthCredentialsPath("");
    setOauthServiceAccountPath("");
  };

  useEffect(() => {
    return () => {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
      }
    };
  }, []);

  const startOAuthPolling = (state: string) => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }

    const session = oauthSessionRef.current;
    const startedAt = Date.now();
    pollRef.current = window.setInterval(async () => {
      // The form was reset/switched since this flow started (e.g. the user
      // opened a different skill for editing) — stop polling and discard.
      if (oauthSessionRef.current !== session) {
        if (pollRef.current !== null) {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
        }
        return;
      }
      try {
        const status = await api.getSheetOAuthStatus(state);
        if (oauthSessionRef.current !== session) {
          if (pollRef.current !== null) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
          }
          return;
        }
        if (status.status === "authorized") {
          setOauthStatus("authorized");
          setOauthAuthEmail(status.email || "");
          setOauthTokenPath(status.token_path || "");
          setOauthMessage(
            status.email
              ? `Authorized: ${status.email}. Token saved at ${status.token_path}.`
              : `Authorization successful. Token saved at ${status.token_path}.`,
          );
          if (pollRef.current !== null) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
          }
          // Close dialog after 1.5 seconds to show success message
          setTimeout(() => setAuthDialogOpen(false), 1500);
          return;
        }

        if (status.status === "error") {
          setOauthStatus("error");
          setOauthMessage(status.error || "Google authorization failed.");
          if (pollRef.current !== null) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
          }
          return;
        }

        if (Date.now() - startedAt > 10 * 60 * 1000) {
          setOauthStatus("error");
          setOauthMessage("Authorization expired. Please click Authenticate Google again.");
          if (pollRef.current !== null) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch {
        // Keep polling because callback may not have completed yet.
      }
    }, 1500);
  };

  const startGoogleSheetAuth = async () => {
    setAuthDialogOpen(true);
    setOauthStatus("pending");
    setOauthMessage("Generating authorization URL...");

    try {
      const response = await api.startSheetOAuth({
        email_hint: oauthAuthEmail.trim() || undefined,
        tool_name: toolName,
      });
      setOauthUrl(response.authorize_url);
      setOauthState(response.state);
      setOauthStatus("pending");
      setOauthMessage(
        `Browser authorization opened. Complete login in the popup window. Redirect URI: ${response.redirect_uri || "(not returned)"}`,
      );

      window.open(response.authorize_url, "google_sheet_oauth", "popup,width=540,height=760");
      startOAuthPolling(response.state);
    } catch (error) {
      setOauthStatus("error");
      setOauthMessage(error instanceof Error ? error.message : "Cannot start Google authorization.");
    }
  };

  const openCreateDialog = () => {
    resetForm();
    setOpen(true);
  };

  const openEditDialog = (skill: Skill) => {
    // Invalidate any in-flight OAuth poll from a previously-open form before
    // adopting this skill's config, so a late-arriving result can't land here.
    oauthSessionRef.current += 1;
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setAuthDialogOpen(false);
    setOauthUrl("");
    setOauthState("");
    setOauthStatus("idle");
    setOauthMessage("");

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
    setInstruction(skill.instruction ?? "");
    setConfigValues(buildConfigValuesForEdit(preset, (skill.config as Record<string, unknown> | undefined) ?? {}));

    setAvatarMode(skill.avatar_url ? "image" : skill.avatar_icon ? "icon" : "initial");
    setAvatarIcon(skill.avatar_icon || "wrench");
    setAvatarColor(isHexColor(skill.avatar_color || "") ? (skill.avatar_color as string) : "#3b82f6");
    setAvatarUrl(skill.avatar_url || "");

    const existingConfig = (skill.config as Record<string, unknown> | undefined) ?? {};
    setOauthAuthEmail(String(existingConfig.auth_email ?? ""));
    setOauthTokenPath(String(existingConfig.token_path ?? ""));
    setOauthCredentialsPath(String(existingConfig.credentials_path ?? ""));
    setOauthServiceAccountPath(String(existingConfig.service_account_path ?? ""));

    setOpen(true);
  };

  const isValid = (): boolean => {
    if (!name.trim()) return false;
    if (!toolName.trim()) return false;
    return validateRequiredConfig(selectedPreset ?? undefined, configValues);
  };

  const saveSkill = async () => {
    if (!isValid() || !companyId) return;

    const baseConfig = buildConfigFromValues(selectedPreset ?? undefined, configValues);
    const config = ensureGoogleAuthConfig(
      baseConfig,
      toolName,
      oauthAuthEmail,
      oauthTokenPath,
      oauthCredentialsPath,
      oauthServiceAccountPath,
    );

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
        instruction: instruction.trim(),
        company_id: companyId,
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
      toast({ title: "Could not save skill", description: String((e as Error).message ?? e), variant: "destructive" });
    }
  };

  const deleteSkill = async (id: string) => {
    try {
      await api.deleteSkill(id);
      setSkills((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      console.error(e);
      toast({ title: "Could not delete skill", description: String((e as Error).message ?? e), variant: "destructive" });
    }
  };

  const [pendingDelete, setPendingDelete] = useState<{ skill: Skill; impact: DeleteImpact } | null>(null);

  const requestDeleteSkill = async (skill: Skill) => {
    try {
      const impact = await api.getSkillDeleteImpact(skill.id);
      setPendingDelete({ skill, impact });
    } catch (e) {
      console.error(e);
      toast({ title: "Could not check delete impact", description: String((e as Error).message ?? e), variant: "destructive" });
    }
  };

  const updateConfigValue = (field: SkillToolConfigField, value: ToolConfigValue) => {
    setConfigValues((prev) => ({ ...prev, [field.key]: value }));
  };

  // skills is already fetched scoped to companyId, so no client-side filter is needed.
  const visibleSkills = skills;

  return (
    <div>
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Skills</h1>
          <p className="text-muted-foreground mt-1">
            {scope.company
              ? <>Skills used by personnel of office <span className="font-semibold text-foreground">{scope.company.name}</span>.</>
              : "Create reusable skills and assign them to personnel."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}><Plus className="w-4 h-4 mr-2" /> New Skill</Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto overflow-x-hidden p-6">
              <DialogHeader>
                <DialogTitle>{editingSkillId ? "Edit Skill" : "Create Skill"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6 pt-2">
                {/* Left Column: Metadata & Styling */}
                <div className="space-y-4">
                  <div className="space-y-1.5 relative">
                    <label className="text-sm font-medium">Preset Tool Type</label>
                    <div className="relative">
                      <Input
                        placeholder="Search preset tools..."
                        value={presetSearch}
                        onChange={(e) => setPresetSearch(e.target.value)}
                        onFocus={() => setShowPresetSuggestions(true)}
                        onBlur={() => {
                          setTimeout(() => {
                            setShowPresetSuggestions(false);
                            if (selectedPreset) {
                              setPresetSearch(selectedPreset.label || "");
                            }
                          }, 200);
                        }}
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground/60">
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </div>
                    {showPresetSuggestions && filteredPresets.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover/95 backdrop-blur-md text-popover-foreground shadow-lg p-1 space-y-0.5">
                        {filteredPresets.map((p) => (
                          <PresetSuggestionRow key={p.tool_name} preset={p} onSelect={handlePresetSelect} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Skill Name</label>
                    <Input placeholder="Skill name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Description</label>
                    <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Instructions</label>
                    <Textarea
                      placeholder="Explain how to use this skill — e.g. where to get the API key/token, required accounts or local setup, and how to fill in the config."
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Shown to users to explain credentials setup.
                    </p>
                  </div>

                  <div className="space-y-3 border rounded-lg p-3 bg-muted/10">
                    <div className="text-sm font-medium">Avatar Customization</div>
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

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Preview</span>
                        <StaffAvatar
                          staff={{
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
                        className="w-14 p-1 h-10 cursor-pointer"
                      />
                      <Input
                        placeholder="#3b82f6"
                        value={avatarColor}
                        onChange={(e) => setAvatarColor(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Configuration fields */}
                <div className="space-y-4">
                  <div className="rounded-lg border p-4 bg-muted/30 space-y-3 h-full flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tool Integration Config</div>
                      {selectedPreset && selectedPreset.config_fields.length > 0 ? (
                        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                          {selectedPreset.config_fields.map((field) => {
                            const fieldValue = configValues[field.key];

                            if (field.input === "select") {
                              const current = String(fieldValue ?? field.default ?? "");
                              return (
                                <div key={field.key} className="space-y-1">
                                  <div className="text-xs font-medium text-foreground">{field.label}</div>
                                  <Select value={current} onValueChange={(value) => updateConfigValue(field, value)}>
                                    <SelectTrigger><SelectValue placeholder={field.placeholder || field.label} /></SelectTrigger>
                                    <SelectContent>
                                      {(field.options || []).map((option) => (
                                        <SelectItem key={option} value={option}>{option}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {field.description ? <p className="text-[10px] text-muted-foreground leading-normal">{field.description}</p> : null}
                                </div>
                              );
                            }

                            if (field.input === "boolean") {
                              return (
                                <label key={field.key} className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer py-1">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(fieldValue)}
                                    onChange={(e) => updateConfigValue(field, e.target.checked)}
                                    className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                                  />
                                  {field.label}
                                </label>
                              );
                            }

                            if (field.input === "textarea") {
                              return (
                                <div key={field.key} className="space-y-1">
                                  <div className="text-xs font-medium text-foreground">{field.label}</div>
                                  <Textarea
                                    placeholder={field.placeholder || field.label}
                                    value={String(fieldValue ?? "")}
                                    onChange={(e) => updateConfigValue(field, e.target.value)}
                                    rows={2}
                                    className="text-xs"
                                  />
                                  {field.description ? <p className="text-[10px] text-muted-foreground leading-normal">{field.description}</p> : null}
                                </div>
                              );
                            }

                            return (
                              <div key={field.key} className="space-y-1">
                                <div className="text-xs font-medium text-foreground">{field.label}</div>
                                <Input
                                  placeholder={field.placeholder || field.label}
                                  value={String(fieldValue ?? "")}
                                  onChange={(e) => updateConfigValue(field, e.target.value)}
                                  className="h-8 text-xs"
                                />
                                {field.description ? <p className="text-[10px] text-muted-foreground leading-normal">{field.description}</p> : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground py-4">This tool integration does not require any custom configurations.</p>
                      )}
                    </div>

                    {GOOGLE_TOOL_NAMES.has(toolName) ? (
                      <div className="pt-3 border-t mt-3">
                        <Button type="button" variant="secondary" className="w-full text-xs h-9" onClick={startGoogleSheetAuth}>
                          <ShieldCheck className="w-4 h-4 mr-2 text-primary" />
                          Authenticate Google Services
                        </Button>
                        {oauthStatus === "authorized" ? (
                          <p className="text-xs font-medium text-emerald-600 mt-2">{oauthMessage}</p>
                        ) : null}
                        {oauthStatus === "error" ? (
                          <p className="text-xs font-medium text-red-600 mt-2">{oauthMessage}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t mt-4">
                <Button className="w-full" onClick={saveSkill} disabled={!isValid()}>
                  {editingSkillId ? "Save Changes" : "Create Skill"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {visibleSkills.length === 0 && scope.ready && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">
            {scope.company
              ? `No skills in use at "${scope.company.name}" yet — assign skills to its staff, or switch to Overall.`
              : "No skills yet. Create your first skill."}
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleSkills.map((s, i) => (
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
                  <StaffAvatar
                    staff={{ ...s, avatar: s.avatar || s.name?.slice(0, 1).toUpperCase() || "S" }}
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
                    {s.instruction ? (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-3 whitespace-pre-line border-l-2 border-muted pl-2">
                        {s.instruction}
                      </p>
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
                {canEditItem(s) && (
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(s)} aria-label={`Edit ${s.name}`}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
                {canDeleteItem(s) && (
                  <Button variant="ghost" size="icon" onClick={() => requestDeleteSkill(s)} aria-label={`Delete ${s.name}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Google Sheets Authorization</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Click the button below to open Google authorize page. After approving access, this dialog will auto-update.
            </p>
            <Button
              type="button"
              onClick={() => {
                if (oauthUrl) {
                  window.open(oauthUrl, "google_sheet_oauth", "popup,width=540,height=760");
                }
              }}
              disabled={!oauthUrl}
              className="w-full"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Google Authorize
            </Button>
            <div className="rounded-md bg-muted p-3 text-xs">
              <div>Status: {oauthStatus}</div>
              {oauthState ? <div className="mt-1 break-all">State: {oauthState}</div> : null}
              {oauthMessage ? <div className="mt-1">{oauthMessage}</div> : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete skill?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting <span className="font-semibold text-foreground">{pendingDelete?.skill.name}</span> will remove
              it from {pendingDelete?.impact.staff_updated} staff member(s)
              {pendingDelete?.impact.affected_companies.length
                ? ` in ${pendingDelete.impact.affected_companies.map((c) => c.name).join(", ")}`
                : ""}
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) deleteSkill(pendingDelete.skill.id);
                setPendingDelete(null);
              }}
              className="bg-rose-600 hover:bg-rose-500 text-white"
            >
              Delete skill
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
