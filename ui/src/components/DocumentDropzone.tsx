import { useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Accepted upload extensions (mirrors the backend _ALLOWED_UPLOAD_TYPES whitelist).
const ACCEPT_ATTR = ".txt,.md,.csv,.json,.pdf,.zip,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp";
const MAX_BYTES = 25 * 1024 * 1024;

type Props = {
  /** Called for each accepted file; should perform the upload and may throw on error. */
  onFile: (file: File) => Promise<void> | void;
  hint: string;
  disabled?: boolean;
  busy?: boolean;
  className?: string;
};

export function DocumentDropzone({ onFile, hint, disabled, busy, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    setError(null);
    if (!files || disabled) return;
    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        setError(`"${file.name}" is larger than 25 MB.`);
        continue;
      }
      try {
        await onFile(file);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={className}>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleFiles(e.dataTransfer.files); }}
        className={cn(
          "w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-sm transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-foreground/40 hover:bg-accent/30",
          (disabled || busy) && "opacity-60 cursor-not-allowed",
        )}
      >
        {busy ? <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              : <UploadCloud className="w-6 h-6 text-muted-foreground" />}
        <span className="text-muted-foreground text-center">{hint}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        hidden
        onChange={(e) => void handleFiles(e.target.files)}
      />
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
    </div>
  );
}
