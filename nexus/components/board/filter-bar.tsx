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
          <Bookmark className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
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
      <button onClick={onRemove} className="hover:text-red-500 transition-colors">
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

  // ── Shared button styler ─────────────────────────────────────────────────
  const btnBase = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 30,
    padding: "0 12px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    border: "none",
    transition: "filter 0.15s ease, transform 0.1s ease",
    whiteSpace: "nowrap" as const,
  };

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
            <button style={{ ...btnBase, background: "#7C3AED", color: "#fff", boxShadow: "0 2px 8px rgba(124,58,237,0.45)" }}>
              <User className="h-3.5 w-3.5" />
              Assignees
              {filters.assigneeIds.length > 0 && (
                <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 99, padding: "1px 7px", fontSize: 10 }}>
                  {filters.assigneeIds.length}
                </span>
              )}
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-52 border-0 shadow-xl"
            style={{ background: "#F5F0FF", color: "#2D1B69" }}
          >
            <DropdownMenuLabel style={{ color: "#5B21B6", borderBottom: "1px solid #DDD6FE", marginBottom: 4 }}>
              Filter by Assignee
            </DropdownMenuLabel>
            {members.length === 0 && (
              <DropdownMenuItem disabled style={{ color: "#7C3AED" }}>No members found</DropdownMenuItem>
            )}
            {members.map((m) => (
              <DropdownMenuCheckboxItem
                key={m.id}
                checked={filters.assigneeIds.includes(m.id)}
                onCheckedChange={() => toggleAssignee(m.id)}
                style={{ color: "#2D1B69" }}
              >
                <span className="flex items-center gap-2">
                  {m.imageUrl ? (
                    <Image src={m.imageUrl} alt={m.name} width={20} height={20} className="rounded-full object-cover" />
                  ) : (
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#7C3AED", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
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
            <button style={{ ...btnBase, background: "#EA580C", color: "#fff", boxShadow: "0 2px 8px rgba(234,88,12,0.45)" }}>
              <Flag className="h-3.5 w-3.5" />
              Priority
              {filters.priorities.length > 0 && (
                <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 99, padding: "1px 7px", fontSize: 10 }}>
                  {filters.priorities.length}
                </span>
              )}
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-44 border-0 shadow-xl"
            style={{ background: "#FFF7ED", color: "#431407" }}
          >
            <DropdownMenuLabel style={{ color: "#C2410C", borderBottom: "1px solid #FED7AA", marginBottom: 4 }}>
              Filter by Priority
            </DropdownMenuLabel>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <DropdownMenuCheckboxItem
                key={value}
                checked={filters.priorities.includes(value)}
                onCheckedChange={() => togglePriority(value)}
                style={{ color: "#431407" }}
              >
                <span className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full flex-shrink-0", PRIORITY_COLORS[value])} />
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
              <button style={{ ...btnBase, background: "#059669", color: "#fff", boxShadow: "0 2px 8px rgba(5,150,105,0.45)" }}>
                <Tag className="h-3.5 w-3.5" />
                Labels
                {filters.labelIds.length > 0 && (
                  <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 99, padding: "1px 7px", fontSize: 10 }}>
                    {filters.labelIds.length}
                  </span>
                )}
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-48 border-0 shadow-xl"
              style={{ background: "#ECFDF5", color: "#064E3B" }}
            >
              <DropdownMenuLabel style={{ color: "#047857", borderBottom: "1px solid #A7F3D0", marginBottom: 4 }}>
                Filter by Label
              </DropdownMenuLabel>
              {labels.map((l) => (
                <DropdownMenuCheckboxItem
                  key={l.id}
                  checked={filters.labelIds.includes(l.id)}
                  onCheckedChange={() => toggleLabel(l.id)}
                  style={{ color: "#064E3B" }}
                >
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
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
            <button style={{
              ...btnBase,
              background: (filters.dueDateFrom || filters.dueDateTo || filters.overdue) ? "#BE123C" : "#E11D48",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(225,29,72,0.45)",
            }}>
              <Calendar className="h-3.5 w-3.5" />
              Due Date
              {(filters.dueDateFrom || filters.dueDateTo || filters.overdue) && (
                <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 99, padding: "1px 7px", fontSize: 10 }}>✓</span>
              )}
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-72 border-0 shadow-xl"
            style={{ background: "#FFF1F2", color: "#4C0519", padding: "16px" }}
          >
            <p style={{ fontSize: 13, fontWeight: 700, color: "#BE123C", marginBottom: 12, borderBottom: "1px solid #FECDD3", paddingBottom: 8 }}>
              Due Date Range
            </p>
            <div className="grid grid-cols-2 gap-2" style={{ marginBottom: 12 }}>
              <div className="space-y-1">
                <Label className="text-xs" style={{ color: "#9F1239" }}>From</Label>
                <Input
                  type="date"
                  className="h-8 text-sm"
                  style={{ background: "#FFE4E6", border: "1px solid #FECDD3", color: "#4C0519" }}
                  value={filters.dueDateFrom ?? ""}
                  onChange={(e) => applyFilters({ ...filters, dueDateFrom: e.target.value || undefined })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" style={{ color: "#9F1239" }}>To</Label>
                <Input
                  type="date"
                  className="h-8 text-sm"
                  style={{ background: "#FFE4E6", border: "1px solid #FECDD3", color: "#4C0519" }}
                  value={filters.dueDateTo ?? ""}
                  onChange={(e) => applyFilters({ ...filters, dueDateTo: e.target.value || undefined })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
              <Label htmlFor="overdue-toggle" style={{ fontSize: 13, color: "#9F1239", fontWeight: 500 }}>Overdue only</Label>
              <Switch
                id="overdue-toggle"
                checked={!!filters.overdue}
                onCheckedChange={(v) => applyFilters({ ...filters, overdue: v })}
              />
            </div>
            <button
              onClick={() => applyFilters({ ...filters, dueDateFrom: undefined, dueDateTo: undefined, overdue: false })}
              style={{ width: "100%", padding: "6px", borderRadius: 7, background: "#FFE4E6", border: "1px solid #FECDD3", color: "#BE123C", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              Clear dates
            </button>
          </PopoverContent>
        </Popover>

        {/* ── List ── sky blue */}
        {lists.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button style={{ ...btnBase, background: "#0284C7", color: "#fff", boxShadow: "0 2px 8px rgba(2,132,199,0.45)" }}>
                List
                {(filters.listIds ?? []).length > 0 && (
                  <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 99, padding: "1px 7px", fontSize: 10 }}>
                    {filters.listIds!.length}
                  </span>
                )}
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-48 border-0 shadow-xl"
              style={{ background: "#F0F9FF", color: "#0C4A6E" }}
            >
              <DropdownMenuLabel style={{ color: "#0369A1", borderBottom: "1px solid #BAE6FD", marginBottom: 4 }}>
                Filter by List
              </DropdownMenuLabel>
              {lists.map((l) => (
                <DropdownMenuCheckboxItem
                  key={l.id}
                  checked={(filters.listIds ?? []).includes(l.id)}
                  onCheckedChange={() => toggleList(l.id)}
                  style={{ color: "#0C4A6E" }}
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
              <button style={{ ...btnBase, background: "#0D9488", color: "#fff", boxShadow: "0 2px 8px rgba(13,148,136,0.45)" }}>
                <Bookmark className="h-3.5 w-3.5" />
                Views
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-72 p-0 border-0 shadow-xl"
              sideOffset={4}
              style={{ background: "#F0FDFA", color: "#134E4A" }}
            >
              <div style={{ borderBottom: "1px solid #99F6E4", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0F766E" }}>Saved Views</span>
                <button
                  onClick={() => { setShowViews(false); setShowSaveDialog(true); }}
                  style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#0D9488", background: "#CCFBF1", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
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
              style={{ ...btnBase, background: "#F43F5E", color: "#fff", boxShadow: "0 2px 8px rgba(244,63,94,0.4)" }}
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
