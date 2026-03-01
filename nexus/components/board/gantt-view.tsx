"use client";

/**
 * TASK-011C — Timeline / Gantt View
 *
 * Pure-CSS scrollable Gantt chart. Each card with a startDate and/or dueDate
 * appears as a horizontal bar positioned proportionally across a date range.
 * Cards without dates appear in an "Unscheduled" strip at the bottom.
 *
 * Features:
 *  - Auto-calculates viewport range from min(startDate) to max(dueDate)
 *  - Today line indicator
 *  - Priority-coloured bars
 *  - Click-to-open card modal
 *  - Zoom: Day / Week / Month column widths
 *  - List-grouped rows
 */

import { useState, useMemo, useRef } from "react";
import { addDays, addMonths, differenceInDays, format, startOfDay, endOfDay, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, isToday, isSameMonth } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCardModal } from "@/hooks/use-card-modal";

// ─── Types ─────────────────────────────────────────────────────────────────

interface GanttCard {
  id: string;
  title: string;
  priority?: string | null;
  startDate?: Date | null;
  dueDate?: Date | null;
  listId: string;
  assignee?: { name: string; imageUrl?: string | null } | null;
}

interface GanttList {
  id: string;
  title: string;
  cards: GanttCard[];
}

interface GanttViewProps {
  lists: GanttList[];
}

// ─── Constants ─────────────────────────────────────────────────────────────

type Zoom = "day" | "week" | "month";

const ZOOM_COL_PX: Record<Zoom, number> = {
  day: 40,
  week: 120,
  month: 200,
};

const PRIORITY_BAR_COLORS: Record<string, string> = {
  URGENT: "bg-red-500 dark:bg-red-600",
  HIGH:   "bg-orange-400 dark:bg-orange-500",
  MEDIUM: "bg-indigo-400 dark:bg-indigo-500",
  LOW:    "bg-slate-400 dark:bg-slate-500",
};

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 56;
const LABEL_COL_W = 200;

// ─── Helpers ───────────────────────────────────────────────────────────────

function getColumns(start: Date, end: Date, zoom: Zoom): Date[] {
  if (zoom === "day") return eachDayOfInterval({ start, end });
  if (zoom === "week") return eachWeekOfInterval({ start, end });
  return eachMonthOfInterval({ start, end });
}

function formatColLabel(date: Date, zoom: Zoom): string {
  if (zoom === "day") return format(date, "d");
  if (zoom === "week") return format(date, "MMM d");
  return format(date, "MMM yyyy");
}

function formatColSub(date: Date, zoom: Zoom): string {
  if (zoom === "day") return format(date, "EEE");
  if (zoom === "week") return `W${format(date, "w")}`;
  return format(date, "yyyy");
}

// ─── GanttBar ──────────────────────────────────────────────────────────────

function GanttBar({
  card,
  rangeStart,
  totalDays: _totalDays,
  colWidth,
  zoom,
  containerWidth,
  onOpen,
}: {
  card: GanttCard;
  rangeStart: Date;
  totalDays: number;
  colWidth: number;
  zoom: Zoom;
  containerWidth: number;
  onOpen: (id: string) => void;
}) {
  const start = card.startDate ?? card.dueDate;
  const end   = card.dueDate   ?? card.startDate;
  if (!start || !end) return null;

  const clampedStart = startOfDay(start);
  const clampedEnd   = endOfDay(end);

  const dayOffset = differenceInDays(clampedStart, startOfDay(rangeStart));
  const duration  = Math.max(differenceInDays(clampedEnd, clampedStart) + 1, 1);

  const pxPerDay =
    zoom === "day"   ? colWidth :
    zoom === "week"  ? colWidth / 7 :
    colWidth / 30;

  const left  = Math.max(dayOffset * pxPerDay, 0);
  const width = Math.max(duration * pxPerDay, 24);

  const color = PRIORITY_BAR_COLORS[card.priority ?? "MEDIUM"] ?? PRIORITY_BAR_COLORS.MEDIUM;

  return (
    <div
      className={cn(
        "absolute top-1/2 -translate-y-1/2 h-6 rounded-full flex items-center px-2 cursor-pointer text-white text-xs font-medium truncate shadow select-none transition-opacity hover:opacity-90 active:opacity-75",
        color
      )}
      style={{ left, width: Math.min(width, containerWidth - left - 8) }}
      title={`${card.title}${card.assignee ? ` · ${card.assignee.name}` : ""}`}
      onClick={() => onOpen(card.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(card.id); }}
      aria-label={`Open card: ${card.title}`}
    >
      <span className="truncate">{card.title}</span>
    </div>
  );
}

// ─── GanttView ─────────────────────────────────────────────────────────────

export function GanttView({ lists }: GanttViewProps) {
  const [zoom, setZoom] = useState<Zoom>("week");
  const [offset, setOffset] = useState(0); // months to shift the viewport
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onOpen } = useCardModal();

  // Gather all cards with dates
  const allCards = useMemo(() => lists.flatMap((l) => l.cards), [lists]);
  const datedCards = useMemo(
    () => allCards.filter((c) => c.startDate || c.dueDate),
    [allCards]
  );
  const undatedCards = useMemo(
    () => allCards.filter((c) => !c.startDate && !c.dueDate),
    [allCards]
  );

  // Auto-range: 3 months centred on today if no cards, else min–max dates + padding
  const { rangeStart, rangeEnd } = useMemo(() => {
    const today = new Date();
    if (datedCards.length === 0) {
      return {
        rangeStart: addMonths(today, -1 + offset),
        rangeEnd:   addMonths(today,  2 + offset),
      };
    }
    const dates = datedCards.flatMap((c) => [c.startDate, c.dueDate].filter(Boolean) as Date[]);
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    return {
      rangeStart: addDays(addMonths(min, offset), -7),
      rangeEnd:   addDays(addMonths(max, offset),  7),
    };
  }, [datedCards, offset]);

  const totalDays = differenceInDays(rangeEnd, rangeStart) + 1;

  const colWidth  = ZOOM_COL_PX[zoom];
  const columns   = useMemo(() => getColumns(rangeStart, rangeEnd, zoom), [rangeStart, rangeEnd, zoom]);
  const totalW    = columns.length * colWidth;

  // Today marker position
  const todayOffset = differenceInDays(new Date(), rangeStart);
  const pxPerDay    = zoom === "day" ? colWidth : zoom === "week" ? colWidth / 7 : colWidth / 30;
  const todayX      = todayOffset * pxPerDay;

  return (
    <div className="w-full overflow-hidden border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 select-none">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOffset((o) => o - 1)} aria-label="Shift range back">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs px-2" onClick={() => setOffset(0)}>
            Today
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOffset((o) => o + 1)} aria-label="Shift range forward">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-2">Zoom:</span>
          {(["day", "week", "month"] as Zoom[]).map((z) => (
            <Button
              key={z}
              variant={zoom === z ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs capitalize"
              onClick={() => setZoom(z)}
            >
              {z}
            </Button>
          ))}
        </div>
      </div>

      {/* Gantt area */}
      <div className="flex" style={{ minHeight: 200 }}>
        {/* Row label column — fixed left */}
        <div
          className="shrink-0 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 z-10"
          style={{ width: LABEL_COL_W }}
        >
          {/* Header placeholder */}
          <div style={{ height: HEADER_HEIGHT }} className="border-b border-slate-100 dark:border-slate-700 flex items-end px-3 pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">List / Card</span>
          </div>
          {lists.map((list) => {
            const lCards = list.cards.filter((c) => c.startDate || c.dueDate);
            if (lCards.length === 0) return null;
            return (
              <div key={list.id}>
                {/* List title row */}
                <div
                  className="px-3 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-700"
                  style={{ height: ROW_HEIGHT }}
                >
                  <span className="flex items-center h-full truncate">{list.title}</span>
                </div>
                {lCards.map((card) => (
                  <div
                    key={card.id}
                    className="px-3 flex items-center text-xs text-slate-700 dark:text-slate-300 truncate border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => onOpen(card.id)}
                    title={card.title}
                  >
                    {card.title}
                  </div>
                ))}
              </div>
            );
          })}
          {/* Unscheduled section label */}
          {undatedCards.length > 0 && (
            <div
              className="px-3 py-1 text-xs font-semibold text-slate-400 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-700"
              style={{ height: ROW_HEIGHT }}
            >
              <span className="flex items-center h-full">Unscheduled ({undatedCards.length})</span>
            </div>
          )}
        </div>

        {/* Scrollable chart area */}
        <div className="overflow-x-auto flex-1" ref={scrollRef} aria-label="Gantt chart timeline">
          <div style={{ width: totalW, minWidth: "100%" }}>
            {/* Header row */}
            <div className="flex border-b border-slate-200 dark:border-slate-700" style={{ height: HEADER_HEIGHT }}>
              {columns.map((col, i) => {
                const isCurrentMonth = zoom === "month" ? isSameMonth(col, new Date()) : false;
                const isDayToday     = zoom === "day"   ? isToday(col) : false;
                return (
                  <div
                    key={i}
                    className={cn(
                      "shrink-0 flex flex-col items-center justify-end pb-1 border-r border-slate-100 dark:border-slate-700 text-xs",
                      (isDayToday || isCurrentMonth) && "bg-indigo-50/60 dark:bg-indigo-950/20"
                    )}
                    style={{ width: colWidth }}
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{formatColLabel(col, zoom)}</span>
                    <span className="text-muted-foreground text-[10px]">{formatColSub(col, zoom)}</span>
                  </div>
                );
              })}
            </div>

            {/* Chart rows */}
            <div className="relative">
              {/* Today vertical line */}
              {todayX >= 0 && todayX <= totalW && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-indigo-500/60 z-10 pointer-events-none"
                  style={{ left: todayX }}
                  aria-hidden="true"
                />
              )}

              {/* Alternating column shading */}
              {columns.map((col, i) => (
                <div
                  key={i}
                  className={cn(
                    "absolute top-0 bottom-0 border-r border-slate-50 dark:border-slate-800",
                    i % 2 === 0 ? "bg-transparent" : "bg-slate-50/30 dark:bg-slate-800/10"
                  )}
                  style={{ left: i * colWidth, width: colWidth }}
                  aria-hidden="true"
                />
              ))}

              {/* Bars per list */}
              {lists.map((list) => {
                const lCards = list.cards.filter((c) => c.startDate || c.dueDate);
                if (lCards.length === 0) return null;
                return (
                  <div key={list.id}>
                    {/* List title spacer */}
                    <div
                      className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20"
                      style={{ height: ROW_HEIGHT }}
                    />
                    {lCards.map((card) => (
                      <div
                        key={card.id}
                        className="relative border-b border-slate-50 dark:border-slate-800"
                        style={{ height: ROW_HEIGHT, width: totalW }}
                      >
                        <GanttBar
                          card={card}
                          rangeStart={rangeStart}
                          totalDays={totalDays}
                          colWidth={colWidth}
                          zoom={zoom}
                          containerWidth={totalW}
                          onOpen={onOpen}
                        />
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Unscheduled strip */}
              {undatedCards.length > 0 && (
                <div
                  className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/10 flex items-center px-4 gap-2 flex-wrap"
                  style={{ height: ROW_HEIGHT, width: totalW }}
                >
                  {undatedCards.map((c) => (
                    <button
                      key={c.id}
                      className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                      onClick={() => onOpen(c.id)}
                    >
                      {c.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
        <span className="text-xs text-muted-foreground font-medium">Priority:</span>
        {Object.entries(PRIORITY_BAR_COLORS).map(([p, cls]) => (
          <div key={p} className="flex items-center gap-1">
            <div className={cn("h-2.5 w-5 rounded-full", cls)} />
            <span className="text-xs capitalize text-muted-foreground">{p.toLowerCase()}</span>
          </div>
        ))}
        <div className="flex items-center gap-1 ml-2">
          <div className="h-3 w-0.5 bg-indigo-500" />
          <span className="text-xs text-muted-foreground">Today</span>
        </div>
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          {format(rangeStart, "MMM d")} – {format(rangeEnd, "MMM d, yyyy")}
        </div>
      </div>
    </div>
  );
}
