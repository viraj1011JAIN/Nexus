"use client";

import { useState, useEffect } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { FileAttachment } from "@/components/board/file-attachment";
import { ErrorBoundary } from "@/components/error-boundary";

interface Attachment {
  id: string;
  filename: string;
  fileUrl: string;
  fileSize?: number | null;
  mimeType?: string | null;
  createdAt: Date | string;
}

interface AttachmentsTabProps {
  cardId: string;
  boardId: string;
}

export function AttachmentsTab({ cardId, boardId }: AttachmentsTabProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/attachment?cardId=${encodeURIComponent(cardId)}`);
      if (!res.ok) throw new Error("Failed to load attachments");
      const data = await res.json();
      setAttachments(data.attachments ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load attachments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [cardId]); // eslint-disable-line react-hooks/exhaustive-deps

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
          onClick={load}
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
        onAttachmentsChange={setAttachments}
      />
    </ErrorBoundary>
  );
}
