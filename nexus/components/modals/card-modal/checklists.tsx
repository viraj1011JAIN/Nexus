"use client";

import { useState, useEffect } from "react";
import { CheckSquare, Loader2 } from "lucide-react";
import { ChecklistPanel } from "@/components/board/checklist-panel";
import { ErrorBoundary } from "@/components/error-boundary";
import { getChecklists } from "@/actions/checklist-actions";

interface ChecklistsTabProps {
  cardId: string;
  boardId: string;
}

export function ChecklistsTab({ cardId, boardId }: ChecklistsTabProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [checklists, setChecklists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getChecklists(cardId);
      if (result.error) throw new Error(result.error);
      setChecklists(result.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load checklists");
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
        <CheckSquare className="h-8 w-8 opacity-40" />
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
          Failed to render checklists.
        </p>
      }
    >
      <ChecklistPanel
        cardId={cardId}
        boardId={boardId}
        initialChecklists={checklists}
      />
    </ErrorBoundary>
  );
}
