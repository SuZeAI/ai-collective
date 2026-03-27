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
import { api, type Skill } from "@/lib/api";

type ToolName = string;
type AvatarMode = "initial" | "icon" | "image";
type ToolPreset = { toolName: ToolName; label: string; thirdParty: string };

const fallbackToolPresets: ToolPreset[] = [
  { toolName: "websearch", label: "Web Search (DuckDuckGo)", thirdParty: "Web" },
  { toolName: "browser", label: "Browser Automation", thirdParty: "Browser" },
  { toolName: "bash", label: "Shell Automation", thirdParty: "Shell" },
  { toolName: "youtube", label: "YouTube Search (yt-dlp)", thirdParty: "YouTube" },
  { toolName: "xiaohongshu", label: "Xiaohongshu Search", thirdParty: "Xiaohongshu" },
  { toolName: "promt_tool", label: "Prompt Tool", thirdParty: "Prompt" },
];

function toTitleCaseFromToolName(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function toToolPreset(toolName: string): ToolPreset {
  const fromFallback = fallbackToolPresets.find((preset) => preset.toolName === toolName);
  if (fromFallback) return fromFallback;

  const title = toTitleCaseFromToolName(toolName);
  return {
    toolName,
    label: title,
    thirdParty: title,
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

export default function Skills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [toolPresets, setToolPresets] = useState<ToolPreset[]>(fallbackToolPresets);
  const [open, setOpen] = useState(false);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);

  const [toolName, setToolName] = useState<ToolName>(fallbackToolPresets[0]?.toolName ?? "websearch");
  const selectedPreset = useMemo(
    () => toolPresets.find((p) => p.toolName === toolName) ?? toToolPreset(toolName),
    [toolName],
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarMode, setAvatarMode] = useState<AvatarMode>("initial");
  const [avatarIcon, setAvatarIcon] = useState("wrench");
  const [avatarColor, setAvatarColor] = useState("#3b82f6");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [webProvider, setWebProvider] = useState("duckduckgo");
  const [webRegion, setWebRegion] = useState("wt-wt");
  const [webSafeSearch, setWebSafeSearch] = useState("moderate");

  const [browserDriver, setBrowserDriver] = useState("browser_use");
  const [browserCdpUrl, setBrowserCdpUrl] = useState("http://localhost:9222");
  const [browserRequiresRuntime, setBrowserRequiresRuntime] = useState(true);

  const [bashSandbox, setBashSandbox] = useState("default");
  const [bashRequiresRuntime, setBashRequiresRuntime] = useState(true);

  const [youtubeDepth, setYoutubeDepth] = useState("default");

  const [xiaohongshuBaseUrl, setXiaohongshuBaseUrl] = useState("");
  const [xiaohongshuDepth, setXiaohongshuDepth] = useState("default");

  const [promptSystemPrompt, setPromptSystemPrompt] = useState("");

  const applyDefaultConfigByTool = (value: ToolName) => {
    if (value === "websearch") {
      setWebProvider("duckduckgo");
      setWebRegion("wt-wt");
      setWebSafeSearch("moderate");
      return;
    }

    if (value === "browser") {
      setBrowserDriver("browser_use");
      setBrowserCdpUrl("http://localhost:9222");
      setBrowserRequiresRuntime(true);
      return;
    }

    if (value === "youtube") {
      setYoutubeDepth("default");
      return;
    }

    if (value === "xiaohongshu") {
      setXiaohongshuBaseUrl("");
      setXiaohongshuDepth("default");
      return;
    }

    if (value === "promt_tool") {
      setPromptSystemPrompt("");
      return;
    }

    if (value === "bash") {
      setBashSandbox("default");
      setBashRequiresRuntime(true);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, backendTools] = await Promise.all([
          api.listSkills(),
          api.listSkillTools(),
        ]);
        if (cancelled) return;

        setSkills(list);

        const normalizedTools = Array.from(
          new Set(
            backendTools
              .map((tool) => String(tool || "").trim())
              .filter((tool) => tool.length > 0),
          ),
        );

        if (normalizedTools.length > 0) {
          const backendPresets = normalizedTools.map(toToolPreset);
          setToolPresets(backendPresets);
          setToolName((current) => (normalizedTools.includes(current) ? current : normalizedTools[0]));
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
    setName(selectedPreset?.label ?? "");
    applyDefaultConfigByTool(toolName);
  }, [selectedPreset, editingSkillId, toolName]);

  const resetForm = () => {
    const defaultPreset = toolPresets[0] ?? fallbackToolPresets[0];
    setEditingSkillId(null);
    setToolName(defaultPreset?.toolName ?? "websearch");
    setName(defaultPreset?.label ?? "");
    setDescription("");
    setAvatarMode("initial");
    setAvatarIcon("wrench");
    setAvatarColor("#3b82f6");
    setAvatarUrl("");
    applyDefaultConfigByTool(defaultPreset?.toolName ?? "websearch");
  };

  const openCreateDialog = () => {
    resetForm();
    setOpen(true);
  };

  const openEditDialog = (skill: Skill) => {
    setEditingSkillId(skill.id);
    const inferredToolName: ToolName = (skill.tool_name || "").trim()
      ? String(skill.tool_name)
      : skill.third_party === "Browser"
        ? "browser"
        : skill.third_party === "Shell"
          ? "bash"
          : skill.third_party === "YouTube"
            ? "youtube"
            : skill.third_party === "Xiaohongshu"
              ? "xiaohongshu"
          : skill.third_party === "Prompt"
            ? "promt_tool"
          : "websearch";

    setToolName(inferredToolName);
    setName(skill.name ?? "");
    setDescription(skill.description ?? "");
    setAvatarMode(skill.avatar_url ? "image" : skill.avatar_icon ? "icon" : "initial");
    setAvatarIcon(skill.avatar_icon || "wrench");
    setAvatarColor(isHexColor(skill.avatar_color || "") ? (skill.avatar_color as string) : "#3b82f6");
    setAvatarUrl(skill.avatar_url || "");

    const config = (skill.config as Record<string, unknown> | undefined) ?? {};
    if (inferredToolName === "websearch") {
      setWebProvider(String(config.provider ?? "duckduckgo"));
      setWebRegion(String(config.region ?? "wt-wt"));
      setWebSafeSearch(String(config.safesearch ?? "moderate"));
    }
    if (inferredToolName === "browser") {
      setBrowserDriver(String(config.driver ?? "browser_use"));
      setBrowserCdpUrl(String(config.cdp_url ?? "http://localhost:9222"));
      setBrowserRequiresRuntime(boolFromUnknown(config.requires_runtime, true));
    }
    if (inferredToolName === "bash") {
      setBashSandbox(String(config.sandbox ?? "default"));
      setBashRequiresRuntime(boolFromUnknown(config.requires_runtime, true));
    }
    if (inferredToolName === "youtube") {
      setYoutubeDepth(String(config.depth ?? "default"));
    }
    if (inferredToolName === "xiaohongshu") {
      setXiaohongshuBaseUrl(String(config.base_url ?? ""));
      setXiaohongshuDepth(String(config.depth ?? "default"));
    }
    if (inferredToolName === "promt_tool") {
      setPromptSystemPrompt(String(config.system_prompt ?? ""));
    }

    setOpen(true);
  };

  const buildConfig = (): Record<string, unknown> => {
    if (toolName === "websearch") {
      return {
        provider: webProvider.trim(),
        region: webRegion.trim(),
        safesearch: webSafeSearch.trim(),
      };
    }

    if (toolName === "browser") {
      return {
        driver: browserDriver.trim(),
        cdp_url: browserCdpUrl.trim(),
        requires_runtime: browserRequiresRuntime,
      };
    }

    if (toolName === "promt_tool") {
      return {
        system_prompt: promptSystemPrompt.trim(),
      };
    }

    if (toolName === "youtube") {
      return {
        depth: youtubeDepth.trim(),
      };
    }
    if (toolName === "xiaohongshu") {
      return {
        base_url: xiaohongshuBaseUrl.trim(),
        depth: xiaohongshuDepth.trim(),
      };
    }
    if (toolName === "bash") {
      return {
        sandbox: bashSandbox.trim(),
        requires_runtime: bashRequiresRuntime,
      };
    }

    return {};
  };

  const isValid = (): boolean => {
    if (!name.trim()) return false;
    if (!toolName.trim()) return false;

    if (toolName === "websearch") {
      return !!webProvider.trim() && !!webRegion.trim() && !!webSafeSearch.trim();
    }
    if (toolName === "browser") {
      return !!browserDriver.trim() && !!browserCdpUrl.trim();
    }
    if (toolName === "promt_tool") {
      return !!promptSystemPrompt.trim();
    }
    if (toolName === "youtube") {
      return !!youtubeDepth.trim();
    }
    if (toolName === "xiaohongshu") {
      return !!xiaohongshuDepth.trim();
    }
    if (toolName === "bash") {
      return !!bashSandbox.trim();
    }

    return true;
  };

  const saveSkill = async () => {
    if (!isValid()) return;

    const config = buildConfig();

    try {
      const saved = await api.upsertSkill({
        id: editingSkillId ?? undefined,
        name: name.trim(),
        description: description.trim(),
        kind: "integration",
        third_party: selectedPreset?.thirdParty ?? toTitleCaseFromToolName(toolName),
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
              <Select value={toolName} onValueChange={setToolName}>
                <SelectTrigger><SelectValue placeholder="Preset" /></SelectTrigger>
                <SelectContent>
                  {toolPresets.map((p) => (
                    <SelectItem key={p.toolName} value={p.toolName}>{p.label}</SelectItem>
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

                {toolName === "websearch" ? (
                  <div className="grid grid-cols-1 gap-2">
                    <Input placeholder="Provider" value={webProvider} onChange={(e) => setWebProvider(e.target.value)} />
                    <Input placeholder="Region (e.g. wt-wt, us-en)" value={webRegion} onChange={(e) => setWebRegion(e.target.value)} />
                    <Select value={webSafeSearch} onValueChange={setWebSafeSearch}>
                      <SelectTrigger><SelectValue placeholder="SafeSearch" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="off">off</SelectItem>
                        <SelectItem value="moderate">moderate</SelectItem>
                        <SelectItem value="strict">strict</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {toolName === "browser" ? (
                  <div className="grid grid-cols-1 gap-2">
                    <Input placeholder="Driver" value={browserDriver} onChange={(e) => setBrowserDriver(e.target.value)} />
                    <Input placeholder="CDP URL" value={browserCdpUrl} onChange={(e) => setBrowserCdpUrl(e.target.value)} />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={browserRequiresRuntime}
                        onChange={(e) => setBrowserRequiresRuntime(e.target.checked)}
                      />
                      Requires Runtime
                    </label>
                  </div>
                ) : null}

                {toolName === "bash" ? (
                  <div className="grid grid-cols-1 gap-2">
                    <Input placeholder="Sandbox" value={bashSandbox} onChange={(e) => setBashSandbox(e.target.value)} />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={bashRequiresRuntime}
                        onChange={(e) => setBashRequiresRuntime(e.target.checked)}
                      />
                      Requires Runtime
                    </label>
                  </div>
                ) : null}

                {toolName === "youtube" ? (
                  <div className="grid grid-cols-1 gap-2">
                    <Select value={youtubeDepth} onValueChange={setYoutubeDepth}>
                      <SelectTrigger><SelectValue placeholder="Search depth" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quick">quick</SelectItem>
                        <SelectItem value="default">default</SelectItem>
                        <SelectItem value="deep">deep</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {toolName === "xiaohongshu" ? (
                  <div className="grid grid-cols-1 gap-2">
                    <Input
                      placeholder="API Base URL (optional, fallback to XIAOHONGSHU_API_BASE_URL)"
                      value={xiaohongshuBaseUrl}
                      onChange={(e) => setXiaohongshuBaseUrl(e.target.value)}
                    />
                    <Select value={xiaohongshuDepth} onValueChange={setXiaohongshuDepth}>
                      <SelectTrigger><SelectValue placeholder="Search depth" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quick">quick</SelectItem>
                        <SelectItem value="default">default</SelectItem>
                        <SelectItem value="deep">deep</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {toolName === "promt_tool" ? (
                  <div className="grid grid-cols-1 gap-2">
                    <Textarea
                      placeholder="System prompt"
                      value={promptSystemPrompt}
                      onChange={(e) => setPromptSystemPrompt(e.target.value)}
                      rows={6}
                    />
                  </div>
                ) : null}
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
