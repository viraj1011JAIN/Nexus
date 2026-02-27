"use client";

import { useState, useMemo } from "react";
import { Card } from "@prisma/client";
import { format, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  Search,
  X,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCardModal } from "@/hooks/use-card-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ─────────────────────────────────────────────────────────────────

interface CardRow extends Card {
  listTitle: string;
}

type SortField = "title" | "priority" | "dueDate" | "listTitle" | "createdAt" | "storyPoints";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  LOW: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

interface TableViewProps {
  lists: Array<{ id: string; title: string; cards: Card[] }>;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function TableView({ lists }: TableViewProps) {
  const cardModal = useCardModal();
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [listFilter, setListFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("listTitle");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Flatten all cards with their list title
  const allCards: CardRow[] = useMemo(() => {
    return lists.flatMap((list) =>
      list.cards.map((card) => ({ ...card, listTitle: list.title }))
    );
  }, [lists]);

  // Filter
  const filtered = useMemo(() => {
    return allCards.filter((card) => {
      const matchSearch =
        !search ||
        card.title.toLowerCase().includes(search.toLowerCase()) ||
        card.description?.toLowerCase().includes(search.toLowerCase());

      const matchPriority =
        priorityFilter === "all" ||
        card.priority === priorityFilter ||
        (priorityFilter === "none" && !card.priority);

      const matchList = listFilter === "all" || card.listTitle === listFilter;

      return matchSearch && matchPriority && matchList;
    });
  }, [allCards, search, priorityFilter, listFilter]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;

      switch (sortField) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "priority":
          cmp =
            (PRIORITY_ORDER[a.priority ?? ""] ?? 99) -
            (PRIORITY_ORDER[b.priority ?? ""] ?? 99);
          break;
        case "dueDate":
          if (!a.dueDate && !b.dueDate) cmp = 0;
          else if (!a.dueDate) cmp = 1;
          else if (!b.dueDate) cmp = -1;
          else cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          break;
        case "listTitle":
          cmp = a.listTitle.localeCompare(b.listTitle);
          break;
        case "createdAt":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "storyPoints":
          cmp = (a.storyPoints ?? -1) - (b.storyPoints ?? -1);
          break;
      }

      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-slate-400" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-purple-600" />
    ) : (
      <ArrowDown className="h-3 w-3 text-purple-600" />
    );
  };

  const hasFilters = search || priorityFilter !== "all" || listFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setPriorityFilter("all");
    setListFilter("all");
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search cards..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-white dark:bg-slate-800"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-9 w-36 bg-white dark:bg-slate-800 text-sm">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="none">No priority</SelectItem>
          </SelectContent>
        </Select>

        <Select value={listFilter} onValueChange={setListFilter}>
          <SelectTrigger className="h-9 w-40 bg-white dark:bg-slate-800 text-sm">
            <SelectValue placeholder="List" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All lists</SelectItem>
            {lists.map((l) => (
              <SelectItem key={l.id} value={l.title}>
                {l.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs text-slate-500 hover:text-red-500">
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        )}

        <div className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          {sorted.length} card{sorted.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                {[
                  { label: "Title", field: "title" as SortField, class: "w-[35%]" },
                  { label: "List", field: "listTitle" as SortField, class: "w-[15%]" },
                  { label: "Priority", field: "priority" as SortField, class: "w-[12%]" },
                  { label: "Due Date", field: "dueDate" as SortField, class: "w-[15%]" },
                  { label: "Points", field: "storyPoints" as SortField, class: "w-[10%]" },
                  { label: "Created", field: "createdAt" as SortField, class: "w-[13%]" },
                ].map(({ label, field, class: cls }) => (
                  <th
                    key={field}
                    onClick={() => toggleSort(field)}
                    className={cn(
                      "px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-slate-900 dark:hover:text-slate-100 transition-colors",
                      cls
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      {label}
                      <SortIcon field={field} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400 dark:text-slate-600">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No cards match your filters</p>
                  </td>
                </tr>
              ) : (
                sorted.map((card) => {
                  const isOverdue = card.dueDate && isPast(new Date(card.dueDate));
                  return (
                    <tr
                      key={card.id}
                      onClick={() => cardModal.onOpen(card.id)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                    >
                      {/* Title */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {(card.coverColor || card.coverImageUrl) && (
                            <span
                              className="inline-block h-3 w-3 rounded-full shrink-0 ring-1 ring-white/50"
                              style={
                                card.coverImageUrl
                                  ? { backgroundImage: `url(${card.coverImageUrl})`, backgroundSize: "cover" }
                                  : { backgroundColor: card.coverColor ?? undefined }
                              }
                            />
                          )}
                          <span className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-2">
                            {card.title}
                          </span>
                        </div>
                      </td>

                      {/* List */}
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs font-normal">
                          {card.listTitle}
                        </Badge>
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3">
                        {card.priority ? (
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                              PRIORITY_COLORS[card.priority]
                            )}
                          >
                            {card.priority.charAt(0) + card.priority.slice(1).toLowerCase()}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">—</span>
                        )}
                      </td>

                      {/* Due Date */}
                      <td className="px-4 py-3">
                        {card.dueDate ? (
                          <div
                            className={cn(
                              "inline-flex items-center gap-1.5 text-xs",
                              isOverdue
                                ? "text-red-600 dark:text-red-400"
                                : "text-slate-600 dark:text-slate-400"
                            )}
                          >
                            <Clock className="h-3 w-3" />
                            {format(new Date(card.dueDate), "MMM d, yyyy")}
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">—</span>
                        )}
                      </td>

                      {/* Story Points */}
                      <td className="px-4 py-3">
                        {card.storyPoints !== null && card.storyPoints !== undefined ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            {card.storyPoints}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">—</span>
                        )}
                      </td>

                      {/* Created */}
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                        {format(new Date(card.createdAt), "MMM d, yyyy")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
