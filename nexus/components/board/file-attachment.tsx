"use client";

import { useState, useRef } from "react";
import { Paperclip, Trash2, Download, FileText, ImageIcon, File, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { type AttachmentDto } from "@/actions/attachment-actions";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-blue-500" aria-hidden={true} />;
  if (mimeType === "application/pdf")
    return <FileText className="h-4 w-4 text-red-500" aria-hidden={true} />;
  return <File className="h-4 w-4 text-muted-foreground" aria-hidden={true} />;
}

interface FileAttachmentProps {
  cardId: string;
  boardId: string;
  initialAttachments?: AttachmentDto[];
}

export function FileAttachment({ cardId, boardId, initialAttachments = [] }: FileAttachmentProps) {
  const [attachments, setAttachments] = useState<AttachmentDto[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE_BYTES) {
      toast.error("File exceeds 10 MB limit");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("cardId", cardId);

    setUploading(true);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Upload failed");
        return;
      }

      const attachment: AttachmentDto = {
        ...json,
        createdAt: new Date(json.createdAt),
      };
      setAttachments((prev) => [attachment, ...prev]);
      toast.success(`"${file.name}" uploaded`);
    } catch {
      toast.error("Upload failed — please try again");
    } finally {
      setUploading(false);
      // Reset file input
      if (inputRef.current) inputRef.current.value = "";
    }
  };

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
      toast.success(`"${fileName}" removed`);
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting(null);
    }
    // Suppress unused boardId lint warning — kept for future revalidation
    void boardId;
  };

  return (
    <div className="space-y-3">
      {/* Header + Upload trigger */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            Attachments {attachments.length > 0 && `(${attachments.length})`}
          </span>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            id={`file-upload-${cardId}`}
            className="sr-only"
            onChange={handleFileChange}
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
            disabled={uploading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            asChild
            disabled={uploading}
          >
            <label htmlFor={`file-upload-${cardId}`} className="cursor-pointer gap-2 flex items-center">
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Paperclip className="h-3.5 w-3.5" />
              )}
              {uploading ? "Uploading…" : "Attach file"}
            </label>
          </Button>
        </div>
      </div>

      {/* Attachment list */}
      {attachments.length > 0 && (
        <ul className="space-y-2">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 group"
            >
              {fileIcon(att.mimeType)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{att.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(att.fileSize)} · {att.uploadedByName} ·{" "}
                  {formatDistanceToNow(att.createdAt, { addSuffix: true })}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={att.fileName}
                  className="p-1.5 rounded hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(att.id, att.fileName)}
                  disabled={deleting === att.id}
                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete"
                >
                  {deleting === att.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
