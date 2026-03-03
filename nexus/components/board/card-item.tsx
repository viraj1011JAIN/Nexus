"use client";

import { memo, type CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@prisma/client";
import { Clock, Lock, CheckSquare, Check, Paperclip, GripVertical } from "lucide-react";
import { useBulkSelection } from "@/lib/bulk-selection-context";
import { motion, useReducedMotion } from "framer-motion";
import { deleteCard } from "@/actions/delete-card";
import { useParams } from "next/navigation";
import { useCardModal } from "@/hooks/use-card-modal";
import { format, isPast, differenceInHours } from "date-fns";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Tiny priority dot — one visual cue, no noise
const PRIORITY_DOT_CLASS: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH:   "bg-orange-400",
  MEDIUM: "bg-sky-400",
  LOW:    "bg-emerald-400",
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
  const isSelected = selectedIds.includes(data.id);
  const prefersReducedMotion = useReducedMotion();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
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
      style={{ ...style, animationDelay: `${index * 0.07}s` }}
      {...attributes}
      aria-label={cardAriaLabel}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (isBulkMode) { toggleCard(data.id); return; }
          cardModal.onOpen(data.id);
        }
      }}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? {} : { opacity: 0, scale: 0.98 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.14, ease: [0.4, 0, 0.2, 1] }}
      onClick={() => {
        if (isBulkMode) { toggleCard(data.id); return; }
        cardModal.onOpen(data.id);
      }}
      className={cn(
        "group relative cursor-pointer animate-card-enter rounded-xl kanban-card",
        "bg-white dark:bg-[#1C1824]",
        "border border-gray-100 dark:border-white/[0.07]",
        "shadow-sm hover:shadow-md hover:border-violet-200/70 dark:hover:border-violet-400/20",
        "transition-all duration-150",
        isDragging && "opacity-40",
        isSelected && "ring-2 ring-violet-500/70 ring-offset-1 dark:ring-offset-[#0D0C14]"
      )}
    >
      {/* Cover image / colour swatch */}
      {(data.coverImageUrl || data.coverColor) && (
        <div
          className={cn(
            "h-10 w-full rounded-t-[11px]",
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

      <div className="px-3 py-2.5">
        {/* Row 1 — optional priority dot · title · actions */}
        <div className="flex items-start gap-2">
          {isBulkMode ? (
            <label
              className="mt-0.75 shrink-0 cursor-pointer"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={isSelected}
                className="sr-only"
                aria-label={`Select card: ${data.title}`}
                onChange={() => toggleCard(data.id)}
              />
              <div className={cn(
                "h-4 w-4 rounded border-2 flex items-center justify-center transition-all duration-150",
                isSelected ? "bg-violet-600 border-violet-600" : "border-gray-300 dark:border-white/20"
              )}>
                {isSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
              </div>
            </label>
          ) : data.priority ? (
            <span
              aria-hidden="true"
              className={cn("mt-[5px] w-1.5 h-1.5 rounded-full shrink-0", PRIORITY_DOT_CLASS[data.priority])}
            />
          ) : null}

          <p className="flex-1 min-w-0 text-[13px] font-medium leading-[1.45] text-gray-800 dark:text-gray-100 line-clamp-2">
            {data.title}
          </p>

          {/* Grip + 3-dot — touch: always visible; pointer: reveal on hover */}
          <div
            className={cn(
              "flex items-center gap-0.5 shrink-0 -mt-0.5 -mr-0.5",
              "opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100",
              "transition-opacity duration-150"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              {...listeners}
              aria-label="Drag to reorder card"
              className="w-6 h-6 flex items-center justify-center rounded-md text-gray-300 dark:text-white/20 hover:text-gray-500 dark:hover:text-white/50 hover:bg-gray-100 dark:hover:bg-white/[0.07] cursor-grab active:cursor-grabbing touch-none select-none transition-colors duration-100"
            >
              <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-md text-gray-300 dark:text-white/20 hover:text-gray-500 dark:hover:text-white/50 hover:bg-gray-100 dark:hover:bg-white/[0.07]"
                  aria-label="Card options"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom">
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-red-600 dark:text-red-400 cursor-pointer text-xs px-3 py-2 font-medium"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Delete card
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Row 2 — metadata footer (only rendered when data is present) */}
        {(data.dueDate ||
          data.storyPoints != null ||
          (data._count?.attachments ?? 0) > 0 ||
          (data._count?.dependencies ?? 0) > 0 ||
          data.checklists?.some((c) => c.items.length > 0)) && (
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {data.dueDate && (
              <span
                aria-label={isOverdue ? `Overdue: ${format(new Date(data.dueDate), "MMM d")}` : isDueSoon ? `Due soon: ${format(new Date(data.dueDate), "MMM d")}` : `Due ${format(new Date(data.dueDate), "MMM d")}`}
                className={cn(
                  "inline-flex items-center gap-1 text-[11px] font-medium",
                  isOverdue ? "text-red-500" : isDueSoon ? "text-amber-500" : "text-gray-400 dark:text-white/35"
                )}
              >
                <Clock className="w-3 h-3" aria-hidden="true" />
                <span>{format(new Date(data.dueDate), "MMM d")}</span>
              </span>
            )}

            {(() => {
              if (!data.checklists?.length) return null;
              const all = data.checklists.flatMap((c) => c.items);
              if (!all.length) return null;
              const done = all.filter((i) => i.isComplete).length;
              return (
                <span
                  aria-label={`Checklist: ${done} of ${all.length} complete`}
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px] font-medium",
                    done === all.length ? "text-emerald-500" : "text-gray-400 dark:text-white/35"
                  )}
                >
                  <CheckSquare className="w-3 h-3" aria-hidden="true" />
                  <span aria-hidden="true">{done}/{all.length}</span>
                </span>
              );
            })()}

            {(data._count?.attachments ?? 0) > 0 && (
              <span
                aria-label={`${data._count!.attachments} attachment${data._count!.attachments === 1 ? "" : "s"}`}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 dark:text-white/35"
              >
                <Paperclip className="w-3 h-3" aria-hidden="true" />
                <span aria-hidden="true">{data._count!.attachments}</span>
              </span>
            )}

            {(data._count?.dependencies ?? 0) > 0 && (
              <span
                aria-label={`Blocked by ${data._count!.dependencies} card${data._count!.dependencies === 1 ? "" : "s"}`}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400"
              >
                <Lock className="w-3 h-3" aria-hidden="true" />
                <span aria-hidden="true">{data._count!.dependencies}</span>
              </span>
            )}

            {data.storyPoints != null && (
              <span
                aria-label={`${data.storyPoints} story point${data.storyPoints === 1 ? "" : "s"}`}
                className="ml-auto text-[11px] font-semibold tabular-nums text-gray-300 dark:text-white/25"
              >
                {data.storyPoints}<span className="font-normal opacity-70">pt</span>
              </span>
            )}
          </div>
        )}
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