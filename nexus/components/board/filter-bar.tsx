"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { 
  Filter, X, Save, ChevronDown, User, Tag, Flag, Calendar,
  BookmarkPlus, Bookmark, Trash2, Share2, Check, Search
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  createSavedView, getSavedViews, deleteSavedView, updateSavedView,
} from "@/actions/saved-view-actions";

// ─── Types ────────────────────────────────────────────────────────────────────
/** Safely format a date string, returning the original string on parse failure. */
function formatDateSafe(dateStr: string | undefined, fmt: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : format(d, fmt);
}
export interface FilterState {
  assigneeIds: string[];
  priorities: string[];
  labelIds: string[];
  dueDateFrom?: string;
  dueDateTo?: string;
  overdue?: boolean;
  listIds?: string[];
  search?: string;
}

interface Member {
  id: string;
  name: string;
  imageUrl?: string | null;
}

interface ListItem {
  id: string;
  title: string;
}

interface LabelItem {
  id: string;
  name: string;
  color: string;
}

interface SavedView {
  id: string;
  name: string;
  filters: FilterState;
  isShared: boolean;
  createdAt?: Date;
}

interface FilterBarProps {
  boardId: string;
  members?: Member[];
  lists?: ListItem[];
  labels?: LabelItem[];
  onChange: (filters: FilterState) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<string, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  NONE: "None",
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-yellow-500",
  LOW: "bg-blue-500",
  NONE: "bg-slate-400",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function serializeFilters(f: FilterState): Record<string, string> {
  const params: Record<string, string> = {};
  if (f.assigneeIds.length) params.assignees = f.assigneeIds.join(",");
  if (f.priorities.length) params.priorities = f.priorities.join(",");
  if (f.labelIds.length) params.labels = f.labelIds.join(",");
  if (f.dueDateFrom) params.dateFrom = f.dueDateFrom;
  if (f.dueDateTo) params.dateTo = f.dueDateTo;
  if (f.overdue) params.overdue = "1";
  if (f.listIds?.length) params.lists = f.listIds.join(",");
  if (f.search) params.q = f.search;
  return params;
}

function parseFilters(params: URLSearchParams): FilterState {
  return {
    assigneeIds: params.get("assignees")?.split(",").filter(Boolean) ?? [],
    priorities: params.get("priorities")?.split(",").filter(Boolean) ?? [],
    labelIds: params.get("labels")?.split(",").filter(Boolean) ?? [],
    dueDateFrom: params.get("dateFrom") ?? undefined,
    dueDateTo: params.get("dateTo") ?? undefined,
    overdue: params.get("overdue") === "1",
    listIds: params.get("lists")?.split(",").filter(Boolean),
    search: params.get("q") ?? undefined,
  };
}

function countActiveFilters(f: FilterState) {
  return (
    f.assigneeIds.length +
    f.priorities.length +
    f.labelIds.length +
    (f.dueDateFrom || f.dueDateTo ? 1 : 0) +
    (f.overdue ? 1 : 0) +
    (f.listIds?.length ?? 0) +
    (f.search ? 1 : 0)
  );
}

const EMPTY: FilterState = { assigneeIds: [], priorities: [], labelIds: [] };

// ─── SaveViewDialog ───────────────────────────────────────────────────────────

function SaveViewDialog({
  open,
  onClose,
  boardId,
  filters,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  boardId: string;
  filters: FilterState;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const result = await createSavedView(
        name.trim(),
        filters as unknown as Record<string, unknown>,
        "kanban",
        boardId,
        isShared,
      );
      if (result.error) { toast.error(result.error); return; }
      toast.success("View saved!");
      onSaved();
      onClose();
      setName("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookmarkPlus className="h-4 w-4 text-indigo-500" />
            Save Current View
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="view-name">View name</Label>
            <Input
              id="view-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Open Issues, Sprint Backlog"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Share with team</p>
              <p className="text-xs text-muted-foreground">Others in your org can use this view</p>
            </div>
            <Switch checked={isShared} onCheckedChange={setIsShared} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            Save View
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── SavedViewsPanel ──────────────────────────────────────────────────────────

function SavedViewsPanel({
  boardId,
  onApply,
}: {
  boardId: string;
  onApply: (filters: FilterState) => void;
}) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getSavedViews(boardId);
    if (result.data) setViews(result.data as unknown as SavedView[]);
    setLoading(false);
  }, [boardId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    try {
      const result = await deleteSavedView(id);
      if (result.error) { toast.error(result.error); return; }
      setViews((prev) => prev.filter((v) => v.id !== id));
      toast.success("View deleted.");
    } catch (e) {
      console.error("[DELETE_VIEW]", e);
      toast.error("Failed to delete view.");
    }
  };

  const handleToggleShare = async (view: SavedView) => {
    try {
      const result = await updateSavedView(view.id, { isShared: !view.isShared });
      if (result.error) { toast.error(result.error); return; }
      setViews((prev) => prev.map((v) => v.id === view.id ? { ...v, isShared: !v.isShared } : v));
    } catch (e) {
      console.error("[TOGGLE_SHARE_VIEW]", e);
      toast.error("Failed to update sharing.");
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {[1,2,3].map(i => (
          <div key={i} className="h-10 rounded bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!views.length) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        <Bookmark className="h-8 w-8 mx-auto mb-2 opacity-30" />
        No saved views yet. Apply filters and save to create one.
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
      {views.map((view) => (
        <div
          key={view.id}
          className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/60 group cursor-pointer"
          onClick={() => onApply(view.filters)}
        >
          <Bookmark className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          <span className="text-sm flex-1 truncate font-medium">{view.name}</span>
          {view.isShared && (
            <Badge variant="secondary" className="text-[10px] px-1.5 h-4">Shared</Badge>
          )}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              aria-label="Toggle share"
              title="Toggle share"
              onClick={(e) => { e.stopPropagation(); handleToggleShare(view); }}
              className="p-1 rounded hover:bg-muted"
            >
              <Share2 className="h-3 w-3" />
            </button>
            <button
              aria-label="Delete view"
              title="Delete view"
              onClick={(e) => { e.stopPropagation(); handleDelete(view.id); }}
              className="p-1 rounded hover:bg-red-50 text-red-500"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── FilterChip ───────────────────────────────────────────────────────────────

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-700">
      <span>{label}</span>
      <button onClick={onRemove} aria-label={`Remove ${label} filter`} title={`Remove ${label} filter`} className="hover:text-red-500 transition-colors">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── Main FilterBar ───────────────────────────────────────────────────────────

export function FilterBar({ boardId, members = [], lists = [], labels = [], onChange }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<FilterState>(() => parseFilters(searchParams));
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showViews, setShowViews] = useState(false);
  const [viewsRefreshKey, setViewsRefreshKey] = useState(0);

  // Sync to URL + notify parent
  const applyFilters = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    onChange(newFilters);
    const params = new URLSearchParams(searchParams.toString());
    ["assignees","priorities","labels","dateFrom","dateTo","overdue","lists","q"].forEach(k => params.delete(k));
    const serialized = serializeFilters(newFilters);
    Object.entries(serialized).forEach(([k, v]) => params.set(k, v));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, pathname, router, onChange]);

  useEffect(() => {
    const parsed = parseFilters(searchParams);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilters(parsed);
    onChange(parsed);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleAssignee = (id: string) => {
    const next = filters.assigneeIds.includes(id)
      ? filters.assigneeIds.filter(a => a !== id)
      : [...filters.assigneeIds, id];
    applyFilters({ ...filters, assigneeIds: next });
  };

  const togglePriority = (p: string) => {
    const next = filters.priorities.includes(p)
      ? filters.priorities.filter(x => x !== p)
      : [...filters.priorities, p];
    applyFilters({ ...filters, priorities: next });
  };

  const toggleLabel = (id: string) => {
    const next = filters.labelIds.includes(id)
      ? filters.labelIds.filter(x => x !== id)
      : [...filters.labelIds, id];
    applyFilters({ ...filters, labelIds: next });
  };

  const toggleList = (id: string) => {
    const current = filters.listIds ?? [];
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    applyFilters({ ...filters, listIds: next });
  };

  const clearAll = () => applyFilters(EMPTY);

  const activeCount = countActiveFilters(filters);

  // ── Shared filter button base (Tailwind — theme-aware, keyboard-accessible) ─
  const filterBtnBase =
    "inline-flex items-center gap-1.5 h-[30px] px-3 rounded-lg " +
    "text-xs font-semibold text-white cursor-pointer border-0 whitespace-nowrap select-none " +
    "transition-all duration-150 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background " +
    "hover:brightness-110 active:scale-[0.97]";

  return (
    <div className="w-full">
      {/* Top row: controls */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* ── Search ── */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-8 w-40 pl-7 text-sm"
            placeholder="Search cards..."
            value={filters.search ?? ""}
            onChange={(e) => applyFilters({ ...filters, search: e.target.value || undefined })}
          />
        </div>

        {/* ── Assignees ── violet */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(filterBtnBase, "bg-violet-600 dark:bg-violet-700 shadow-[0_2px_8px_rgba(124,58,237,0.45)] focus-visible:ring-violet-400")}>
              <User className="h-3.5 w-3.5" />
              Assignees
              {filters.assigneeIds.length > 0 && (
                <span className="bg-white/25 rounded-full px-1.5 py-px text-[10px]">
                  {filters.assigneeIds.length}
                </span>
              )}
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-52 border-0 shadow-xl bg-violet-50 dark:bg-violet-950/95 text-violet-900 dark:text-violet-100"
          >
            <DropdownMenuLabel className="text-violet-700 dark:text-violet-300 border-b border-violet-200 dark:border-violet-800 mb-1">
              Filter by Assignee
            </DropdownMenuLabel>
            {members.length === 0 && (
              <DropdownMenuItem disabled className="text-violet-600 dark:text-violet-400">No members found</DropdownMenuItem>
            )}
            {members.map((m) => (
              <DropdownMenuCheckboxItem
                key={m.id}
                checked={filters.assigneeIds.includes(m.id)}
                onCheckedChange={() => toggleAssignee(m.id)}
                className="text-violet-900 dark:text-violet-100"
              >
                <span className="flex items-center gap-2">
                  {m.imageUrl ? (
                    <Image src={m.imageUrl} alt={m.name} width={20} height={20} className="rounded-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                      {m.name[0]?.toUpperCase()}
                    </div>
                  )}
                  {m.name}
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* ── Priority ── orange */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(filterBtnBase, "bg-orange-600 dark:bg-orange-700 shadow-[0_2px_8px_rgba(234,88,12,0.45)] focus-visible:ring-orange-400")}>
              <Flag className="h-3.5 w-3.5" />
              Priority
              {filters.priorities.length > 0 && (
                <span className="bg-white/25 rounded-full px-1.5 py-px text-[10px]">
                  {filters.priorities.length}
                </span>
              )}
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-44 border-0 shadow-xl bg-orange-50 dark:bg-orange-950/95 text-orange-900 dark:text-orange-100"
          >
            <DropdownMenuLabel className="text-orange-700 dark:text-orange-300 border-b border-orange-200 dark:border-orange-800 mb-1">
              Filter by Priority
            </DropdownMenuLabel>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <DropdownMenuCheckboxItem
                key={value}
                checked={filters.priorities.includes(value)}
                onCheckedChange={() => togglePriority(value)}
                className="text-orange-900 dark:text-orange-100"
              >
                <span className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full shrink-0", PRIORITY_COLORS[value])} />
                  {label}
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* ── Labels ── emerald */}
        {labels.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(filterBtnBase, "bg-emerald-600 dark:bg-emerald-700 shadow-[0_2px_8px_rgba(5,150,105,0.45)] focus-visible:ring-emerald-400")}>
                <Tag className="h-3.5 w-3.5" />
                Labels
                {filters.labelIds.length > 0 && (
                  <span className="bg-white/25 rounded-full px-1.5 py-px text-[10px]">
                    {filters.labelIds.length}
                  </span>
                )}
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-48 border-0 shadow-xl bg-emerald-50 dark:bg-emerald-950/95 text-emerald-900 dark:text-emerald-100"
            >
              <DropdownMenuLabel className="text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-800 mb-1">
                Filter by Label
              </DropdownMenuLabel>
              {labels.map((l) => (
                <DropdownMenuCheckboxItem
                  key={l.id}
                  checked={filters.labelIds.includes(l.id)}
                  onCheckedChange={() => toggleLabel(l.id)}
                  className="text-emerald-900 dark:text-emerald-100"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                    {l.name}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* ── Due Date ── rose */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={cn(
                filterBtnBase,
                "shadow-[0_2px_8px_rgba(225,29,72,0.45)] focus-visible:ring-rose-400",
                (filters.dueDateFrom || filters.dueDateTo || filters.overdue)
                  ? "bg-rose-700 dark:bg-rose-800"
                  : "bg-rose-600 dark:bg-rose-700",
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              Due Date
              {(filters.dueDateFrom || filters.dueDateTo || filters.overdue) && (
                <span className="bg-white/25 rounded-full px-1.5 py-px text-[10px]">✓</span>
              )}
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-72 border-0 shadow-xl bg-rose-50 dark:bg-rose-950/95 text-rose-900 dark:text-rose-100 p-4"
          >
            <p className="text-sm font-bold text-rose-700 dark:text-rose-300 mb-3 border-b border-rose-200 dark:border-rose-800 pb-2">
              Due Date Range
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="space-y-1">
                <Label className="text-xs text-rose-800 dark:text-rose-200">From</Label>
                <Input
                  type="date"
                  className="h-8 text-sm bg-rose-100 dark:bg-rose-900/50 border-rose-200 dark:border-rose-700 text-rose-900 dark:text-rose-100"
                  value={filters.dueDateFrom ?? ""}
                  onChange={(e) => applyFilters({ ...filters, dueDateFrom: e.target.value || undefined })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-rose-800 dark:text-rose-200">To</Label>
                <Input
                  type="date"
                  className="h-8 text-sm bg-rose-100 dark:bg-rose-900/50 border-rose-200 dark:border-rose-700 text-rose-900 dark:text-rose-100"
                  value={filters.dueDateTo ?? ""}
                  onChange={(e) => applyFilters({ ...filters, dueDateTo: e.target.value || undefined })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between mb-2.5">
              <Label htmlFor="overdue-toggle" className="text-sm text-rose-800 dark:text-rose-200 font-medium">Overdue only</Label>
              <Switch
                id="overdue-toggle"
                checked={!!filters.overdue}
                onCheckedChange={(v) => applyFilters({ ...filters, overdue: v })}
              />
            </div>
            <button
              onClick={() => applyFilters({ ...filters, dueDateFrom: undefined, dueDateTo: undefined, overdue: false })}
              className="w-full py-1.5 rounded-[7px] bg-rose-100 dark:bg-rose-900/40 border border-rose-200 dark:border-rose-700 text-rose-700 dark:text-rose-300 text-xs font-semibold cursor-pointer hover:bg-rose-200 dark:hover:bg-rose-900/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              Clear dates
            </button>
          </PopoverContent>
        </Popover>

        {/* ── List ── sky blue */}
        {lists.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(filterBtnBase, "bg-sky-600 dark:bg-sky-700 shadow-[0_2px_8px_rgba(2,132,199,0.45)] focus-visible:ring-sky-400")}>
                List
                {(filters.listIds ?? []).length > 0 && (
                  <span className="bg-white/25 rounded-full px-1.5 py-px text-[10px]">
                    {filters.listIds!.length}
                  </span>
                )}
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-48 border-0 shadow-xl bg-sky-50 dark:bg-sky-950/95 text-sky-900 dark:text-sky-100"
            >
              <DropdownMenuLabel className="text-sky-700 dark:text-sky-300 border-b border-sky-200 dark:border-sky-800 mb-1">
                Filter by List
              </DropdownMenuLabel>
              {lists.map((l) => (
                <DropdownMenuCheckboxItem
                  key={l.id}
                  checked={(filters.listIds ?? []).includes(l.id)}
                  onCheckedChange={() => toggleList(l.id)}
                  className="text-sky-900 dark:text-sky-100"
                >
                  {l.title}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          {/* ── Views ── teal */}
          <Popover open={showViews} onOpenChange={setShowViews}>
            <PopoverTrigger asChild>
              <button className={cn(filterBtnBase, "bg-teal-600 dark:bg-teal-700 shadow-[0_2px_8px_rgba(13,148,136,0.45)] focus-visible:ring-teal-400")}>
                <Bookmark className="h-3.5 w-3.5" />
                Views
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-72 p-0 border-0 shadow-xl bg-teal-50 dark:bg-teal-950/95 text-teal-900 dark:text-teal-100"
              sideOffset={4}
            >
              <div className="border-b border-teal-200 dark:border-teal-800 px-3.5 py-2.5 flex items-center justify-between">
                <span className="text-sm font-bold text-teal-700 dark:text-teal-300">Saved Views</span>
                <button
                  onClick={() => { setShowViews(false); setShowSaveDialog(true); }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-800/60 border-0 rounded-md px-2.5 py-1 cursor-pointer hover:bg-teal-200 dark:hover:bg-teal-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  Save current
                </button>
              </div>
              <SavedViewsPanel
                key={viewsRefreshKey}
                boardId={boardId}
                onApply={(f) => {
                  applyFilters(f);
                  setShowViews(false);
                }}
              />
            </PopoverContent>
          </Popover>

          {/* ── Clear all ── */}
          {activeCount > 0 && (
            <button
              onClick={clearAll}
              className={cn(filterBtnBase, "bg-rose-500 dark:bg-rose-600 shadow-[0_2px_8px_rgba(244,63,94,0.4)] focus-visible:ring-rose-400")}
            >
              <X className="h-3.5 w-3.5" />
              Clear ({activeCount})
            </button>
          )}
        </div>
      </div>

      {/* Active filter chips */}
      {activeCount > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          {filters.assigneeIds.map((id) => {
            const m = members.find((m) => m.id === id);
            return (
              <FilterChip key={`a-${id}`} label={m ? m.name : id} onRemove={() => toggleAssignee(id)} />
            );
          })}
          {filters.priorities.map((p) => (
            <FilterChip key={`p-${p}`} label={PRIORITY_LABELS[p] ?? p} onRemove={() => togglePriority(p)} />
          ))}
          {filters.labelIds.map((id) => {
            const l = labels.find((l) => l.id === id);
            return <FilterChip key={`l-${id}`} label={l?.name ?? id} onRemove={() => toggleLabel(id)} />;
          })}
          {(filters.dueDateFrom || filters.dueDateTo) && (
            <FilterChip
              label={
                filters.dueDateFrom && filters.dueDateTo
                  ? `${formatDateSafe(filters.dueDateFrom, "MMM d")} – ${formatDateSafe(filters.dueDateTo, "MMM d")}`
                  : filters.dueDateFrom
                  ? `From ${formatDateSafe(filters.dueDateFrom, "MMM d")}`
                  : `Until ${formatDateSafe(filters.dueDateTo, "MMM d")}`
              }
              onRemove={() => applyFilters({ ...filters, dueDateFrom: undefined, dueDateTo: undefined })}
            />
          )}
          {filters.overdue && (
            <FilterChip label="Overdue" onRemove={() => applyFilters({ ...filters, overdue: false })} />
          )}
          {(filters.listIds ?? []).map((id) => {
            const l = lists.find((l) => l.id === id);
            return <FilterChip key={`li-${id}`} label={l?.title ?? id} onRemove={() => toggleList(id)} />;
          })}
          {filters.search && (
            <FilterChip label={`"${filters.search}"`} onRemove={() => applyFilters({ ...filters, search: undefined })} />
          )}
        </div>
      )}

      {/* Save View Dialog */}
      <SaveViewDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        boardId={boardId}
        filters={filters}
        onSaved={() => setViewsRefreshKey((k) => k + 1)}
      />
    </div>
  );
}

export { type FilterState as BoardFilterState };
