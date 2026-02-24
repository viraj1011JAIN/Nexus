"use client";

import { useState, useEffect } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { FileAttachment } from "@/components/board/file-attachment";
import { ErrorBoundary } from "@/components/error-boundary";
import { type AttachmentDto } from "@/actions/attachment-actions";

interface AttachmentsTabProps {
  cardId: string;
  boardId: string;
  onCountChange?: (count: number) => void;
}

export function AttachmentsTab({ cardId, boardId, onCountChange }: AttachmentsTabProps) {
  const [attachments, setAttachments] = useState<AttachmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Propagate count to parent whenever attachments list changes (initial load + mutations)
  useEffect(() => {
    if (!loading) onCountChange?.(attachments.length);
  }, [attachments, loading, onCountChange]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/attachment?cardId=${encodeURIComponent(cardId)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Failed to load attachments");
        const data = await res.json();
        if (!cancelled) {
          // JSON serialization turns Date objects into ISO strings; convert back
          // so formatDistanceToNow and any date comparisons receive real Date objects.
          // Guard against missing or un-parseable values to avoid invalid Date objects.
          const list: AttachmentDto[] = (data.attachments ?? []).map(
            (a: Omit<AttachmentDto, "createdAt"> & { createdAt: unknown }) => {
              let createdAt: Date | null = null;
              if (typeof a.createdAt === "string" && a.createdAt.trim() !== "") {
                const parsed = new Date(a.createdAt);
                if (!isNaN(parsed.getTime())) createdAt = parsed;
              }
              return { ...a, createdAt } as AttachmentDto;
            }
          );
          setAttachments(list);
          setLoading(false);
        }
      } catch (e) {
        if ((e as DOMException).name === "AbortError") return;
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load attachments");
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [cardId, retryCount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-destructive">
        <Paperclip className="h-8 w-8 opacity-40" />
        <p className="text-sm">{error}</p>
        <button
          onClick={() => setRetryCount((c) => c + 1)}
          className="text-xs underline text-muted-foreground hover:text-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary
      fallback={
        <p className="text-sm text-muted-foreground py-4 text-center">
          Failed to render attachments.
        </p>
      }
    >
      <FileAttachment
        cardId={cardId}
        boardId={boardId}
        initialAttachments={attachments}
        onAttachmentsChange={(updated) => {
          setAttachments(updated);
        }}
      />
    </ErrorBoundary>
  );
}
