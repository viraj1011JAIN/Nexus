"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Users, User, Flag, Clock, AlertTriangle, ChevronDown, ChevronUp,
  BarChart2, Circle,
} from "lucide-react";
import { format, isPast, isToday, parseISO, isValid } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useCardModal } from "@/hooks/use-card-modal";
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { assignUser, unassignUser } from "@/actions/assignee-actions";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkloadCard {
  id: string;
  title: string;
  priority?: string | null;
  dueDate?: Date | string | null;
  listTitle: string;
  listId: string;
  coverColor?: string | null;
}

interface WorkloadMember {
  id: string;
  name: string;
  imageUrl?: string | null;
  cards: WorkloadCard[];
}

interface WorkloadViewProps {
  boardId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lists: any[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  URGENT: { label: "Urgent", color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30", dot: "bg-red-500" },
  HIGH: { label: "High", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30", dot: "bg-orange-500" },
  MEDIUM: { label: "Medium", color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/30", dot: "bg-yellow-400" },
  LOW: { label: "Low", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", dot: "bg-blue-400" },
  NONE: { label: "None", color: "text-slate-400", bg: "bg-slate-50 dark:bg-slate-800", dot: "bg-slate-300" },
};

// Workload thresholds
const HEAVY_THRESHOLD = 8;
const MEDIUM_THRESHOLD = 4;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCapacityLevel(count: number): "light" | "medium" | "heavy" | "overloaded" {
  if (count === 0) return "light";
  if (count <= MEDIUM_THRESHOLD) return "medium";
  if (count <= HEAVY_THRESHOLD) return "heavy";
  return "overloaded";
}

const CAPACITY_CONFIG = {
  light: { label: "Light", barColor: "bg-emerald-400", textColor: "text-emerald-600" },
  medium: { label: "Moderate", barColor: "bg-blue-400", textColor: "text-blue-600" },
  heavy: { label: "Heavy", barColor: "bg-amber-400", textColor: "text-amber-600" },
  overloaded: { label: "Overloaded", barColor: "bg-red-500", textColor: "text-red-600" },
};

function getCardDate(card: WorkloadCard): Date | null {
  if (!card.dueDate) return null;
  const d = typeof card.dueDate === "string" ? parseISO(card.dueDate) : card.dueDate as Date;
  return isValid(d) ? d : null;
}

// ─── WorkloadCardTile ─────────────────────────────────────────────────────────

function WorkloadCardTile({ card }: { card: WorkloadCard }) {
  const { onOpen } = useCardModal();
  const dueDate = getCardDate(card);
  const isOverdue = dueDate ? isPast(dueDate) && !isToday(dueDate) : false;
  const p = PRIORITY_CONFIG[card.priority ?? "NONE"] ?? PRIORITY_CONFIG.NONE;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02, y: -1 }}
            role="button"
            tabIndex={0}
            aria-label={`Open card: ${card.title}`}
            onClick={() => onOpen(card.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(card.id); } }}
            className={cn(
              "relative flex-shrink-0 w-40 cursor-pointer rounded-lg border p-2.5",
              "shadow-sm transition-shadow hover:shadow-md",
              isOverdue
                ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700",
            )}
            style={
              !isOverdue && card.coverColor
                ? { borderLeftWidth: 3, borderLeftColor: card.coverColor }
                : {}
            }
          >
            {/* Priority dot */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={cn("h-2 w-2 rounded-full flex-shrink-0", p.dot)} />
              <span className={cn("text-[10px] font-medium uppercase tracking-wide", p.color)}>
                {p.label}
              </span>
              {isOverdue && <AlertTriangle className="h-3 w-3 text-red-500 ml-auto" />}
            </div>

            {/* Title */}
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200 line-clamp-2 leading-snug">
              {card.title}
            </p>

            {/* List + due date */}
            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Circle className="h-2 w-2" />
              <span className="truncate">{card.listTitle}</span>
            </div>

            {dueDate && (
              <div className={cn(
                "mt-1 flex items-center gap-1 text-[10px]",
                isOverdue ? "text-red-500 font-semibold" : "text-muted-foreground"
              )}>
                <Clock className="h-2.5 w-2.5" />
                {format(dueDate, "MMM d")}
              </div>
            )}
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <p className="font-medium">{card.title}</p>
          {dueDate && (
            <p className={cn("text-xs mt-0.5", isOverdue ? "text-red-400" : "text-muted-foreground")}>
              Due {format(dueDate, "MMM d, yyyy")}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── DraggableCardTile ────────────────────────────────────────────────────────

function DraggableCardTile({
  card,
  currentMemberId,
}: {
  card: WorkloadCard;
  currentMemberId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { currentMemberId },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 9999 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("touch-none cursor-grab active:cursor-grabbing", isDragging && "opacity-30")}
      {...attributes}
      {...listeners}
    >
      <WorkloadCardTile card={card} />
    </div>
  );
}

// ─── MemberRow ────────────────────────────────────────────────────────────────

function MemberRow({ member }: { member: WorkloadMember }) {
  const [expanded, setExpanded] = useState(true);
  const { setNodeRef, isOver } = useDroppable({ id: member.id });
  const capacityLevel = getCapacityLevel(member.cards.length);
  const cap = CAPACITY_CONFIG[capacityLevel];

  // Priority stats 
  const urgentCount = member.cards.filter((c) => c.priority === "URGENT" || c.priority === "HIGH").length;
  const overdueCount = member.cards.filter((c) => {
    const d = getCardDate(c);
    return d ? isPast(d) && !isToday(d) : false;
  }).length;

  const barWidth = Math.min((member.cards.length / HEAVY_THRESHOLD) * 100, 100);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-xl overflow-hidden border transition-all duration-150",
        isOver
          ? "border-indigo-400 ring-2 ring-indigo-400/40 dark:border-indigo-500"
          : "border-slate-200 dark:border-slate-700"
      )}
    >
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${member.name}: ${member.cards.length} cards. Click to ${expanded ? "collapse" : "expand"}`}
        className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(!expanded); } }}
      >
        {/* Avatar */}
        {member.imageUrl ? (
          <img
            src={member.imageUrl}
            alt={member.name}
            className="h-9 w-9 rounded-full object-cover ring-2 ring-white dark:ring-slate-700 shadow-sm"
          />
        ) : (
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white dark:ring-slate-700">
            {member.name[0]?.toUpperCase()}
          </div>
        )}

        {/* Name + stats */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
              {member.name}
            </p>
            <Badge variant="secondary" className="text-xs px-1.5 h-4">
              {member.cards.length} cards
            </Badge>
          </div>

          {/* Capacity bar */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 max-w-[120px] h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", cap.barColor)}
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <span className={cn("text-[10px] font-medium", cap.textColor)}>
              {cap.label}
            </span>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2">
          {urgentCount > 0 && (
            <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs h-5 px-1.5">
              <Flag className="h-2.5 w-2.5 mr-1" />
              {urgentCount} urgent
            </Badge>
          )}
          {overdueCount > 0 && (
            <Badge className="bg-red-100 text-red-700 border-red-200 text-xs h-5 px-1.5">
              <AlertTriangle className="h-2.5 w-2.5 mr-1" />
              {overdueCount} overdue
            </Badge>
          )}
        </div>

        {/* Expand indicator */}
        <span className="text-muted-foreground hover:text-foreground transition-colors ml-2" aria-hidden="true">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </div>

      {/* Cards row */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {member.cards.length === 0 ? (
              <div className="px-4 py-3 text-xs text-muted-foreground italic">
                No cards assigned
              </div>
            ) : (
              <div className="p-4 flex gap-2.5 overflow-x-auto pb-4">
                {member.cards.map((card) => (
                  <DraggableCardTile key={card.id} card={card} currentMemberId={member.id} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── UnassignedRow ────────────────────────────────────────────────────────────

function UnassignedRow({ cards }: { cards: WorkloadCard[] }) {
  const [expanded, setExpanded] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: "__unassigned__" });
  if (cards.length === 0) return null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-xl overflow-hidden border border-dashed transition-all duration-150",
        isOver
          ? "border-indigo-400 ring-2 ring-indigo-400/40 bg-indigo-50/30 dark:bg-indigo-950/10 dark:border-indigo-500"
          : "border-slate-300 dark:border-slate-600"
      )}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`Unassigned: ${cards.length} cards. Click to ${expanded ? "collapse" : "expand"}`}
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(!expanded); } }}
      >
        <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
          <User className="h-4 w-4 text-slate-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Unassigned</p>
          <p className="text-xs text-muted-foreground">{cards.length} cards with no assignee</p>
        </div>
        <span className="ml-auto text-muted-foreground" aria-hidden="true">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4 flex gap-2.5 overflow-x-auto pb-4">
              {cards.map((card) => (
                <DraggableCardTile key={card.id} card={card} currentMemberId="__unassigned__" />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── WorkloadView ─────────────────────────────────────────────────────────────

export function WorkloadView({ boardId, lists }: WorkloadViewProps) {
  // Optimistic override map: cardId → target memberId ("__unassigned__" to unassign)
  const [cardMemberOverrides, setCardMemberOverrides] = useState<Record<string, string>>({});
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Two-pass member→cards map: pass 1 collects member info, pass 2 applies overrides
  const { members, unassigned, allCardsFlat } = useMemo(() => {
    const memberInfoMap = new Map<string, { name: string; imageUrl?: string | null }>();
    const rawCards: Array<{ card: WorkloadCard; originalMemberId: string | null }> = [];

    for (const list of lists ?? []) {
      for (const card of list.cards ?? []) {
        const workloadCard: WorkloadCard = {
          id: card.id,
          title: card.title,
          priority: card.priority,
          dueDate: card.dueDate,
          listTitle: list.title,
          listId: list.id,
          coverColor: card.coverColor,
        };

        if (card.assignee) {
          const memberId = card.assignee.id; // ← correct field (.id, not .userId)
          if (!memberInfoMap.has(memberId)) {
            memberInfoMap.set(memberId, {
              name: card.assignee.name ?? "Unknown",
              imageUrl: card.assignee.imageUrl ?? null,
            });
          }
          rawCards.push({ card: workloadCard, originalMemberId: memberId });
        } else {
          rawCards.push({ card: workloadCard, originalMemberId: null });
        }
      }
    }

    // Pass 2: apply overrides and assemble final member map
    const memberMap = new Map<
      string,
      { id: string; name: string; imageUrl?: string | null; cards: WorkloadCard[] }
    >();
    const unassignedCards: WorkloadCard[] = [];
    const cardMap = new Map<string, WorkloadCard>();

    for (const { card, originalMemberId } of rawCards) {
      cardMap.set(card.id, card);

      const override = cardMemberOverrides[card.id];
      const effectiveMemberId =
        override !== undefined
          ? override === "__unassigned__" ? null : override
          : originalMemberId;

      if (effectiveMemberId) {
        if (!memberMap.has(effectiveMemberId)) {
          const info = memberInfoMap.get(effectiveMemberId);
          memberMap.set(effectiveMemberId, {
            id: effectiveMemberId,
            name: info?.name ?? "Unknown",
            imageUrl: info?.imageUrl ?? null,
            cards: [],
          });
        }
        memberMap.get(effectiveMemberId)!.cards.push(card);
      } else {
        unassignedCards.push(card);
      }
    }

    const sortedMembers = [...memberMap.values()].sort((a, b) => b.cards.length - a.cards.length);
    return { members: sortedMembers, unassigned: unassignedCards, allCardsFlat: cardMap };
  }, [lists, cardMemberOverrides]);

  // Summary stats
  const totalCards = useMemo(
    () => members.reduce((s, m) => s + m.cards.length, 0) + unassigned.length,
    [members, unassigned]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveCardId(null);
    const { active, over } = event;
    if (!over) return;

    const cardId = active.id as string;
    const targetMemberId = over.id as string;
    const currentMemberId = (active.data.current as { currentMemberId: string }).currentMemberId;

    if (targetMemberId === currentMemberId) return; // dropped back on same member

    // Optimistic update
    setCardMemberOverrides((prev) => ({ ...prev, [cardId]: targetMemberId }));

    try {
      if (targetMemberId === "__unassigned__") {
        const result = await unassignUser({ cardId });
        if (result?.error) throw new Error(result.error);
        toast.success("Card unassigned");
      } else {
        const result = await assignUser({ cardId, assigneeId: targetMemberId });
        if (result?.error) throw new Error(result.error);
        toast.success("Card reassigned");
      }
      // Server revalidation will refresh the lists prop; clear stale override
      setCardMemberOverrides((prev) => {
        const next = { ...prev };
        delete next[cardId];
        return next;
      });
    } catch (err) {
      // Revert optimistic update on failure
      setCardMemberOverrides((prev) => {
        const next = { ...prev };
        delete next[cardId];
        return next;
      });
      toast.error(err instanceof Error ? err.message : "Failed to reassign card");
    }
  }, []);

  if (members.length === 0 && unassigned.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No assignments yet</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Assign cards to team members to see workload distribution here.
        </p>
      </div>
    );
  }

  const activeCard = activeCardId ? (allCardsFlat.get(activeCardId) ?? null) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <BarChart2 className="h-4 w-4 text-indigo-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Team Workload
            </h2>
            <p className="text-xs text-muted-foreground">
              {members.length} member{members.length !== 1 ? "s" : ""} · {totalCards} total cards
            </p>
          </div>

          {/* Legend */}
          <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
            {Object.entries(CAPACITY_CONFIG).map(([key, val]) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", val.barColor)} />
                {val.label}
              </span>
            ))}
          </div>
        </div>

        {/* Member rows */}
        <div className="space-y-3">
          {members.map((member) => (
            <MemberRow key={member.id} member={member} />
          ))}
          <UnassignedRow cards={unassigned} />
        </div>
      </div>

      {/* Ghost tile following the pointer during drag */}
      <DragOverlay dropAnimation={null}>
        {activeCard ? (
          <div className="rotate-2 opacity-90 pointer-events-none">
            <WorkloadCardTile card={activeCard} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
