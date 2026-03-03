"use client";

import { memo, useSyncExternalStore, type CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, Priority } from "@prisma/client";
import { Clock, Lock, CheckSquare, Check, Paperclip } from "lucide-react";
import { useBulkSelection } from "@/lib/bulk-selection-context";
import { motion, useReducedMotion } from "framer-motion";
import { deleteCard } from "@/actions/delete-card";
import { useParams } from "next/navigation";
import { useCardModal } from "@/hooks/use-card-modal";
import { PriorityBadge } from "@/components/priority-badge";
import { format, isPast, differenceInHours } from "date-fns";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Priority accent bar gradient classes — Tailwind handles dark/light
const PRIORITY_BAR_CLASSES: Record<string, string> = {
  URGENT: "bg-gradient-to-b from-[#EF4444] to-[#EF444466] dark:from-[#FF4365] dark:to-[#FF436566]",
  HIGH:   "bg-gradient-to-b from-[#F59E0B] to-[#F59E0B66] dark:from-[#FF8C42] dark:to-[#FF8C4266]",
  MEDIUM: "bg-gradient-to-b from-[#06B6D4] to-[#06B6D466] dark:from-[#F5C518] dark:to-[#F5C51866]",
  LOW:    "bg-gradient-to-b from-[#10B981] to-[#10B98166] dark:from-[#4FFFB0] dark:to-[#4FFFB066]",
}

interface CardItemProps {
  data: Card & {
    checklists?: Array<{ items: Array<{ id: string; isComplete: boolean }> }>;
    _count?: { dependencies?: number; attachments?: number };
  };
  index: number;
  listColor?: string;
}

const CardItemInner = ({
  data,
  index,
  listColor: _listColor = "#7C3AED",
}: CardItemProps) => {
  const params = useParams();
  const cardModal = useCardModal();
  const { isBulkMode, selectedIds, toggleCard } = useBulkSelection();
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const isDark = mounted && resolvedTheme === "dark";
  const isSelected = selectedIds.includes(data.id);
  // Respect the OS "Reduce motion" setting (WCAG 2.3.3 Animation from Interactions)
  const prefersReducedMotion = useReducedMotion();

  // Priority bar class for accent bar
  const priorityBarClass = data.priority ? PRIORITY_BAR_CLASSES[data.priority] ?? null : null;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: data.id,
    data: {
      type: "Card",
      card: data,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const handleDelete = async () => {
    const boardId = params.boardId as string;
    await deleteCard(data.id, boardId);
  };

  // Calculate due date status
  const isOverdue = data.dueDate && isPast(new Date(data.dueDate));
  const hoursUntilDue = data.dueDate 
    ? differenceInHours(new Date(data.dueDate), new Date())
    : null;
  const isDueSoon = hoursUntilDue !== null && hoursUntilDue > 0 && hoursUntilDue < 24;

  // Accessible name for the card — summarises key metadata for screen readers.
  // dnd-kit's {…attributes} spreads role="button" + tabIndex + aria-describedby
  // (keyboard instructions). The aria-label gives the button a meaningful name.
  const cardAriaLabel = [
    data.title,
    data.priority
      ? `Priority: ${data.priority.charAt(0) + data.priority.slice(1).toLowerCase()}`
      : null,
    isOverdue
      ? "Overdue"
      : isDueSoon
      ? "Due soon"
      : data.dueDate
      ? `Due ${format(new Date(data.dueDate), "MMM d")}`
      : null,
    (data._count?.dependencies ?? 0) > 0
      ? `Blocked by ${data._count!.dependencies} ${data._count!.dependencies === 1 ? "card" : "cards"}`
      : null,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <motion.div
      ref={setNodeRef}
      style={{
        ...style,
        background: isDark ? "rgba(26,22,36,0.85)" : "#FFFFFF",
        border: `1px solid ${
          isSelected
            ? "rgba(123,47,247,0.7)"
            : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"
        }`,
        boxShadow: isDark
          ? "0 1px 3px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.25)"
          : "0 1px 3px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.04)",
        animationDelay: `${index * 0.07}s`,
      }}
      {...attributes}
      {...listeners}
      aria-label={cardAriaLabel}
      onKeyDown={(e) => {
        // Enter activates the card (open modal / toggle bulk-select).
        // All other keys (Space to pick up, Arrows to move, Escape to cancel)
        // are forwarded to dnd-kit's KeyboardSensor event handler.
        if (e.key === "Enter") {
          e.preventDefault();
          if (isBulkMode) { toggleCard(data.id); return; }
          cardModal.onOpen(data.id);
        } else {
          (listeners?.onKeyDown as React.KeyboardEventHandler | undefined)?.(e);
        }
      }}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? {} : { opacity: 0, scale: 0.97 }}
      whileHover={prefersReducedMotion ? undefined : { scale: 1.012, boxShadow: isDark
        ? "0 8px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(123,47,247,0.25)"
        : "0 8px 24px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.06), 0 0 0 1px rgba(123,47,247,0.1)"
      }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: [0.4, 0, 0.2, 1], delay: prefersReducedMotion ? 0 : index * 0.04 }}
      onClick={() => {
        if (isBulkMode) { toggleCard(data.id); return; }
        cardModal.onOpen(data.id);
      }}
      className={cn(
        "group relative text-sm rounded-2xl cursor-pointer animate-card-enter touch-manipulation overflow-hidden kanban-card",
        isSelected && "ring-2 ring-primary"
      )}
    >
      {/* Priority left accent bar — purely decorative, conveyed by PriorityBadge */}
      {priorityBarClass && (
        <div aria-hidden="true" className={`absolute left-0 top-0 bottom-0 w-0.75 rounded-l-2xl ${priorityBarClass}`} />
      )}
      {/* Bulk selection checkbox (top-left overlay — visible only in bulk mode) */}
      {isBulkMode && (
        <label
          className="absolute top-1.5 left-1.5 z-20 cursor-pointer"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isSelected}
            className="sr-only peer"
            aria-label={`Select card: ${data.title}`}
            onChange={() => toggleCard(data.id)}
          />
          <div
            className={cn(
              "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all duration-150",
              isSelected
                ? "bg-primary border-primary"
                : "bg-white/90 dark:bg-slate-800/90 border-slate-300 group-hover:border-primary"
            )}
          >
            {isSelected && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
          </div>
        </label>
      )}

      {/* Cover Image / Color */}
      {(data.coverImageUrl || data.coverColor) && (
        <div
          className={cn(
            "h-12 w-full rounded-t-lg",
            data.coverImageUrl
              ? "bg-cover bg-center [background-image:var(--cover-img)]"
              : "bg-(--cover-bg)"
          )}
          style={{
            '--cover-img': data.coverImageUrl ? `url(${data.coverImageUrl})` : undefined,
            '--cover-bg': data.coverColor ?? undefined,
          } as CSSProperties}
        />
      )}

      {/* Card Content */}
      <div className={cn("py-3 pr-9 space-y-2.5", priorityBarClass ? "pl-4" : "pl-3")}>
        {/* Title */}
        <p className="text-[13px] font-semibold leading-[1.4] text-[#1A1714] dark:text-[#E8E4F0] group-hover:text-[#7B2FF7] dark:group-hover:text-[#C084FC] transition-colors duration-150 line-clamp-2 pr-1">
          {data.title}
        </p>

        {/* Tags Section */}
        <div className="flex flex-wrap gap-1 items-center">
          {/* Priority Badge */}
          {data.priority && data.priority !== 'LOW' && (
            <PriorityBadge
              priority={data.priority as Priority}
              size="sm"
              animated={false}
            />
          )}

          {/* Due Date Tag */}
          {data.dueDate && (
            <div
              aria-label={
                isOverdue
                  ? `Overdue: ${format(new Date(data.dueDate), "MMM d")}`
                  : isDueSoon
                  ? `Due soon: ${format(new Date(data.dueDate), "MMM d")}`
                  : `Due ${format(new Date(data.dueDate), "MMM d")}`
              }
              className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium",
              isOverdue
                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                : isDueSoon
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-black/5 dark:bg-white/8 text-[#6B6560] dark:text-white/45"
            )}>
              <Clock className="w-3 h-3" aria-hidden="true" />
              <span aria-hidden="true">{format(new Date(data.dueDate), "MMM d")}</span>
            </div>
          )}

          {/* Story Points badge */}
          {data.storyPoints !== null && data.storyPoints !== undefined && (
            <div
              aria-label={`${data.storyPoints} story ${data.storyPoints === 1 ? "point" : "points"}`}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400"
            >
              <span aria-hidden="true">{data.storyPoints}pt</span>
            </div>
          )}

          {/* Dependency lock icon */}
          {(data._count?.dependencies ?? 0) > 0 && (
            <div
              aria-label={`Blocked by ${data._count!.dependencies} ${data._count!.dependencies === 1 ? "card" : "cards"}`}
              title={`Blocked by ${data._count!.dependencies} card${data._count!.dependencies === 1 ? "" : "s"}`}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-600 dark:text-red-400"
            >
              <Lock className="w-3 h-3" aria-hidden="true" />
              <span aria-hidden="true">{data._count!.dependencies}</span>
            </div>
          )}

          {/* Attachment count badge */}
          {(data._count?.attachments ?? 0) > 0 && (
            <div
              aria-label={`${data._count!.attachments} ${data._count!.attachments === 1 ? "attachment" : "attachments"}`}
              title={`${data._count!.attachments} attachment${data._count!.attachments === 1 ? "" : "s"}`}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-black/5 dark:bg-white/8 text-[#6B6560] dark:text-white/45"
            >
              <Paperclip className="w-3 h-3" aria-hidden="true" />
              <span aria-hidden="true">{data._count!.attachments}</span>
            </div>
          )}
        </div>

        {/* Checklist Progress Bar */}
        {(() => {
          if (!data.checklists || data.checklists.length === 0) return null;
          const allItems = data.checklists.flatMap((cl) => cl.items);
          if (allItems.length === 0) return null;
          const done = allItems.filter((i) => i.isComplete).length;
          const total = allItems.length;
          const pct = Math.round((done / total) * 100);
          return (
            <div className="flex items-center gap-2 w-full">
              <CheckSquare className="w-3 h-3 text-[#9A8F85] dark:text-white/35 shrink-0" aria-hidden="true" />
              <div
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Checklist: ${done} of ${total} items complete`}
                className="flex-1 h-1 rounded-full bg-black/8 dark:bg-white/10 overflow-hidden"
              >
                <div
                  aria-hidden="true"
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500 w-(--progress-w)",
                    pct === 100 ? "bg-emerald-500" : "bg-[#7B2FF7]"
                  )}
                  style={{ '--progress-w': `${pct}%` } as CSSProperties}
                />
              </div>
              <span aria-hidden="true" className="text-[10px] font-medium tabular-nums text-[#9A8F85] dark:text-white/35 shrink-0">{done}/{total}</span>
            </div>
          );
        })()}
      </div>

      {/* 3 DOTS MENU */}
      <div className="absolute right-1.5 top-1.5 z-10 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity duration-150">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-lg text-[#9A8F85] dark:text-white/35 hover:text-[#1A1714] dark:hover:text-white hover:bg-black/6 dark:hover:bg-white/10 transition-all"
              aria-label="Card options"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" className="w-auto pb-2">
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive cursor-pointer hover:text-destructive hover:bg-destructive/10 font-semibold text-xs px-3 py-2 rounded-lg"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
};

export const CardItem = memo(CardItemInner, (prev, next) => {
  return (
    prev.data === next.data &&
    prev.listColor === next.listColor &&
    prev.index === next.index
  );
});