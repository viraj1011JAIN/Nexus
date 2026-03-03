"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import {
  Paperclip,
  Trash2,
  Download,
  FileText,
  ImageIcon,
  File,
  Loader2,
  Copy,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Film,
  Music,
  Archive,
  Code,
  FileSpreadsheet,
  Presentation,
  LayoutGrid,
  List,
  SortAsc,
  SortDesc,
  Upload,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, isValid, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { type AttachmentDto } from "@/actions/attachment-actions";

const MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Append ?download=false so Supabase Storage responds with
 * Content-Disposition: inline — the browser renders the file rather than
 * forcing a save dialog.
 */
function viewUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("download", "false");
    return u.toString();
  } catch {
    return url;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ─── File categorisation ────────────────────────────────────────────────────

type FileCategory =
  | "image"
  | "pdf"
  | "video"
  | "audio"
  | "archive"
  | "code"
  | "spreadsheet"
  | "presentation"
  | "document"
  | "other";

function categorize(mimeType: string): FileCategory {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    [
      "application/zip",
      "application/x-zip-compressed",
      "application/x-rar-compressed",
      "application/x-7z-compressed",
    ].includes(mimeType)
  )
    return "archive";
  if (
    [
      "application/json",
      "application/xml",
      "text/xml",
      "text/plain",
      "text/csv",
      "text/markdown",
    ].includes(mimeType)
  )
    return "code";
  if (
    [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ].includes(mimeType)
  )
    return "spreadsheet";
  if (
    [
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ].includes(mimeType)
  )
    return "presentation";
  if (
    [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ].includes(mimeType)
  )
    return "document";
  return "other";
}

/** Coloured icon matched to file type */
function FileTypeIcon({
  mimeType,
  className,
}: {
  mimeType: string;
  className?: string;
}) {
  const cat = categorize(mimeType);
  const cls = cn("h-4 w-4", className);
  switch (cat) {
    case "image":
      return <ImageIcon className={cn(cls, "text-blue-500")} aria-hidden />;
    case "pdf":
      return <FileText className={cn(cls, "text-red-500")} aria-hidden />;
    case "video":
      return <Film className={cn(cls, "text-purple-500")} aria-hidden />;
    case "audio":
      return <Music className={cn(cls, "text-pink-500")} aria-hidden />;
    case "archive":
      return <Archive className={cn(cls, "text-yellow-600")} aria-hidden />;
    case "code":
      return <Code className={cn(cls, "text-green-500")} aria-hidden />;
    case "spreadsheet":
      return <FileSpreadsheet className={cn(cls, "text-emerald-500")} aria-hidden />;
    case "presentation":
      return <Presentation className={cn(cls, "text-orange-500")} aria-hidden />;
    case "document":
      return <FileText className={cn(cls, "text-indigo-500")} aria-hidden />;
    default:
      return <File className={cn(cls, "text-muted-foreground")} aria-hidden />;
  }
}

/** Small coloured pill label (IMG / PDF / ZIP …) */
function FileTypeBadge({ mimeType }: { mimeType: string }) {
  const cat = categorize(mimeType);
  const labels: Record<FileCategory, string> = {
    image: "IMG",
    pdf: "PDF",
    video: "VID",
    audio: "AUD",
    archive: "ZIP",
    code: "TXT",
    spreadsheet: "XLS",
    presentation: "PPT",
    document: "DOC",
    other: "FILE",
  };
  const colors: Record<FileCategory, string> = {
    image: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    pdf: "bg-red-500/10 text-red-600 dark:text-red-400",
    video: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    audio: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
    archive: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    code: "bg-green-500/10 text-green-600 dark:text-green-400",
    spreadsheet: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    presentation: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    document: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    other: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded",
        colors[cat]
      )}
    >
      {labels[cat]}
    </span>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface UploadItem {
  id: string;
  fileName: string;
  progress: number;
}

interface PreviewState {
  attachment: AttachmentDto;
  index: number;
}

type SortKey = "date" | "name" | "size";
type SortDir = "asc" | "desc";
type ViewMode = "list" | "grid";

interface FileAttachmentProps {
  cardId: string;
  boardId: string;
  initialAttachments?: AttachmentDto[];
  onAttachmentsChange?: (attachments: AttachmentDto[]) => void;
}

// ─── Preview modal ──────────────────────────────────────────────────────────

function PreviewModal({
  preview,
  attachments,
  onClose,
  onNavigate,
}: {
  preview: PreviewState;
  attachments: AttachmentDto[];
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const { attachment, index } = preview;
  const cat = categorize(attachment.mimeType);
  const url = viewUrl(attachment.url);
  const total = attachments.length;

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onNavigate(index - 1);
      if (e.key === "ArrowRight" && index < total - 1) onNavigate(index + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [index, total, onClose, onNavigate]);

  const previewContent = () => {
    switch (cat) {
      case "image":
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={attachment.fileName}
            className="max-w-full max-h-[72vh] object-contain rounded"
          />
        );
      case "pdf":
        return (
          <iframe
            src={url}
            title={attachment.fileName}
            className="w-full rounded"
            style={{ height: "72vh" }}
          />
        );
      case "video":
        return (
          <video
            controls
            className="max-w-full max-h-[72vh] rounded"
            src={url}
          />
        );
      case "audio":
        return (
          <div className="flex flex-col items-center gap-6 py-16 px-12">
            <Music className="h-24 w-24 text-white/20" aria-hidden />
            <audio controls src={url} className="w-80" />
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center gap-4 py-16 px-12 text-white/40">
            <FileTypeIcon mimeType={attachment.mimeType} className="h-20 w-20 opacity-30" />
            <p className="text-sm">No preview available for this file type</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline text-white/60 hover:text-white transition-colors"
            >
              Open in browser
            </a>
          </div>
        );
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-5xl w-[95vw] p-0 bg-black/95 border-border/20 overflow-hidden [&>button]:hidden">
        <DialogTitle className="sr-only">{attachment.fileName}</DialogTitle>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/60 border-b border-white/10 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <FileTypeIcon
              mimeType={attachment.mimeType}
              className="h-4 w-4 shrink-0 text-white/70"
            />
            <span className="text-sm font-medium text-white truncate">
              {attachment.fileName}
            </span>
            <span className="text-xs text-white/40 shrink-0">
              {formatBytes(attachment.fileSize)}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
            <a
              href={attachment.url}
              download={attachment.fileName}
              className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              title="Download"
            >
              <Download className="h-4 w-4" aria-hidden />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* Preview area */}
        <div className="relative flex items-center justify-center bg-black/80 min-h-[40vh]">
          {previewContent()}

          {/* ← Previous */}
          {index > 0 && (
            <button
              onClick={() => onNavigate(index - 1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white/70 hover:text-white hover:bg-black/90 transition-colors"
              aria-label="Previous attachment"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
          )}
          {/* → Next */}
          {index < total - 1 && (
            <button
              onClick={() => onNavigate(index + 1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white/70 hover:text-white hover:bg-black/90 transition-colors"
              aria-label="Next attachment"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-black/60 border-t border-white/10 flex items-center justify-between gap-4">
          <p className="text-xs text-white/40 truncate">
            {isValid(attachment.createdAt)
              ? format(attachment.createdAt, "d MMM yyyy, HH:mm")
              : "—"}{" "}
            · {attachment.uploadedByName}
          </p>
          {/* Dot navigation strip */}
          {total > 1 && (
            <div className="flex items-center gap-1.5 shrink-0">
              {attachments.map((_, i) => (
                <button
                  key={i}
                  onClick={() => onNavigate(i)}
                  className={cn(
                    "rounded-full transition-all duration-200",
                    i === index
                      ? "w-3 h-1.5 bg-white"
                      : "w-1.5 h-1.5 bg-white/30 hover:bg-white/60"
                  )}
                  aria-label={`Go to attachment ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function FileAttachment({
  cardId,
  boardId,
  initialAttachments = [],
  onAttachmentsChange,
}: FileAttachmentProps) {
  const [attachments, setAttachments] = useState<AttachmentDto[]>(
    initialAttachments.map((att) => ({
      ...att,
      createdAt:
        typeof att.createdAt === "string"
          ? new Date(att.createdAt)
          : att.createdAt,
    }))
  );
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const inputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Notify parent whenever list changes
  useEffect(() => {
    onAttachmentsChange?.(attachments);
  }, [attachments, onAttachmentsChange]);

  // ── Upload engine (XHR — exposes upload progress events) ─────────────────
  const uploadFiles = useCallback(
    async (files: File[]) => {
      const valid = files.filter((f) => {
        if (f.size > MAX_SIZE_BYTES) {
          toast.error(`"${f.name}" exceeds 100 MB limit`);
          return false;
        }
        return true;
      });
      if (valid.length === 0) return;

      const queueItems: UploadItem[] = valid.map((f) => ({
        id: `${Date.now()}-${f.name}`,
        fileName: f.name,
        progress: 0,
      }));
      setUploadQueue((prev) => [...prev, ...queueItems]);

      for (let i = 0; i < valid.length; i++) {
        const file = valid[i];
        const item = queueItems[i];

        await new Promise<void>((resolve) => {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("cardId", cardId);

          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setUploadQueue((prev) =>
                prev.map((q) =>
                  q.id === item.id ? { ...q, progress: pct } : q
                )
              );
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status === 201) {
              try {
                const json = JSON.parse(xhr.responseText);
                const attachment: AttachmentDto = {
                  ...json,
                  createdAt: new Date(json.createdAt),
                };
                setAttachments((prev) => [attachment, ...prev]);
                toast.success(`"${file.name}" uploaded`);
              } catch {
                toast.error("Upload response invalid");
              }
            } else {
              try {
                const json = JSON.parse(xhr.responseText);
                toast.error(json.error ?? `Upload failed (${xhr.status})`);
              } catch {
                toast.error(`"${file.name}" upload failed (${xhr.status})`);
              }
            }
            setUploadQueue((prev) => prev.filter((q) => q.id !== item.id));
            resolve();
          });

          xhr.addEventListener("error", () => {
            toast.error(`"${file.name}" upload failed — check your connection`);
            setUploadQueue((prev) => prev.filter((q) => q.id !== item.id));
            resolve();
          });

          xhr.open("POST", "/api/upload");
          xhr.send(formData);
        });
      }

      if (inputRef.current) inputRef.current.value = "";
    },
    [cardId]
  );

  // ── Paste to upload (Ctrl+V screenshots / files) ──────────────────────────
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        uploadFiles(files);
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [uploadFiles]);

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) uploadFiles(files);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) uploadFiles(files);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string, fileName: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/upload?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error ?? "Delete failed");
        return;
      }
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      if (preview?.attachment.id === id) setPreview(null);
      toast.success(`"${fileName}" removed`);
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting(null);
    }
    void boardId;
  };

  // ── Copy link ──────────────────────────────────────────────────────────────
  const copyLink = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(viewUrl(url));
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  // ── Sort ───────────────────────────────────────────────────────────────────
  const sorted = [...attachments].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "date")
      cmp = (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
    if (sortKey === "name") cmp = a.fileName.localeCompare(b.fileName);
    if (sortKey === "size") cmp = a.fileSize - b.fileSize;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const hasImages = sorted.some((a) => categorize(a.mimeType) === "image");
  const isUploading = uploadQueue.length > 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      ref={dropZoneRef}
      className={cn(
        "space-y-3 relative transition-all duration-200",
        dragOver && "ring-2 ring-primary ring-offset-2 rounded-xl"
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-10 bg-primary/10 rounded-xl border-2 border-dashed border-primary flex flex-col items-center justify-center gap-2 pointer-events-none">
          <Upload className="h-8 w-8 text-primary" aria-hidden />
          <p className="text-sm font-semibold text-primary">Drop to upload</p>
        </div>
      )}

      {/* ── Header row ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium">
            Attachments{attachments.length > 0 && ` (${attachments.length})`}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Sort dropdown */}
          {attachments.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Sort attachments"
                >
                  {sortDir === "asc" ? (
                    <SortAsc className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <SortDesc className="h-3.5 w-3.5" aria-hidden />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {(["date", "name", "size"] as SortKey[]).map((k) => (
                  <DropdownMenuItem
                    key={k}
                    onClick={() => {
                      if (sortKey === k)
                        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                      else {
                        setSortKey(k);
                        setSortDir("desc");
                      }
                    }}
                    className={cn("capitalize gap-2", sortKey === k && "font-semibold")}
                  >
                    {sortKey === k ? (sortDir === "asc" ? "↑ " : "↓ ") : "   "}
                    Sort by {k}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Grid / List toggle (only when images are present) */}
          {hasImages && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() =>
                setViewMode((v) => (v === "list" ? "grid" : "list"))
              }
              title={
                viewMode === "list" ? "Switch to grid view" : "Switch to list view"
              }
            >
              {viewMode === "list" ? (
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <List className="h-3.5 w-3.5" aria-hidden />
              )}
            </Button>
          )}

          {/* Upload button */}
          <input
            ref={inputRef}
            type="file"
            id={`file-upload-${cardId}`}
            className="sr-only"
            onChange={handleFileChange}
            multiple
            accept="image/jpeg,image/png,image/gif,image/webp,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.json,.xml,.zip,.rar,.7z"
            disabled={isUploading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            asChild
            disabled={isUploading}
          >
            <label
              htmlFor={`file-upload-${cardId}`}
              className="cursor-pointer gap-2 flex items-center"
            >
              {isUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Paperclip className="h-3.5 w-3.5" aria-hidden />
              )}
              {isUploading
                ? `Uploading (${uploadQueue.length})…`
                : "Attach"}
            </label>
          </Button>
        </div>
      </div>

      {/* ── Empty state / drop hint ──────────────────────────────────────── */}
      {attachments.length === 0 && uploadQueue.length === 0 && (
        <button
          type="button"
          className="w-full flex flex-col items-center justify-center py-8 gap-2 rounded-lg border border-dashed border-muted-foreground/25 text-muted-foreground hover:border-muted-foreground/50 hover:bg-muted/30 transition-all cursor-pointer"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-7 w-7 opacity-40" aria-hidden />
          <p className="text-xs font-medium">
            Drop files here, paste a screenshot, or click to browse
          </p>
          <p className="text-[11px] opacity-60">
            Images · PDFs · videos · documents · up to 100 MB each
          </p>
        </button>
      )}

      {/* ── Per-file upload progress bars ───────────────────────────────── */}
      {uploadQueue.length > 0 && (
        <ul className="space-y-2">
          {uploadQueue.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50"
            >
              <Loader2
                className="h-4 w-4 animate-spin text-muted-foreground shrink-0"
                aria-hidden
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{item.fileName}</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                    {item.progress}%
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ── Grid view ───────────────────────────────────────────────────── */}
      {viewMode === "grid" && sorted.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {sorted.map((att, i) => {
            const cat = categorize(att.mimeType);
            return (
              <div
                key={att.id}
                className="relative group rounded-lg overflow-hidden bg-muted aspect-square cursor-pointer ring-1 ring-border/50 hover:ring-primary/60 transition-all"
                onClick={() => setPreview({ attachment: att, index: i })}
                onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                  if (e.key === "Enter" || e.key === " ")
                    setPreview({ attachment: att, index: i });
                }}
                role="button"
                tabIndex={0}
                aria-label={`Preview ${att.fileName}`}
              >
                {cat === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={viewUrl(att.url)}
                    alt={att.fileName}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3">
                    <FileTypeIcon mimeType={att.mimeType} className="h-8 w-8" />
                    <FileTypeBadge mimeType={att.mimeType} />
                  </div>
                )}

                {/* Hover shimmer */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Eye className="h-6 w-6 text-white drop-shadow" aria-hidden />
                </div>

                {/* Top-right actions */}
                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyLink(att.url, att.id);
                    }}
                    className="p-1 rounded bg-black/60 text-white/80 hover:text-white transition-colors"
                    title="Copy link"
                    aria-label="Copy link"
                  >
                    {copied === att.id ? (
                      <Check className="h-3 w-3 text-green-400" aria-hidden />
                    ) : (
                      <Copy className="h-3 w-3" aria-hidden />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(att.id, att.fileName);
                    }}
                    disabled={deleting === att.id}
                    className="p-1 rounded bg-black/60 text-white/80 hover:text-red-400 transition-colors disabled:opacity-50"
                    title="Delete"
                    aria-label={`Delete ${att.fileName}`}
                  >
                    {deleting === att.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="h-3 w-3" aria-hidden />
                    )}
                  </button>
                </div>

                {/* Bottom label (slides up on hover) */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                  <p className="text-[11px] text-white font-medium truncate leading-tight">
                    {att.fileName}
                  </p>
                  <p className="text-[10px] text-white/60">{formatBytes(att.fileSize)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── List view ───────────────────────────────────────────────────── */}
      {viewMode === "list" && sorted.length > 0 && (
        <ul className="space-y-1.5">
          {sorted.map((att, i) => {
            const cat = categorize(att.mimeType);
            const previewable = ["image", "pdf", "video", "audio"].includes(cat);
            return (
              <li
                key={att.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/60 group transition-colors"
              >
                {/* Thumbnail (images) / Icon box (other types) */}
                {cat === "image" ? (
                  <button
                    type="button"
                    onClick={() => setPreview({ attachment: att, index: i })}
                    className="h-9 w-9 rounded overflow-hidden shrink-0 ring-1 ring-border/50 hover:ring-primary/60 transition-all"
                    title="Preview"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={viewUrl(att.url)}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ) : (
                  <div className="h-9 w-9 rounded flex items-center justify-center shrink-0 bg-background ring-1 ring-border/50">
                    <FileTypeIcon mimeType={att.mimeType} className="h-4 w-4" />
                  </div>
                )}

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        previewable
                          ? setPreview({ attachment: att, index: i })
                          : window.open(viewUrl(att.url), "_blank")
                      }
                      className="text-sm font-medium truncate hover:text-primary transition-colors text-left"
                      title={previewable ? "Preview" : "Open in browser"}
                    >
                      {att.fileName}
                    </button>
                    <FileTypeBadge mimeType={att.mimeType} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(att.fileSize)} · {att.uploadedByName} ·{" "}
                    {isValid(att.createdAt)
                      ? formatDistanceToNow(att.createdAt, { addSuffix: true })
                      : "—"}
                  </p>
                </div>

                {/* Action buttons — revealed on row hover */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
                  {previewable && (
                    <button
                      type="button"
                      onClick={() => setPreview({ attachment: att, index: i })}
                      className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                      title="Preview"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => copyLink(att.url, att.id)}
                    className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                    title="Copy link"
                  >
                    {copied === att.id ? (
                      <Check className="h-3.5 w-3.5 text-green-500" aria-hidden />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                  <a
                    href={att.url}
                    download={att.fileName}
                    className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                    title="Download"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(att.id, att.fileName)}
                    disabled={deleting === att.id}
                    className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    {deleting === att.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── In-app preview modal ─────────────────────────────────────────── */}
      {preview && (
        <PreviewModal
          preview={preview}
          attachments={sorted}
          onClose={() => setPreview(null)}
          onNavigate={(i) =>
            setPreview({ attachment: sorted[i], index: i })
          }
        />
      )}
    </div>
  );
}
