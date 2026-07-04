import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText, FileSpreadsheet, Image as ImageIcon, Link2, File as FileIcon,
  Download, Trash2, Loader2, FolderOpen, Plus, Link as LinkIcon, Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DocumentDropzone } from "@/components/DocumentDropzone";
import { api, saveBlob, type LibraryDocument, type Task } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWorkspaceScope, CATALOG_WORKSPACE_ID } from "@/hooks/use-workspace-scope";

type DocType = "all" | "pdf" | "excel" | "doc" | "image" | "link" | "other";

function classify(d: LibraryDocument): Exclude<DocType, "all"> {
  if (d.source === "url") return "link";
  const ct = (d.contentType || "").toLowerCase();
  const name = d.name.toLowerCase();
  if (ct.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (ct.includes("spreadsheet") || ct.includes("excel") || /\.(xlsx?|csv)$/.test(name)) return "excel";
  if (ct.startsWith("image/")) return "image";
  if (ct.includes("word") || /\.(docx?|txt|md|json)$/.test(name)) return "doc";
  return "other";
}

const TYPE_ICON: Record<Exclude<DocType, "all">, React.ElementType> = {
  pdf: FileText, excel: FileSpreadsheet, image: ImageIcon, doc: FileIcon, link: Link2, other: FileIcon,
};

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function DocumentLibrary() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const scope = useWorkspaceScope();
  const tl = t.documentLibrary;
  // In the "All" scope (admin-only here), the page edits the shared "default"
  // document catalog instead of a single office's library.
  const workspaceId = scope.workspace?.id ?? (scope.isOverall ? CATALOG_WORKSPACE_ID : null);

  const [docs, setDocs] = useState<LibraryDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<DocType>("all");
  const [busy, setBusy] = useState(false);

  // dialogs
  const [uploadOpen, setUploadOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [attachDoc, setAttachDoc] = useState<LibraryDocument | null>(null);
  const [attachTaskId, setAttachTaskId] = useState<string>("");
  const [tasks, setTasks] = useState<Task[]>([]);

  const refresh = () => {
    // Office membership is still resolving: workspaceId is momentarily null
    // even for a company scope (not yet "Overall"). Wait rather than flashing
    // the "no documents" empty state for a company that does have docs.
    if (!scope.isOverall && !scope.ready) return;
    if (!workspaceId) { setDocs([]); return; }
    setLoading(true);
    api.listDocuments(workspaceId)
      .then(setDocs)
      .catch((e) => toast({ title: e instanceof Error ? e.message : String(e), variant: "destructive" }))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, [workspaceId, scope.isOverall, scope.ready]);

  // Combined with the effect's early-return above so the skeleton spinner
  // (rather than the empty state) shows while scope is still resolving.
  const effectiveLoading = loading || (!scope.isOverall && !scope.ready);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (tab !== "all" && classify(d) !== tab) return false;
      if (q && !`${d.name} ${d.description} ${d.tags.join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [docs, search, tab]);

  const onUpload = async (file: File) => {
    if (!workspaceId) return;
    setBusy(true);
    try {
      await api.uploadDocument(workspaceId, file);
      toast({ title: tl.uploadSuccess });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const onIngestUrl = async () => {
    if (!workspaceId || !url.trim()) return;
    setBusy(true);
    try {
      await api.ingestUrl({ workspaceId, url: url.trim() });
      toast({ title: tl.uploadSuccess });
      setUrl("");
      setUrlOpen(false);
      refresh();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async (d: LibraryDocument) => {
    try {
      const blob = await api.downloadDocument(d.id);
      saveBlob(blob, d.name);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const onDelete = async (d: LibraryDocument) => {
    if (!window.confirm(tl.deleteConfirm)) return;
    try {
      await api.deleteDocument(d.id);
      toast({ title: tl.deleteSuccess });
      setDocs((prev) => prev.filter((x) => x.id !== d.id));
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const openAttach = async (d: LibraryDocument) => {
    setAttachDoc(d);
    setAttachTaskId("");
    try {
      setTasks(await api.listTasks());
    } catch { setTasks([]); }
  };

  const confirmAttach = async () => {
    if (!attachDoc || !attachTaskId) return;
    setBusy(true);
    try {
      await api.attachDocumentToProject(attachDoc.id, attachTaskId);
      toast({ title: tl.attachSuccess });
      setAttachDoc(null);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const TABS: DocType[] = ["all", "pdf", "excel", "doc", "image", "link", "other"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-md shadow-teal-500/20">
            <FolderOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{tl.title}</h1>
            <p className="text-sm text-muted-foreground">{tl.subtitle}</p>
          </div>
        </div>
        {workspaceId && (
          <div className="flex items-center gap-2">
            <Dialog open={urlOpen} onOpenChange={setUrlOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><LinkIcon className="w-4 h-4 mr-1.5" />{tl.addFromUrl}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{tl.addFromUrl}</DialogTitle></DialogHeader>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={tl.urlPlaceholder} />
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setUrlOpen(false)}>{tl.cancel}</Button>
                  <Button onClick={onIngestUrl} disabled={busy || !url.trim()}>
                    {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
                    {tl.add}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Paperclip className="w-4 h-4 mr-1.5" />{tl.upload}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{tl.upload}</DialogTitle></DialogHeader>
                <DocumentDropzone onFile={onUpload} hint={tl.dropHint} busy={busy} />
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {!workspaceId ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          {tl.overallScopeHint}
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tl.search} className="sm:max-w-xs" />
            <Tabs value={tab} onValueChange={(v) => setTab(v as DocType)}>
              <TabsList className="flex-wrap h-auto">
                {TABS.map((tb) => (
                  <TabsTrigger key={tb} value={tb} className="text-xs">
                    {tb === "all" ? tl.all : tl.types[tb]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {effectiveLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-16 text-center">
              <p className="font-semibold">{tl.empty}</p>
              <p className="text-sm text-muted-foreground mt-1">{tl.emptyHint}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((d, i) => {
                const kind = classify(d);
                const Icon = TYPE_ICON[kind];
                return (
                  <motion.div
                    key={d.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.2) }}
                    className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-accent/60 flex items-center justify-center shrink-0">
                        <Icon className="w-4.5 h-4.5 text-foreground/70" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate" title={d.name}>{d.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {tl.types[kind]} · {formatSize(d.size)}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{tl.types[kind]}</Badge>
                    </div>
                    {d.description && <p className="text-xs text-muted-foreground line-clamp-2">{d.description}</p>}
                    {d.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {d.tags.map((tag) => <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>)}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mt-auto pt-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onDownload(d)}>
                        <Download className="w-3.5 h-3.5 mr-1" />{tl.download}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openAttach(d)}>
                        <Paperclip className="w-3.5 h-3.5 mr-1" />{tl.attachToProject}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 ml-auto text-destructive hover:text-destructive" onClick={() => onDelete(d)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Dialog open={!!attachDoc} onOpenChange={(o) => !o && setAttachDoc(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tl.attachToProject}</DialogTitle></DialogHeader>
          <Select value={attachTaskId} onValueChange={setAttachTaskId}>
            <SelectTrigger><SelectValue placeholder={tl.selectProject} /></SelectTrigger>
            <SelectContent>
              {tasks.map((task) => <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAttachDoc(null)}>{tl.cancel}</Button>
            <Button onClick={confirmAttach} disabled={busy || !attachTaskId}>
              {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Paperclip className="w-4 h-4 mr-1.5" />}
              {tl.attach}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
