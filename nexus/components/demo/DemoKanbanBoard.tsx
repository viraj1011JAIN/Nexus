"use client";

/**
 * DemoKanbanBoard — self-contained Kanban board for demo mode.
 *
 * Operates purely in-memory via the useDemoData Zustand store.
 * Supports:
 *   - Drag-and-drop cards between lists (@dnd-kit)
 *   - Creating cards (up to DEMO_MAX_CARDS)
 *   - Deleting cards
 *   - Visual priority indicators
 *
 * No server actions, no DB, no realtime — just local state.
 */

import { useState, useRef, useCallback } from "react";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  TouchSensor,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  useDemoData,
  DEMO_MAX_CARDS,
  type DemoCard,
  type DemoList,
} from "@/hooks/use-demo-data";
import { toast } from "sonner";

// ── Priority badge ───────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<string, string> = {
  URGENT: "bg-red-500/15 text-red-400 border-red-500/25",
  HIGH:   "bg-orange-500/15 text-orange-400 border-orange-500/25",
  MEDIUM: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  LOW:    "bg-green-500/15 text-green-400 border-green-500/25",
};

// ── Sortable Card ────────────────────────────────────────────────────────────

function SortableCard({
  card,
  onDelete,
}: {
  card: DemoCard;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: "Card", card },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-start gap-2 p-3 bg-white/[0.04] border border-white/[0.08] rounded-[12px] hover:border-violet-500/30 hover:bg-white/[0.06] transition-all cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-white font-medium leading-snug truncate">
          {card.title}
        </p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span
            className={`text-[10px] font-semibold px-[6px] py-[2px] rounded border ${PRIORITY_STYLES[card.priority]}`}
          >
            {card.priority}
          </span>
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(card.id);
        }}
        className="p-1 rounded-md text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
        aria-label={`Delete card: ${card.title}`}
      >
        <Trash2 className="w-[13px] h-[13px]" />
      </button>
    </div>
  );
}

// ── Card overlay (shown while dragging) ──────────────────────────────────────

function CardOverlay({ card }: { card: DemoCard }) {
  return (
    <div className="p-3 bg-[#1a1928] border border-violet-500/40 rounded-[12px] shadow-xl shadow-violet-500/10 rotate-[2deg]">
      <p className="text-[13px] text-white font-medium">{card.title}</p>
      <span
        className={`inline-block mt-1.5 text-[10px] font-semibold px-[6px] py-[2px] rounded border ${PRIORITY_STYLES[card.priority]}`}
      >
        {card.priority}
      </span>
    </div>
  );
}

// ── List column ──────────────────────────────────────────────────────────────

function DemoListColumn({
  list,
  cards,
  boardId,
}: {
  list: DemoList;
  cards: DemoCard[];
  boardId: string;
}) {
  const { createCard, deleteCard, getTotalCardCount } = useDemoData();
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddCard = () => {
    const title = inputRef.current?.value.trim();
    if (!title) return;

    const result = createCard(list.id, boardId, title);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Card "${title}" created`);
    if (inputRef.current) inputRef.current.value = "";
    setIsAdding(false);
  };

  const handleDelete = (cardId: string) => {
    deleteCard(cardId);
    toast.info("Card deleted");
  };

  const totalCards = getTotalCardCount();

  return (
    <div className="w-[280px] shrink-0 flex flex-col max-h-full">
      {/* List header */}
      <div className="flex items-center justify-between px-3 py-2.5 mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-semibold text-white/80">{list.title}</h3>
          <span className="text-[11px] text-white/30 font-medium bg-white/[0.05] px-1.5 py-0.5 rounded">
            {cards.length}
          </span>
        </div>
        <button
          onClick={() => {
            if (totalCards >= DEMO_MAX_CARDS) {
              toast.error(`Demo limit: max ${DEMO_MAX_CARDS} cards. Sign up for unlimited!`);
              return;
            }
            setIsAdding(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="p-1 rounded-md text-white/30 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
          aria-label={`Add card to ${list.title}`}
        >
          <Plus className="w-[15px] h-[15px]" />
        </button>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto space-y-2 px-1 pb-2 min-h-[60px]">
        <SortableContext
          items={cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((card) => (
            <SortableCard key={card.id} card={card} onDelete={handleDelete} />
          ))}
        </SortableContext>

        {cards.length === 0 && !isAdding && (
          <div className="flex items-center justify-center h-[60px] border border-dashed border-white/[0.08] rounded-[10px] text-[12px] text-white/20">
            Drop cards here
          </div>
        )}
      </div>

      {/* Add card input */}
      {isAdding && (
        <div className="px-1 pb-2">
          <div className="p-2.5 bg-white/[0.04] border border-white/[0.1] rounded-[10px]">
            <input
              ref={inputRef}
              type="text"
              placeholder="Card title..."
              maxLength={100}
              className="w-full bg-transparent border-none outline-none text-[13px] text-white placeholder:text-white/30 mb-2"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddCard();
                if (e.key === "Escape") setIsAdding(false);
              }}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddCard}
                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-semibold rounded-md transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="p-1.5 text-white/40 hover:text-white/70 transition-colors"
                aria-label="Cancel"
              >
                <X className="w-[14px] h-[14px]" />
              </button>
              <span className="text-[11px] text-white/20 ml-auto">
                {totalCards}/{DEMO_MAX_CARDS}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main DemoKanbanBoard ─────────────────────────────────────────────────────

interface DemoKanbanBoardProps {
  boardId: string;
}

export default function DemoKanbanBoard({ boardId }: DemoKanbanBoardProps) {
  const { cards, moveCardToList, reorderCards, getBoardLists, getListCards } =
    useDemoData();

  const [activeCard, setActiveCard] = useState<DemoCard | null>(null);

  // Local snapshot for DnD manipulations
  const [localCards, setLocalCards] = useState<DemoCard[]>(cards);

  // Keep local in sync with store when not dragging
  const boardLists = getBoardLists(boardId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getCardsForList = useCallback(
    (listId: string) => {
      if (activeCard) {
        // During drag, use local state
        return localCards
          .filter((c) => c.listId === listId)
          .sort((a, b) => a.order.localeCompare(b.order));
      }
      return getListCards(listId);
    },
    [activeCard, localCards, getListCards]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const card = event.active.data.current?.card as DemoCard | undefined;
    if (card) {
      setActiveCard(card);
      setLocalCards([...cards]); // snapshot
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !active.data.current?.card) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const isOverCard = over.data.current?.type === "Card";
    const isOverList = over.data.current?.type === "List";

    if (isOverCard) {
      setLocalCards((prev) => {
        const fromList = prev.find((c) => c.id === activeId)?.listId;
        const toList = prev.find((c) => c.id === overId)?.listId;
        if (!fromList || !toList) return prev;

        if (fromList === toList) return prev; // same list — handled by DragEnd

        // Move card to target list
        const updated = prev.map((c) =>
          c.id === activeId ? { ...c, listId: toList } : c
        );
        return updated;
      });
    }

    if (isOverList) {
      setLocalCards((prev) => {
        const card = prev.find((c) => c.id === activeId);
        if (!card || card.listId === overId) return prev;
        return prev.map((c) =>
          c.id === activeId ? { ...c, listId: overId } : c
        );
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const activeId = active.id as string;
    const card = localCards.find((c) => c.id === activeId);
    if (!card) return;

    const targetListId = card.listId;
    const targetListCards = localCards
      .filter((c) => c.listId === targetListId)
      .sort((a, b) => a.order.localeCompare(b.order));

    const cardIndex = targetListCards.findIndex((c) => c.id === activeId);

    // Commit to store
    moveCardToList(
      activeId,
      active.data.current?.card?.listId ?? targetListId,
      targetListId,
      cardIndex >= 0 ? cardIndex : targetListCards.length
    );

    // Reorder within list
    const orderedIds = targetListCards.map((c) => c.id);
    reorderCards(targetListId, orderedIds);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Press Space to pick up. Use Arrow keys to move. Space to drop, Escape to cancel.",
        },
      }}
    >
      <div className="flex gap-4 items-start overflow-x-auto overflow-y-hidden px-2 py-4 min-h-[400px]">
        {boardLists.map((list) => (
          <DemoListColumn
            key={list.id}
            list={list}
            cards={getCardsForList(list.id)}
            boardId={boardId}
          />
        ))}
      </div>

      <DragOverlay>
        {activeCard ? <CardOverlay card={activeCard} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
