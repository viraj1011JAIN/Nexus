"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Map,
  Plus,
  ChevronDown,
  ChevronRight,
  Circle,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Calendar,
  Loader2,
  Trash2,
  Target,
  Layers,
  LayoutList,
  GanttChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getInitiatives,
  createInitiative,
  updateInitiative,
  deleteInitiative,
  createEpic,
  updateEpic,
} from "@/actions/roadmap-actions";
import { format, differenceInDays, isPast, startOfMonth, endOfMonth, addMonths, eachMonthOfInterval, min as dateMin, max as dateMax } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EpicData {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  startDate?: Date | string | null;
  dueDate?: Date | string | null;
  color?: string | null;
  cards: Array<{ id: string; storyPoints?: number | null }>;
  _count?: { cards: number };
}

interface InitiativeData {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  color?: string | null;
  epics: EpicData[];
}

// ─── Status Config ────────────────────────────────────────────────────────────

const INITIATIVE_STATUS = {
  ACTIVE: { icon: Circle, label: "Active", className: "text-green-500" },
  PAUSED: { icon: PauseCircle, label: "Paused", className: "text-yellow-500" },
  COMPLETED: { icon: CheckCircle2, label: "Done", className: "text-blue-500" },
  CANCELLED: { icon: XCircle, label: "Cancelled", className: "text-slate-400" },
};

const EPIC_STATUS = {
  BACKLOG: { label: "Backlog", className: "bg-slate-100 text-slate-600" },
  IN_PROGRESS: { label: "In Progress", className: "bg-blue-100 text-blue-700" },
  DONE: { label: "Done", className: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Cancelled", className: "bg-slate-100 text-slate-500" },
};

const EPIC_COLORS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
];

// ─── Epic Bar (Gantt-like) ────────────────────────────────────────────────────

function EpicBar({ epic }: { epic: EpicData }) {
  const total = epic._count?.cards ?? epic.cards.length;
  // Progress is shown as DONE status = 100%, IN_PROGRESS = 50%, else 0
  const progress = epic.status === "DONE" ? 100 : epic.status === "IN_PROGRESS" ? 50 : 0;
  const totalPoints = epic.cards.reduce((s, c) => s + (c.storyPoints ?? 0), 0);
  const statusInfo = EPIC_STATUS[epic.status as keyof typeof EPIC_STATUS] ?? EPIC_STATUS.BACKLOG;
  const isOverdue = epic.dueDate && isPast(new Date(epic.dueDate)) && epic.status !== "DONE";

  return (
    <div className="flex items-center gap-3 py-2.5 pl-8 pr-4 hover:bg-muted/30 rounded-lg transition-colors">
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: epic.color ?? "#6366f1" }}
      />
      <span className="flex-1 text-sm font-medium truncate">{epic.title}</span>
      <Badge className={cn("text-xs", statusInfo.className)}>{statusInfo.label}</Badge>

      {(epic.startDate || epic.dueDate) && (
        <span className={cn("text-xs text-muted-foreground flex items-center gap-1", isOverdue && "text-red-500")}>
          <Calendar className="h-3 w-3" />
          {epic.startDate ? format(new Date(epic.startDate), "MMM d") : "—"}
          {" → "}
          {epic.dueDate ? format(new Date(epic.dueDate), "MMM d") : "—"}
        </span>
      )}

      <div className="flex items-center gap-2 w-36">
        <Progress value={progress} className="h-1.5 flex-1" />
        <span className="text-xs text-muted-foreground w-10 text-right">{progress}%</span>
      </div>

      <span className="text-xs text-muted-foreground w-16 text-right">
        {totalPoints > 0 ? `${totalPoints}pts` : `${total} cards`}
      </span>
    </div>
  );
}

// ─── Gantt / Timeline View (TASK-023) ─────────────────────────────────────────

/**
 * Renders a horizontal Gantt chart for all initiatives and their epics.
 * Uses pure CSS percentage widths / left offsets — no external chart library.
 */
function GanttView({ initiatives }: { initiatives: InitiativeData[] }) {
  // Collect all dates to derive the visible range
  const allDates: Date[] = [];
  for (const init of initiatives) {
    if (init.startDate) allDates.push(new Date(init.startDate));
    if (init.endDate)   allDates.push(new Date(init.endDate));
    for (const epic of init.epics) {
      if (epic.startDate) allDates.push(new Date(epic.startDate));
      if (epic.dueDate)   allDates.push(new Date(epic.dueDate));
    }
  }

  if (allDates.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        No date ranges set on initiatives. Add start/end dates to see the Gantt chart.
      </div>
    );
  }

  // Expand view by one month on each side for breathing room
  const rangeStart = startOfMonth(addMonths(dateMin(allDates), -1));
  const rangeEnd   = endOfMonth(addMonths(dateMax(allDates),  1));
  const totalDays  = differenceInDays(rangeEnd, rangeStart) || 1;

  const months = eachMonthOfInterval({ start: rangeStart, end: rangeEnd });

  /** Convert a date to a left-offset % */
  const toPct = (d: Date | string) =>
    Math.max(0, Math.min(100, (differenceInDays(new Date(d), rangeStart) / totalDays) * 100));

  /** Convert a duration (days) to a width % */
  const toWidthPct = (start: Date | string, end: Date | string) => {
    const days = differenceInDays(new Date(end), new Date(start));
    return Math.max(0.5, (days / totalDays) * 100);
  };

  return (
    <div className="overflow-auto max-h-[70vh] rounded-xl border bg-white dark:bg-slate-900">
      <div className="min-w-max">
      {/* Month header */}
      <div className="flex border-b bg-slate-50 dark:bg-slate-800/60 sticky top-0 z-10">
        {/* Label column */}
        <div className="w-56 flex-shrink-0 border-r px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Initiative / Epic
        </div>
        {/* Month columns */}
        <div className="flex-1 relative flex min-w-[600px]">
          {months.map((m) => {
            const leftPct = toPct(m);
            const nextMonth = addMonths(m, 1);
            const widthPct = Math.max(0, Math.min(100 - leftPct, toWidthPct(m, nextMonth)));
            return (
              <div
                key={m.toISOString()}
                className="absolute top-0 bottom-0 border-r border-slate-200 dark:border-slate-700 flex items-center px-2"
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              >
                <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                  {format(m, "MMM yyyy")}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rows */}
      <div>
        {initiatives.map((init) => {
          const hasRange = init.startDate && init.endDate;
          const statusInfo = INITIATIVE_STATUS[init.status as keyof typeof INITIATIVE_STATUS] ?? INITIATIVE_STATUS.ACTIVE;
          const StatusIcon = statusInfo.icon;

          return (
            <div key={init.id} className="border-b last:border-0">
              {/* Initiative row */}
              <div className="flex items-center h-12 hover:bg-muted/20 transition-colors">
                <div className="w-56 flex-shrink-0 border-r px-3 flex items-center gap-2 overflow-hidden">
                  <StatusIcon className={cn("h-3.5 w-3.5 flex-shrink-0", statusInfo.className)} />
                  <div className="w-2.5 h-2.5 rounded flex-shrink-0" style={{ backgroundColor: init.color ?? "#6366f1" }} />
                  <span className="text-sm font-medium truncate">{init.title}</span>
                </div>
                <div className="flex-1 relative h-full flex items-center min-w-[600px] px-1">
                  {/* Today marker — rendered only when today is within the visible range */}
                  {(() => { const today = new Date(); return today >= rangeStart && today <= rangeEnd; })() && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-rose-400/60 z-10"
                      style={{ left: `${toPct(new Date())}%` }}
                      title="Today"
                    />
                  )}
                  {/* Initiative bar */}
                  {hasRange && (
                    <div
                      className="absolute h-6 rounded-full flex items-center px-2 overflow-hidden"
                      style={{
                        left: `${toPct(init.startDate!)}%`,
                        width: `${toWidthPct(init.startDate!, init.endDate!)}%`,
                        backgroundColor: init.color ?? "#6366f1",
                        opacity: 0.85,
                      }}
                      title={`${format(new Date(init.startDate!), "MMM d")} → ${format(new Date(init.endDate!), "MMM d")}`}
                    >
                      <span className="text-[10px] text-white font-semibold truncate select-none">
                        {init.title}
                      </span>
                    </div>
                  )}
                  {!hasRange && (
                    <span className="text-[11px] text-muted-foreground/50 ml-2 italic">No dates</span>
                  )}
                </div>
              </div>

              {/* Epic sub-rows */}
              {init.epics.map((epic) => {
                const epicHasRange = epic.startDate && epic.dueDate;
                const epicStatus = EPIC_STATUS[epic.status as keyof typeof EPIC_STATUS] ?? EPIC_STATUS.BACKLOG;
                return (
                  <div key={epic.id} className="flex items-center h-9 bg-slate-50/50 dark:bg-slate-800/20 hover:bg-muted/10 transition-colors">
                    <div className="w-56 flex-shrink-0 border-r px-3 pl-8 flex items-center gap-2 overflow-hidden">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: epic.color ?? "#94a3b8" }} />
                      <span className="text-xs text-muted-foreground truncate">{epic.title}</span>
                      <Badge className={cn("text-[10px] ml-auto flex-shrink-0", epicStatus.className)}>
                        {epicStatus.label}
                      </Badge>
                    </div>
                    <div className="flex-1 relative h-full flex items-center min-w-[600px] px-1">
                      {epicHasRange && (
                        <div
                          className="absolute h-4 rounded-full"
                          style={{
                            left: `${toPct(epic.startDate!)}%`,
                            width: `${toWidthPct(epic.startDate!, epic.dueDate!)}%`,
                            backgroundColor: epic.color ?? "#94a3b8",
                            opacity: 0.7,
                          }}
                          title={`${epic.title}: ${format(new Date(epic.startDate!), "MMM d")} → ${format(new Date(epic.dueDate!), "MMM d")}`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

// ─── Initiative Row ───────────────────────────────────────────────────────────

function InitiativeRow({
  initiative,
  onDelete,
  onRefresh,
  onAddEpic,
}: {
  initiative: InitiativeData;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onAddEpic: (initiativeId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const statusInfo = INITIATIVE_STATUS[initiative.status as keyof typeof INITIATIVE_STATUS] ?? INITIATIVE_STATUS.ACTIVE;
  const StatusIcon = statusInfo.icon;

  const totalCards = initiative.epics.reduce((s, e) => s + (e._count?.cards ?? e.cards.length), 0);
  // Infer done epics from status
  const doneEpics = initiative.epics.filter((e) => e.status === "DONE").length;
  const progress = initiative.epics.length > 0 ? Math.round((doneEpics / initiative.epics.length) * 100) : 0;
  const totalDays = initiative.startDate && initiative.endDate
    ? differenceInDays(new Date(initiative.endDate), new Date(initiative.startDate))
    : null;

  return (
    <div className="bg-white dark:bg-slate-800 border rounded-xl overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-muted/30 transition-colors">
            {open ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
            <StatusIcon className={cn("h-4 w-4 flex-shrink-0", statusInfo.className)} />
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: initiative.color ?? "#6366f1" }}
            />
            <span className="flex-1 font-semibold text-sm">{initiative.title}</span>

            {initiative.epics.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {initiative.epics.length} epic{initiative.epics.length !== 1 ? "s" : ""}
              </span>
            )}
            {(initiative.startDate || initiative.endDate) && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {initiative.startDate ? format(new Date(initiative.startDate), "MMM d, yyyy") : "—"}
                {" → "}
                {initiative.endDate ? format(new Date(initiative.endDate), "MMM d, yyyy") : "—"}
                {totalDays !== null && <span className="text-muted-foreground/60">({totalDays}d)</span>}
              </span>
            )}
            {totalCards > 0 && (
              <div className="flex items-center gap-2 w-28">
                <Progress value={progress} className="h-1.5 flex-1" />
                <span className="text-xs text-muted-foreground w-10 text-right">{progress}%</span>
              </div>
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t">
            {initiative.description && (
              <p className="text-sm text-muted-foreground px-4 py-3 border-b">{initiative.description}</p>
            )}

            {initiative.epics.length === 0 && (
              <div className="px-8 py-4 text-sm text-muted-foreground italic">
                No epics yet. Add an epic to track progress.
              </div>
            )}

            {initiative.epics.map((epic) => (
              <EpicBar key={epic.id} epic={epic} />
            ))}

            <div className="px-4 py-3 border-t flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-blue-600"
                onClick={() => onAddEpic(initiative.id)}
              >
                <Plus className="h-3 w-3" /> Add Epic
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-destructive hover:text-destructive ml-auto"
                onClick={() => onDelete(initiative.id)}
              >
                <Trash2 className="h-3 w-3" /> Delete Initiative
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RoadmapClient() {
  const [initiatives, setInitiatives] = useState<InitiativeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "gantt">("list");
  const [showCreateInit, setShowCreateInit] = useState(false);
  const [showCreateEpic, setShowCreateEpic] = useState(false);
  const [targetInitiativeId, setTargetInitiativeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Initiative form
  const [initTitle, setInitTitle] = useState("");
  const [initDesc, setInitDesc] = useState("");
  const [initStatus, setInitStatus] = useState("ACTIVE");
  const [initStart, setInitStart] = useState("");
  const [initEnd, setInitEnd] = useState("");
  const [initColor, setInitColor] = useState(EPIC_COLORS[0]);

  // Epic form
  const [epicTitle, setEpicTitle] = useState("");
  const [epicStatus, setEpicStatus] = useState("IN_PROGRESS");
  const [epicStart, setEpicStart] = useState("");
  const [epicDue, setEpicDue] = useState("");
  const [epicColor, setEpicColor] = useState(EPIC_COLORS[1]);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getInitiatives();
    if (result.data) setInitiatives(result.data as InitiativeData[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreateInitiative = async () => {
    if (!initTitle.trim()) return;
    setSaving(true);
    try {
      const result = await createInitiative({
        title: initTitle.trim(),
        description: initDesc || undefined,
        status: initStatus,
        startDate: initStart ? new Date(initStart).toISOString() : undefined,
        endDate: initEnd ? new Date(initEnd).toISOString() : undefined,
        color: initColor,
      });
      if (result.error) { toast.error(result.error); return; }
      toast.success("Initiative created!");
      setInitTitle(""); setInitDesc(""); setInitStatus("ACTIVE");
      setInitStart(""); setInitEnd(""); setInitColor(EPIC_COLORS[0]);
      setShowCreateInit(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleCreateEpic = async () => {
    if (!epicTitle.trim() || !targetInitiativeId) return;
    setSaving(true);
    try {
      const result = await createEpic({
        title: epicTitle.trim(),
        status: epicStatus,
        initiativeId: targetInitiativeId,
        startDate: epicStart ? new Date(epicStart).toISOString() : undefined,
        dueDate: epicDue ? new Date(epicDue).toISOString() : undefined,
        color: epicColor,
      });
      if (result.error) { toast.error(result.error); return; }
      toast.success("Epic created!");
      setEpicTitle(""); setEpicStatus("IN_PROGRESS");
      setEpicStart(""); setEpicDue(""); setEpicColor(EPIC_COLORS[1]);
      setShowCreateEpic(false);
      setTargetInitiativeId(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleAddEpic = (initiativeId: string) => {
    setTargetInitiativeId(initiativeId);
    setShowCreateEpic(true);
  };

  const handleDeleteInitiative = async (id: string) => {
    const result = await deleteInitiative(id);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Initiative deleted.");
    await load();
  };

  return (
    <div className="space-y-6 py-6 max-w-6xl mx-auto px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Map className="h-6 w-6 text-indigo-500" /> Roadmap
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Plan and track long-term goals across initiatives and epics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex rounded-lg border overflow-hidden">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="rounded-none h-8 px-3 gap-1.5"
              onClick={() => setViewMode("list")}
            >
              <LayoutList className="h-3.5 w-3.5" /> List
            </Button>
            <Button
              variant={viewMode === "gantt" ? "default" : "ghost"}
              size="sm"
              className="rounded-none h-8 px-3 gap-1.5 border-l"
              onClick={() => setViewMode("gantt")}
            >
              <GanttChart className="h-3.5 w-3.5" /> Timeline
            </Button>
          </div>
          <Button onClick={() => setShowCreateInit(true)} className="gap-1">
            <Plus className="h-4 w-4" /> New Initiative
          </Button>
        </div>
      </div>

      <Separator />

      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && initiatives.length === 0 && (
        <div className="text-center py-24 text-muted-foreground">
          <Map className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p className="text-base font-medium">No initiatives yet.</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Create an initiative to start planning your roadmap.
          </p>
          <Button className="mt-4 gap-1" onClick={() => setShowCreateInit(true)}>
            <Plus className="h-4 w-4" /> Create First Initiative
          </Button>
        </div>
      )}

      {!loading && viewMode === "gantt" && initiatives.length > 0 && (
        <GanttView initiatives={initiatives} />
      )}

      {!loading && viewMode === "list" && (
        <div className="space-y-4">
          {initiatives.map((init) => (
            <InitiativeRow
              key={init.id}
              initiative={init}
              onDelete={handleDeleteInitiative}
              onRefresh={load}
              onAddEpic={handleAddEpic}
            />
          ))}
        </div>
      )}

      {/* Create Initiative Dialog */}
      <Dialog open={showCreateInit} onOpenChange={setShowCreateInit}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-indigo-500" /> Create Initiative
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input value={initTitle} onChange={(e) => setInitTitle(e.target.value)} placeholder="Initiative title *" />
            <Textarea value={initDesc} onChange={(e) => setInitDesc(e.target.value)} placeholder="Description (optional)" rows={2} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Status</label>
                <Select value={initStatus} onValueChange={setInitStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="PAUSED">Paused</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Color</label>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {EPIC_COLORS.slice(0, 6).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={cn("w-5 h-5 rounded-full transition-transform hover:scale-110", initColor === c && "ring-2 ring-offset-1 ring-current scale-110")}
                      style={{ backgroundColor: c }}
                      onClick={() => setInitColor(c)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Start Date</label>
                <Input type="date" value={initStart} onChange={(e) => setInitStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">End Date</label>
                <Input type="date" value={initEnd} onChange={(e) => setInitEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateInit(false)}>Cancel</Button>
            <Button onClick={handleCreateInitiative} disabled={saving || !initTitle.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Initiative
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Epic Dialog */}
      <Dialog open={showCreateEpic} onOpenChange={setShowCreateEpic}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-purple-500" /> Add Epic
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input value={epicTitle} onChange={(e) => setEpicTitle(e.target.value)} placeholder="Epic title *" />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Status</label>
                <Select value={epicStatus} onValueChange={setEpicStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BACKLOG">Backlog</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="DONE">Done</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Color</label>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {EPIC_COLORS.slice(0, 6).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={cn("w-5 h-5 rounded-full transition-transform hover:scale-110", epicColor === c && "ring-2 ring-offset-1 ring-current scale-110")}
                      style={{ backgroundColor: c }}
                      onClick={() => setEpicColor(c)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Start Date</label>
                <Input type="date" value={epicStart} onChange={(e) => setEpicStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Due Date</label>
                <Input type="date" value={epicDue} onChange={(e) => setEpicDue(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateEpic(false)}>Cancel</Button>
            <Button onClick={handleCreateEpic} disabled={saving || !epicTitle.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add Epic
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
