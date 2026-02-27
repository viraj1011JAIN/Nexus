"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Clock, LayoutGrid, List,
  AlertTriangle
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, isPast,
  addMonths, subMonths, parseISO, isValid, addWeeks, subWeeks, addDays,
  startOfWeek as getWeekStart,
} from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { updateCard } from "@/actions/update-card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useCardModal } from "@/hooks/use-card-modal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarCard {
  id: string;
  title: string;
  dueDate?: Date | string | null;
  priority?: string | null;
  listId: string;
  listTitle: string;
  boardId: string;
  assigneeImageUrl?: string | null;
  assigneeName?: string | null;
  coverColor?: string | null;
}

interface CalendarViewProps {
  cards: CalendarCard[];
  boardId: string;
  onCardUpdate?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

type CalendarMode = "month" | "week";

const PRIORITY_DOT: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-yellow-400",
  LOW: "bg-blue-400",
  NONE: "bg-slate-300",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns safe inline styles for a card's cover color, handling hex/rgb/hsl/named values. */
function getCardColorStyle(coverColor: string | null | undefined): React.CSSProperties {
  if (!coverColor) return {};
  const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(coverColor);
  if (isHex) {
    return {
      backgroundColor: coverColor + "22",
      borderColor: coverColor + "55",
      color: coverColor,
    };
  }
  // For non-hex colours (rgb, hsl, named) use the value directly without alpha suffix
  return { backgroundColor: coverColor, borderColor: coverColor };
}

function getCardDate(card: CalendarCard): Date | null {
  if (!card.dueDate) return null;
  const d = typeof card.dueDate === "string" ? parseISO(card.dueDate) : card.dueDate;
  return isValid(d) ? d : null;
}

function groupCardsByDay(cards: CalendarCard[], days: Date[]): Map<string, CalendarCard[]> {
  const map = new Map<string, CalendarCard[]>(days.map((d) => [format(d, "yyyy-MM-dd"), []]));
  cards.forEach((card) => {
    const d = getCardDate(card);
    if (!d) return;
    const key = format(d, "yyyy-MM-dd");
    if (map.has(key)) map.get(key)!.push(card);
  });
  return map;
}

// ─── MiniCard ─────────────────────────────────────────────────────────────────

function MiniCard({
  card,
  compact = false,
}: {
  card: CalendarCard;
  compact?: boolean;
}) {
  const { onOpen } = useCardModal();
  const d = getCardDate(card);
  const isOverdue = d ? isPast(d) && !isToday(d) : false;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.1 }}
      onClick={() => onOpen(card.id)}
      title={card.title}
      className={cn(
        "flex items-center gap-1.5 px-1.5 py-0.5 rounded cursor-pointer",
        "text-xs font-medium truncate max-w-full",
        "transition-all hover:shadow-sm select-none",
        isOverdue
          ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
          : card.coverColor
          ? "border"
          : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300",
      )}
      style={
        !isOverdue && card.coverColor
          ? getCardColorStyle(card.coverColor)
          : {}
      }
    >
      {card.priority && card.priority !== "NONE" && (
        <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", PRIORITY_DOT[card.priority])} />
      )}
      {isOverdue && <AlertTriangle className="h-2.5 w-2.5 flex-shrink-0 text-red-500" />}
      <span className="truncate">{card.title}</span>
      {!compact && card.assigneeImageUrl && (
        <Image
          src={card.assigneeImageUrl}
          alt={card.assigneeName ?? ""}
          width={14}
          height={14}
          className="h-3.5 w-3.5 rounded-full flex-shrink-0 ml-auto"
        />
      )}
    </motion.div>
  );
}

// ─── DayCell ─────────────────────────────────────────────────────────────────

const MAX_VISIBLE = 3;

function DayCell({
  date,
  cards,
  isCurrentMonth,
  onDropCard,
}: {
  date: Date;
  cards: CalendarCard[];
  isCurrentMonth: boolean;
  onDropCard?: (cardId: string, date: Date) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    setIsDragOver(false);
    const cardId = e.dataTransfer.getData("cardId");
    if (cardId && onDropCard) onDropCard(cardId, date);
  };

  const visible = showAll ? cards : cards.slice(0, MAX_VISIBLE);
  const overflow = showAll ? 0 : cards.length - MAX_VISIBLE;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "min-h-[80px] p-1 border-r border-b border-slate-200 dark:border-slate-700 transition-colors",
        !isCurrentMonth && "bg-slate-50 dark:bg-slate-900/50",
        isCurrentMonth && "bg-white dark:bg-slate-900",
        isToday(date) && "bg-indigo-50 dark:bg-indigo-950/20",
        isDragOver && "bg-blue-50 dark:bg-blue-950/20 ring-2 ring-inset ring-blue-400",
      )}
    >
      {/* Day number */}
      <div className={cn(
        "text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full",
        !isCurrentMonth && "text-slate-400 dark:text-slate-600",
        isCurrentMonth && "text-slate-700 dark:text-slate-300",
        isToday(date) && "bg-indigo-500 text-white",
      )}>
        {format(date, "d")}
      </div>

      {/* Cards */}
      <div className="space-y-0.5">
        <AnimatePresence>
          {visible.map((card) => (
            <div
              key={card.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("cardId", card.id)}
            >
              <MiniCard card={card} compact />
            </div>
          ))}
        </AnimatePresence>
        {overflow > 0 && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setShowAll(true)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setShowAll(true); }}
            className="text-[10px] text-muted-foreground pl-1.5 cursor-pointer hover:text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded"
          >
            +{overflow} more
          </div>
        )}
      </div>
    </div>
  );
}

// ─── UnscheduledPanel ─────────────────────────────────────────────────────────

function UnscheduledPanel({ cards }: { cards: CalendarCard[] }) {
  return (
    <div className="w-56 flex-shrink-0 border-l border-slate-200 dark:border-slate-700 flex flex-col">
      <div className="p-3 border-b border-slate-200 dark:border-slate-700">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Unscheduled</p>
        <p className="text-xs text-muted-foreground">{cards.length} card{cards.length !== 1 ? "s" : ""}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {cards.map((card) => (
          <div
            key={card.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("cardId", card.id)}
          >
            <MiniCard key={card.id} card={card} />
          </div>
        ))}
        {cards.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            All cards are scheduled!
          </p>
        )}
      </div>
    </div>
  );
}

// ─── WeekView ─────────────────────────────────────────────────────────────────

function WeekView({
  currentDate,
  cardsByDay,
  onDropCard,
}: {
  currentDate: Date;
  cardsByDay: Map<string, CalendarCard[]>;
  onDropCard: (cardId: string, date: Date) => void;
}) {
  const weekStart = getWeekStart(currentDate, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 6),
  });

  return (
    <div className="flex-1 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              "p-3 text-center",
              isToday(day) && "bg-indigo-50 dark:bg-indigo-950/20"
            )}
          >
            <p className="text-xs font-medium text-muted-foreground">{format(day, "EEE")}</p>
            <p className={cn(
              "text-lg font-bold mx-auto w-9 h-9 flex items-center justify-center rounded-full mt-0.5",
              isToday(day) ? "bg-indigo-500 text-white" : "text-slate-700 dark:text-slate-200"
            )}>
              {format(day, "d")}
            </p>
          </div>
        ))}
      </div>
      {/* Body */}
      <div className="grid grid-cols-7 h-full">
        {weekDays.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const cards = cardsByDay.get(key) ?? [];
          return (
            <DayCell
              key={key}
              date={day}
              cards={cards}
              isCurrentMonth={true}
              onDropCard={onDropCard}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Main CalendarView ────────────────────────────────────────────────────────

export function CalendarView({ cards, boardId, onCardUpdate }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mode, setMode] = useState<CalendarMode>("month");

  const scheduledCards = useMemo(() => cards.filter((c) => getCardDate(c) !== null), [cards]);
  const unscheduledCards = useMemo(() => cards.filter((c) => getCardDate(c) === null), [cards]);

  // Month grid
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const allDays = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [currentDate] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const cardsByDay = useMemo(
    () => groupCardsByDay(cards, allDays),
    [cards, allDays]
  );

  const weekCardsByDay = useMemo(() => {
    const weekStart = getWeekStart(currentDate, { weekStartsOn: 0 });
    const weekDays = eachDayOfInterval({
      start: weekStart,
      end: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
    });
    return groupCardsByDay(cards, weekDays);
  }, [cards, currentDate]);

  const handleDropCard = useCallback(async (cardId: string, date: Date) => {
    try {
      const result = await updateCard({
        id: cardId,
        boardId,
        dueDate: date.toISOString(),
      });
      if (result?.error) { toast.error(result.error); return; }
      toast.success("Due date updated.");
      onCardUpdate?.();
    } catch {
      toast.error("Failed to update due date.");
    }
  }, [boardId, onCardUpdate]);

  const prev = () => {
    if (mode === "month") setCurrentDate((d) => subMonths(d, 1));
    else setCurrentDate((d) => subWeeks(d, 1));
  };
  const next = () => {
    if (mode === "month") setCurrentDate((d) => addMonths(d, 1));
    else setCurrentDate((d) => addWeeks(d, 1));
  };
  const today = () => setCurrentDate(new Date());

  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <TooltipProvider>
      <div className="flex h-full min-h-[600px] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <CalendarIcon className="h-5 w-5 text-indigo-500" />
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {mode === "month" ? format(currentDate, "MMMM yyyy") : `Week of ${format(getWeekStart(currentDate, { weekStartsOn: 0 }), "MMM d, yyyy")}`}
            </h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={prev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={today}>
                Today
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={next}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {/* Stats */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground mr-2">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {scheduledCards.length} scheduled
                </span>
                {unscheduledCards.length > 0 && (
                  <span className="text-amber-500 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {unscheduledCards.length} unscheduled
                  </span>
                )}
              </div>

              {/* View toggle */}
              <div className="flex border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
                <button
                  onClick={() => setMode("month")}
                  className={cn(
                    "px-2.5 py-1.5 text-xs font-medium flex items-center gap-1 transition-colors",
                    mode === "month"
                      ? "bg-indigo-500 text-white"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Month
                </button>
                <button
                  onClick={() => setMode("week")}
                  className={cn(
                    "px-2.5 py-1.5 text-xs font-medium flex items-center gap-1 transition-colors border-l border-slate-200 dark:border-slate-700",
                    mode === "week"
                      ? "bg-indigo-500 text-white"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <List className="h-3.5 w-3.5" />
                  Week
                </button>
              </div>
            </div>
          </div>

          {/* Calendar grid */}
          {mode === "month" ? (
            <div className="flex-1 overflow-auto">
              {/* DOW headers */}
              <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                {DOW.map((d) => (
                  <div key={d} className="text-center py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {d}
                  </div>
                ))}
              </div>
              {/* Days grid */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={format(currentDate, "yyyy-MM")}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-7"
                >
                  {allDays.map((day) => (
                    <DayCell
                      key={format(day, "yyyy-MM-dd")}
                      date={day}
                      cards={cardsByDay.get(format(day, "yyyy-MM-dd")) ?? []}
                      isCurrentMonth={isSameMonth(day, currentDate)}
                      onDropCard={handleDropCard}
                    />
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={format(getWeekStart(currentDate, { weekStartsOn: 0 }), "yyyy-MM-dd")}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 overflow-auto"
              >
                <WeekView
                  currentDate={currentDate}
                  cardsByDay={weekCardsByDay}
                  onDropCard={handleDropCard}
                />
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Unscheduled sidebar */}
        <UnscheduledPanel cards={unscheduledCards} />
      </div>
    </TooltipProvider>
  );
}
