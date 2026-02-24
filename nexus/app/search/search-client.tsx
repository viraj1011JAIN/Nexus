"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Loader2, SlidersHorizontal, AlertCircle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { useEffect } from "react";

interface CardResult {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  dueDate: string | null;
  listId: string;
  listTitle: string;
  boardId: string;
  boardTitle: string;
  assigneeName: string | null;
  createdAt: string;
}

interface SearchResponse {
  data: CardResult[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  HIGH:   "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  MEDIUM: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  LOW:    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export function SearchClient() {
  const router = useRouter();
  const [query, setQuery]         = useState("");
  const [priority, setPriority]   = useState<string>("ALL");
  const [page, setPage]           = useState(1);
  const [results, setResults]     = useState<SearchResponse | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const debouncedQuery = useDebounce(query, 350);

  const doSearch = useCallback(async (q: string, pri: string, p: number) => {
    if (!q.trim()) { setResults(null); return; }
    setError(null);

    const params = new URLSearchParams({ q, page: String(p), limit: "20" });
    if (pri !== "ALL") params.set("priority", pri);

    const res = await fetch(`/api/cards/search?${params}`);
    if (!res.ok) { setError("Search failed. Please try again."); return; }
    setResults(await res.json() as SearchResponse);
  }, []);

  useEffect(() => {
    startTransition(() => { doSearch(debouncedQuery, priority, 1); setPage(1); });
  }, [debouncedQuery, priority, doSearch]);

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cards, tasks, descriptions…"
            className="pl-9 pr-9"
            aria-label="Search query"
            autoFocus
          />
          {query && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => { setQuery(""); setResults(null); }}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All priorities</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading */}
      {isPending && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-3" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching…
        </div>
      )}

      {/* Error */}
      {error && !isPending && (
        <div className="flex items-center gap-2 text-red-600 text-sm py-3" role="alert">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Results */}
      {!isPending && results && (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {results.meta.total === 0
              ? "No results found."
              : `${results.meta.total} result${results.meta.total !== 1 ? "s" : ""} found`}
          </p>

          <ul className="space-y-2" role="list" aria-label="Search results">
            {results.data.map((card) => (
              <li key={card.id}>
                <Link
                  href={`/board/${card.boardId}?card=${card.id}`}
                  className="block rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`${card.title} — ${card.boardTitle} › ${card.listTitle}`}
                  onClick={() => router.push(`/board/${card.boardId}?card=${card.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{card.title}</p>
                      {card.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                          {card.description.replace(/<[^>]+>/g, "")}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {card.boardTitle} › {card.listTitle}
                        </span>
                        {card.assigneeName && (
                          <span className="text-xs text-muted-foreground">
                            · {card.assigneeName}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <Badge
                        variant="secondary"
                        className={cn("text-xs font-medium", PRIORITY_COLOR[card.priority] ?? "")}
                      >
                        {card.priority.charAt(0) + card.priority.slice(1).toLowerCase()}
                      </Badge>
                      {card.dueDate && (
                        <span className={cn("text-xs", new Date(card.dueDate) < new Date() ? "text-red-500" : "text-muted-foreground")}>
                          Due {new Date(card.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Pagination */}
          {results.meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline" size="sm"
                disabled={page <= 1 || isPending}
                onClick={() => { const p = page - 1; setPage(p); startTransition(() => doSearch(query, priority, p)); }}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {results.meta.page} of {results.meta.totalPages}
              </span>
              <Button
                variant="outline" size="sm"
                disabled={page >= results.meta.totalPages || isPending}
                onClick={() => { const p = page + 1; setPage(p); startTransition(() => doSearch(query, priority, p)); }}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!isPending && !error && !results && (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-30" aria-hidden="true" />
          <p className="text-sm">Start typing to search cards across all boards</p>
        </div>
      )}
    </div>
  );
}
