import { useEffect, useRef, useState, useCallback } from "react";
import { Paperclip, Download, Loader2, FileText, FolderOpen } from "lucide-react";
import { api, saveBlob, type MeetingFile, type LibraryDocument } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ACCEPT_ATTR = ".txt,.md,.csv,.json,.pdf,.zip,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp";
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Compact attach + file-chip widget for a meeting (Project / direct chat).
 * Self-contained: lists the chat's files, uploads new ones, downloads on click,
 * and (when a Business Unit is active) attaches a document from its library.
 */
export function MeetingFiles({ taskId, companyId }: { taskId: string; companyId?: string | null }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<MeetingFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [libraryDocs, setLibraryDocs] = useState<LibraryDocument[]>([]);

  const refresh = useCallback(() => {
    if (!taskId) return;
    api.listMeetingFiles(taskId).then(setFiles).catch(() => { /* chat may have no files yet */ });
  }, [taskId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (companyId) api.listDocuments(companyId).then(setLibraryDocs).catch(() => setLibraryDocs([]));
    else setLibraryDocs([]);
  }, [companyId]);

  const upload = async (fileList: FileList | null) => {
    if (!fileList || !taskId) return;
    setBusy(true);
    try {
      for (const file of Array.from(fileList)) {
        if (file.size > MAX_BYTES) {
          toast({ title: `"${file.name}" > 25 MB`, variant: "destructive" });
          continue;
        }
        await api.uploadMeetingFile(taskId, file);
      }
      toast({ title: t.documentLibrary.uploadSuccess });
      refresh();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const download = async (f: MeetingFile) => {
    try {
      const blob = await api.downloadMeetingFile(taskId, f.relPath);
      saveBlob(blob, f.filename);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const attachFromLibrary = async (doc: LibraryDocument) => {
    setBusy(true);
    try {
      await api.attachDocumentToProject(doc.id, taskId);
      toast({ title: t.documentLibrary.attachSuccess });
      refresh();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={busy || !taskId}
        onClick={() => inputRef.current?.click()}
        title={t.documentLibrary.upload}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
      </button>

      {companyId && libraryDocs.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={busy}
              title={t.documentLibrary.attachToProject}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors disabled:opacity-50"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto w-60">
            {libraryDocs.map((d) => (
              <DropdownMenuItem key={d.id} onClick={() => attachFromLibrary(d)} className="text-xs gap-2">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{d.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {files.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => download(f)}
          title={`${f.filename} · ${t.documentLibrary.download}`}
          className="inline-flex items-center gap-1 rounded-full bg-accent/50 hover:bg-accent px-2 py-1 text-xs text-foreground/80 max-w-[180px] transition-colors"
        >
          <FileText className="w-3 h-3 shrink-0" />
          <span className="truncate">{f.filename}</span>
          <Download className="w-3 h-3 shrink-0 opacity-60" />
        </button>
      ))}

      <input ref={inputRef} type="file" accept={ACCEPT_ATTR} multiple hidden onChange={(e) => void upload(e.target.files)} />
    </div>
  );
}
