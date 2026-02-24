"use client";

import { useState, useEffect } from "react";
import { CheckSquare, Loader2, Sparkles, Plus } from "lucide-react";
import { ChecklistPanel } from "@/components/board/checklist-panel";
import { ErrorBoundary } from "@/components/error-boundary";
import { getChecklists, addChecklist, addChecklistItem } from "@/actions/checklist-actions";
import { suggestChecklists } from "@/actions/ai-actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ChecklistsTabProps {
  cardId: string;
  boardId: string;
  cardTitle: string;
}

export function ChecklistsTab({ cardId, boardId, cardTitle }: ChecklistsTabProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [checklists, setChecklists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI suggest state (TASK-022)
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  // Use a Set to track each in-flight item independently — prevents duplicate
  // addChecklist calls when the user quickly taps multiple suggestions.
  const [addingItem, setAddingItem] = useState<Set<string>>(new Set());

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

  const handleSuggestItems = async () => {
    setIsLoadingSuggestions(true);
    setSuggestions([]);
    try {
      const result = await suggestChecklists({ title: cardTitle });
      if (result?.data?.items?.length) {
        // Deduplicate items to avoid stable-key collisions in the rendered list.
        setSuggestions([...new Set(result.data.items)]);
      } else if (result?.error) {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to get suggestions");
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleAddSuggestion = async (item: string) => {
    setAddingItem(prev => new Set(prev).add(item));
    try {
      // Use first checklist if one exists, otherwise create one
      let targetChecklistId = checklists[0]?.id as string | undefined;
      if (!targetChecklistId) {
        const res = await addChecklist({ cardId, boardId, title: "Checklist" });
        if (res.error) { toast.error(res.error); return; }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        targetChecklistId = (res.data as any)?.id as string;
        if (!targetChecklistId) { toast.error("Failed to create checklist"); return; }
        await load();
      }
      const res = await addChecklistItem({ checklistId: targetChecklistId, boardId, title: item });
      if (res.error) { toast.error(res.error); return; }
      setSuggestions(prev => prev.filter(s => s !== item));
      await load();
    } catch (err) {
      toast.error("Failed to add checklist item");
      console.error("[checklists] handleAddSuggestion error:", err);
    } finally {
      setAddingItem(prev => {
        const next = new Set(prev);
        next.delete(item);
        return next;
      });
    }
  };

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
      {/* AI Suggest items (TASK-022) */}
      <div className="mb-4">
        <button
          type="button"
          onClick={handleSuggestItems}
          disabled={isLoadingSuggestions}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md w-full justify-center",
            "border border-violet-200 dark:border-violet-800",
            "text-violet-600 dark:text-violet-400",
            "hover:bg-violet-50 dark:hover:bg-violet-950/20",
            "disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          )}
        >
          {isLoadingSuggestions
            ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating suggestions...</>
            : <><Sparkles className="h-3 w-3" /> Suggest checklist items</>}
        </button>

        {suggestions.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-xs text-muted-foreground mb-2">Click + to add items:</p>
            {suggestions.map((item) => (
              <div
                key={item}
                className="flex items-center justify-between gap-2 text-sm px-2 py-1.5 rounded-md bg-muted/40 hover:bg-muted/60"
              >
                <span className="text-foreground">{item}</span>
                <button
                  type="button"
                  aria-label={addingItem.has(item) ? "Adding suggestion" : "Add suggestion"}
                  onClick={() => handleAddSuggestion(item)}
                  disabled={addingItem.has(item)}
                  className="text-primary hover:text-primary/80 flex-shrink-0 disabled:opacity-40"
                >
                  {addingItem.has(item)
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Plus className="h-3.5 w-3.5" />}
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSuggestions([])}
              className="text-xs text-muted-foreground hover:text-foreground mt-1"
            >
              Dismiss all
            </button>
          </div>
        )}
      </div>

      <ChecklistPanel
        cardId={cardId}
        boardId={boardId}
        initialChecklists={checklists}
      />
    </ErrorBoundary>
  );
}

