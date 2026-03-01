"use client";

import { memo, useSyncExternalStore } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, Priority } from "@prisma/client";
import { Clock, Lock, CheckSquare, Check } from "lucide-react";
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
    _count?: { dependencies?: number };
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
        background: isDark ? "rgba(255,255,255,0.04)" : "#FFFDF9",
        border: `1px solid ${isSelected
          ? "rgb(123,47,247)"
          : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"
        }`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)",
        animationDelay: `${index * 0.07}s`,
      }}
      {...attributes}
      {...listeners}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.018, boxShadow: isDark
        ? "0 12px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(123,47,247,0.2)"
        : "0 16px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.07)"
      }}
      whileTap={{ scale: 0.98 }}
      transition={{
        duration: 0.2,
        ease: [0.4, 0, 0.2, 1],
        delay: index * 0.05
      }}
      onClick={() => {
        if (isBulkMode) { toggleCard(data.id); return; }
        cardModal.onOpen(data.id);
      }}
      className={cn(
        "group relative text-sm rounded-[14px] cursor-pointer animate-card-enter touch-manipulation min-h-[72px] overflow-hidden kanban-card",
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
            background: `linear-gradient(to bottom, ${priorityDot}, ${priorityDot}88)`,
            borderRadius: "14px 0 0 14px",
          }}
        />
      )}
      {/* Bulk selection checkbox (top-left overlay — visible only in bulk mode) */}
      {isBulkMode && (
        <div
          role="checkbox"
          tabIndex={0}
          aria-checked={isSelected}
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
      <div
        className="p-3 space-y-2"
        style={{ paddingLeft: priorityDot ? 18 : 12 }}
      >
        {/* Title */}
        <div className="pr-8">
          <span className="block font-semibold text-card-foreground group-hover:text-primary transition-colors line-clamp-2">
            {data.title}
          </span>
        </div>

        {/* Tags Section */}
        <div className="flex flex-wrap gap-1.5 items-center">
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
              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
              isOverdue
                ? "bg-destructive/10 text-destructive"
                : isDueSoon
                ? "bg-warning/10 text-warning"
                : "bg-accent text-muted-foreground"
            )}>
              <Clock className="w-3 h-3" />
              <span>{format(new Date(data.dueDate), "MMM d")}</span>
            </div>
          )}

          {/* Story Points badge */}
          {data.storyPoints !== null && data.storyPoints !== undefined && (
            <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              <span>{data.storyPoints}pt</span>
            </div>
          )}

          {/* Dependency lock icon — card is blocked by others */}
          {(data._count?.dependencies ?? 0) > 0 && (
            <div
              title={`Blocked by ${data._count!.dependencies} card${data._count!.dependencies === 1 ? "" : "s"}`}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
            >
              <Lock className="w-3 h-3" />
              <span>{data._count!.dependencies}</span>
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
            <div className="flex items-center gap-1.5 w-full">
              <CheckSquare className="w-3 h-3 text-muted-foreground shrink-0" />
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    pct === 100 ? "bg-emerald-500" : "bg-blue-400"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">{done}/{total}</span>
            </div>
          );
        })()}
      </div>

      {/* 3 DOTS MENU (Delete Only) */}
      <div className="absolute right-1 top-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent focus:opacity-100 rounded-lg transition-all hover:scale-110"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
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