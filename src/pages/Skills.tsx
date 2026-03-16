import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api, type Skill } from "@/lib/api";

type AuthType = "service-account" | "oauth" | "api-key";

const presets = [
  { label: "Google Sheets", thirdParty: "Google Sheets" },
  { label: "Google Docs", thirdParty: "Google Docs" },
  { label: "Web Search", thirdParty: "Web" },
  { label: "Custom Integration", thirdParty: "" },
];

export default function Skills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [open, setOpen] = useState(false);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);

  const [preset, setPreset] = useState(presets[0]?.label ?? "Google Sheets");
  const selectedPreset = useMemo(() => presets.find((p) => p.label === preset) ?? presets[0], [preset]);

  const [name, setName] = useState("");

  // auth fields saved under config.auth
  const [authType, setAuthType] = useState<AuthType>("service-account");
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [oauthRefreshToken, setOauthRefreshToken] = useState("");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listSkills();
        if (!cancelled) setSkills(list);
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
    const sp = selectedPreset;
    setName(sp?.label === "Custom Integration" ? "" : (sp?.label ?? ""));

    // reset auth defaults by preset
    if (sp?.label === "Web Search") {
      setAuthType("api-key");
    } else {
      setAuthType("service-account");
    }

    setServiceAccountJson("");
    setOauthClientId("");
    setOauthClientSecret("");
    setOauthRefreshToken("");
    setApiKey("");
  }, [selectedPreset, editingSkillId]);

  const resetForm = () => {
    setEditingSkillId(null);
    setPreset(presets[0]?.label ?? "Google Sheets");
    setName("");
    setAuthType("service-account");
    setServiceAccountJson("");
    setOauthClientId("");
    setOauthClientSecret("");
    setOauthRefreshToken("");
    setApiKey("");
  };

  const openCreateDialog = () => {
    resetForm();
    setOpen(true);
  };

  const openEditDialog = (skill: Skill) => {
    setEditingSkillId(skill.id);
    const matchedPreset = presets.find((p) => p.thirdParty === skill.third_party) ?? presets[presets.length - 1];
    setPreset(matchedPreset?.label ?? "Custom Integration");
    setName(skill.name ?? "");

    const auth = (skill.config?.auth as Record<string, unknown> | undefined) ?? {};
    const authKind = String(auth.type ?? "service-account") as AuthType;
    setAuthType(authKind);
    setServiceAccountJson(String(auth.service_account_json ?? ""));
    setOauthClientId(String(auth.client_id ?? ""));
    setOauthClientSecret(String(auth.client_secret ?? ""));
    setOauthRefreshToken(String(auth.refresh_token ?? ""));
    setApiKey(String(auth.api_key ?? ""));
    setOpen(true);
  };

  const buildAuth = (): Record<string, unknown> | null => {
    if (selectedPreset?.label === "Web Search") {
      return { type: "api-key", provider: "Tavily", api_key: apiKey.trim() };
    }

    if (authType === "service-account") {
      return { type: "service-account", service_account_json: serviceAccountJson.trim() };
    }

    if (authType === "oauth") {
      return {
        type: "oauth",
        client_id: oauthClientId.trim(),
        client_secret: oauthClientSecret.trim(),
        refresh_token: oauthRefreshToken.trim(),
      };
    }

    if (authType === "api-key") {
      return { type: "api-key", api_key: apiKey.trim() };
    }

    return { type: authType };
  };

  const isValid = (): boolean => {
    if (!name.trim()) return false;

    if (selectedPreset?.label === "Web Search") return !!apiKey.trim();
    if (authType === "service-account") return !!serviceAccountJson.trim();
    if (authType === "oauth") return !!oauthClientId.trim() && !!oauthClientSecret.trim() && !!oauthRefreshToken.trim();
    if (authType === "api-key") return !!apiKey.trim();

    return true;
  };

  const saveSkill = async () => {
    if (!isValid()) return;

    const auth = buildAuth();
    const config: Record<string, unknown> = {};
    if (auth) config.auth = auth;

    try {
      const saved = await api.upsertSkill({
        id: editingSkillId ?? undefined,
        name: name.trim(),
        kind: "integration",
        third_party: selectedPreset?.thirdParty ?? "",
        config,
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
              <Select value={preset} onValueChange={setPreset}>
                <SelectTrigger><SelectValue placeholder="Preset" /></SelectTrigger>
                <SelectContent>
                  {presets.map((p) => (
                    <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input placeholder="Skill name" value={name} onChange={(e) => setName(e.target.value)} />

              <div className="rounded-md border p-3 space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Authentication</div>

                {selectedPreset?.label === "Web Search" ? (
                  <Input placeholder="API Key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                ) : (
                  <>
                    <Select value={authType} onValueChange={(v) => setAuthType(v as AuthType)}>
                      <SelectTrigger><SelectValue placeholder="Auth type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="service-account">Service Account JSON</SelectItem>
                        <SelectItem value="oauth">OAuth (Client + Refresh Token)</SelectItem>
                        <SelectItem value="api-key">API Key</SelectItem>
                      </SelectContent>
                    </Select>

                    {authType === "service-account" ? (
                      <Textarea
                        placeholder="Service Account JSON"
                        value={serviceAccountJson}
                        onChange={(e) => setServiceAccountJson(e.target.value)}
                        className="min-h-[110px] font-mono"
                      />
                    ) : null}

                    {authType === "oauth" ? (
                      <div className="grid grid-cols-1 gap-2">
                        <Input placeholder="OAuth Client ID" value={oauthClientId} onChange={(e) => setOauthClientId(e.target.value)} />
                        <Input placeholder="OAuth Client Secret" type="password" value={oauthClientSecret} onChange={(e) => setOauthClientSecret(e.target.value)} />
                        <Input placeholder="OAuth Refresh Token" type="password" value={oauthRefreshToken} onChange={(e) => setOauthRefreshToken(e.target.value)} />
                      </div>
                    ) : null}

                    {authType === "api-key" ? (
                      <Input placeholder="API Key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                    ) : null}
                  </>
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
              <div className="min-w-0">
                <div className="font-bold truncate">{s.name}</div>
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  {s.third_party ? s.third_party : s.kind}
                </div>
                {s.description ? (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{s.description}</p>
                ) : null}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <Badge variant="secondary" className="text-[10px]">{s.kind}</Badge>
                  {s.config?.auth ? <Badge variant="secondary" className="text-[10px]">auth</Badge> : null}
                  {s.kind === "custom-js" ? <Badge variant="secondary" className="text-[10px]">code</Badge> : null}
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
