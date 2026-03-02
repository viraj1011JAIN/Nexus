"use client";

import { memo, useSyncExternalStore } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, Priority } from "@prisma/client";
import { Clock, Lock, CheckSquare, Check, Paperclip } from "lucide-react";
import { useBulkSelection } from "@/lib/bulk-selection-context";
import { motion } from "framer-motion";
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

// Priority dot colors for the left accent bar
const PRIORITY_DOTS: Record<string, { dark: string; light: string }> = {
  URGENT: { dark: "#FF4365", light: "#EF4444" },
  HIGH:   { dark: "#FF8C42", light: "#F59E0B" },
  MEDIUM: { dark: "#F5C518", light: "#06B6D4" },
  LOW:    { dark: "#4FFFB0", light: "#10B981" },
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

  // Priority dot color for accent bar
  const priorityDot = data.priority
    ? (isDark ? PRIORITY_DOTS[data.priority]?.dark : PRIORITY_DOTS[data.priority]?.light) ?? null
    : null;

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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      whileHover={{ scale: 1.012, boxShadow: isDark
        ? "0 8px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(123,47,247,0.25)"
        : "0 8px 24px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.06), 0 0 0 1px rgba(123,47,247,0.1)"
      }}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1], delay: index * 0.04 }}
      onClick={() => {
        if (isBulkMode) { toggleCard(data.id); return; }
        cardModal.onOpen(data.id);
      }}
      className={cn(
        "group relative text-sm rounded-[12px] cursor-pointer animate-card-enter touch-manipulation overflow-hidden kanban-card",
        isSelected && "ring-2 ring-primary"
      )}
    >
      {/* Priority left accent bar */}
      {priorityDot && (
        <div
          style={{
            position: "absolute",
            left: 0, top: 0, bottom: 0,
            width: 3,
            background: `linear-gradient(to bottom, ${priorityDot}, ${priorityDot}66)`,
            borderRadius: "12px 0 0 12px",
          }}
        />
      )}
      {/* Bulk selection checkbox (top-left overlay — visible only in bulk mode) */}
      {isBulkMode && (
        <div
          role="checkbox"
          tabIndex={0}
          aria-checked={isSelected ? "true" : "false"}
          aria-label={`Select card: ${data.title}`}
          className={cn(
            "absolute top-1.5 left-1.5 z-20 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all duration-150",
            isSelected
              ? "bg-primary border-primary"
              : "bg-white/90 dark:bg-slate-800/90 border-slate-300 group-hover:border-primary"
          )}
          onClick={(e) => { e.stopPropagation(); toggleCard(data.id); }}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              e.preventDefault();
              toggleCard(data.id);
            }
          }}
        >
          {isSelected && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
        </div>
      )}

      {/* Cover Image / Color */}
      {(data.coverImageUrl || data.coverColor) && (
        <div
          className="h-12 w-full rounded-t-lg"
          style={
            data.coverImageUrl
              ? { backgroundImage: `url(${data.coverImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
              : { backgroundColor: data.coverColor ?? undefined }
          }
        />
      )}

      {/* Card Content */}
      <div className={cn("py-3 pr-9 space-y-2.5", priorityDot ? "pl-4" : "pl-3")}>
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
            <div className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium",
              isOverdue
                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                : isDueSoon
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-black/5 dark:bg-white/8 text-[#6B6560] dark:text-white/45"
            )}>
              <Clock className="w-3 h-3" />
              <span>{format(new Date(data.dueDate), "MMM d")}</span>
            </div>
          )}

          {/* Story Points badge */}
          {data.storyPoints !== null && data.storyPoints !== undefined && (
            <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <span>{data.storyPoints}pt</span>
            </div>
          )}

          {/* Dependency lock icon */}
          {(data._count?.dependencies ?? 0) > 0 && (
            <div
              title={`Blocked by ${data._count!.dependencies} card${data._count!.dependencies === 1 ? "" : "s"}`}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-600 dark:text-red-400"
            >
              <Lock className="w-3 h-3" />
              <span>{data._count!.dependencies}</span>
            </div>
          )}

          {/* Attachment count badge */}
          {(data._count?.attachments ?? 0) > 0 && (
            <div
              title={`${data._count!.attachments} attachment${data._count!.attachments === 1 ? "" : "s"}`}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-black/5 dark:bg-white/8 text-[#6B6560] dark:text-white/45"
            >
              <Paperclip className="w-3 h-3" />
              <span>{data._count!.attachments}</span>
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
              <CheckSquare className="w-3 h-3 text-[#9A8F85] dark:text-white/35 shrink-0" />
              <div className="flex-1 h-1 rounded-full bg-black/8 dark:bg-white/10 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500",
                    pct === 100 ? "bg-emerald-500" : "bg-[#7B2FF7]"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] font-medium tabular-nums text-[#9A8F85] dark:text-white/35 shrink-0">{done}/{total}</span>
            </div>
          );
        })()}
      </div>

      {/* 3 DOTS MENU */}
      <div className="absolute right-1.5 top-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
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