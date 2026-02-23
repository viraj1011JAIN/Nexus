"use client";

import { useState, useEffect } from "react";
import { Link2, Loader2 } from "lucide-react";
import { DependencyPanel } from "@/components/board/dependency-panel";
import { ErrorBoundary } from "@/components/error-boundary";
import { getCardDependencies } from "@/actions/dependency-actions";

interface DependenciesTabProps {
  cardId: string;
  boardId: string;
}

export function DependenciesTab({ cardId, boardId }: DependenciesTabProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [blocking, setBlocking] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [blockedBy, setBlockedBy] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getCardDependencies(cardId);
      if (result.error) throw new Error(result.error);
      setBlocking(result.data?.blocking ?? []);
      setBlockedBy(result.data?.blockedBy ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dependencies");
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
        <Link2 className="h-8 w-8 opacity-40" />
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
          Failed to render dependencies.
        </p>
      }
    >
      <DependencyPanel
        cardId={cardId}
        boardId={boardId}
        initialBlocking={blocking}
        initialBlockedBy={blockedBy}
      />
    </ErrorBoundary>
  );
}
