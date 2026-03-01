"use client";

import { List, Card } from "@prisma/client";
import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  TouchSensor,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

import { ListItem } from "./list-item";
import { createList } from "@/actions/create-list";
import { useTheme } from "@/components/theme-provider";
import { updateListOrder } from "@/actions/update-list-order"; 
import { updateCardOrder } from "@/actions/update-card-order"; 
import { generateNextOrder } from "@/lib/lexorank";
import { useRealtimeBoard } from "@/hooks/use-realtime-board";

type ListWithCards = List & { cards: Card[] };

interface ListContainerProps {
  boardId: string;
  /** orgId required for tenant-isolated realtime channel subscriptions */
  orgId: string;
  data: ListWithCards[];
}

export const ListContainer = ({
  boardId,
  orgId,
  data
}: ListContainerProps) => {
  const [orderedData, setOrderedData] = useState(data);
  
  // 1. Create a Ref to track state instantly (Fixes "Stale State" bugs)
  const orderedDataRef = useRef(data);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  // 2. Real-time synchronization
  const { isConnected: _isConnected } = useRealtimeBoard({
    boardId,
    orgId,
    onCardCreated: (card) => {
      setOrderedData((prev) => {
        const listIndex = prev.findIndex((list) => list.id === card.listId);
        if (listIndex === -1) return prev;
        
        const newLists = [...prev];
        newLists[listIndex] = {
          ...newLists[listIndex],
          cards: [...newLists[listIndex].cards, card],
        };
        return newLists;
      });
      toast.success(`Card "${card.title}" added by another user`);
    },
    onCardUpdated: (card) => {
      setOrderedData((prev) => {
        return prev.map((list) => ({
          ...list,
          cards: list.cards.map((c) => c.id === card.id ? card : c),
        }));
      });
    },
    onCardDeleted: (cardId) => {
      setOrderedData((prev) => {
        return prev.map((list) => ({
          ...list,
          cards: list.cards.filter((c) => c.id !== cardId),
        }));
      });
      toast.info("Card removed by another user");
    },
    onListCreated: (list) => {
      setOrderedData((prev) => [...prev, { ...list, cards: [] }]);
      toast.success(`List "${list.title}" added by another user`);
    },
    onListUpdated: (list) => {
      setOrderedData((prev) =>
        prev.map((l) => l.id === list.id ? { ...l, ...list } : l)
      );
    },
    onListDeleted: (listId) => {
      setOrderedData((prev) => prev.filter((l) => l.id !== listId));
      toast.info("List removed by another user");
    },
  });

  // Sync state and ref when data changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrderedData(data);
    orderedDataRef.current = data; 
  }, [data]);

  // Keep ref in sync with local state changes
  useEffect(() => {
    orderedDataRef.current = orderedData;
  }, [orderedData]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { 
        delay: 150, 
        tolerance: 8 
      },
    }),
  );

  const onDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Find the containers
    const isActiveACard = active.data.current?.type === "Card";
    const isOverACard = over.data.current?.type === "Card";
    const isOverAList = over.data.current?.type === "List";

    if (!isActiveACard) return;

    // Scenario 1: Dragging over another Card
    if (isActiveACard && isOverACard) {
      setOrderedData((prev) => {
        const activeListIndex = prev.findIndex((list) => list.cards.find((i) => i.id === activeId));
        const overListIndex = prev.findIndex((list) => list.cards.find((i) => i.id === overId));

        if (activeListIndex === -1 || overListIndex === -1 || activeListIndex === overListIndex) {
          return prev;
        }

        // STRICT IMMUTABILITY: Create copies of everything
        const newLists = [...prev];
        const sourceList = newLists[activeListIndex];
        const destList = newLists[overListIndex];
        const movedCard = sourceList.cards.find((c) => c.id === activeId);

        if (!movedCard) return prev;

        // Update Source List
        newLists[activeListIndex] = {
            ...sourceList,
            cards: sourceList.cards.filter((c) => c.id !== activeId)
        };

        // Update Destination List
        newLists[overListIndex] = {
            ...destList,
            cards: [
                ...destList.cards, 
                { ...movedCard, listId: destList.id } // Update listId here
            ]
        };

        return newLists;
      });
    }

    // Scenario 2: Dragging over an empty List
    if (isActiveACard && isOverAList) {
      setOrderedData((prev) => {
        const activeListIndex = prev.findIndex((list) => list.cards.find((i) => i.id === activeId));
        const overListIndex = prev.findIndex((list) => list.id === overId);

        if (activeListIndex === -1 || overListIndex === -1 || activeListIndex === overListIndex) {
          return prev;
        }

        const newLists = [...prev];
        const sourceList = newLists[activeListIndex];
        const destList = newLists[overListIndex];
        const movedCard = sourceList.cards.find((c) => c.id === activeId);

        if (!movedCard) return prev;

        // Update Source List
        newLists[activeListIndex] = {
            ...sourceList,
            cards: sourceList.cards.filter((c) => c.id !== activeId)
        };

        // Update Destination List
        newLists[overListIndex] = {
            ...destList,
            cards: [
                ...destList.cards,
                { ...movedCard, listId: destList.id }
            ]
        };

        return newLists;
      });
    }
  }, []);

  const onDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    
    // USE REF to get the freshest data (Avoids the "Stale State" bug)
    const currentData = orderedDataRef.current;

    const isActiveAList = active.data.current?.type === "List";
    const isOverAList = over.data.current?.type === "List";
    const isActiveACard = active.data.current?.type === "Card";
    const isOverACard = over.data.current?.type === "Card";
    const isOverAContainer = over.data.current?.type === "List";

    // --- CASE A: Reordering LISTS ---
    if (isActiveAList && isOverAList && activeId !== overId) {
        const oldIndex = currentData.findIndex((item) => item.id === activeId);
        const newIndex = currentData.findIndex((item) => item.id === overId);
        const newLists = arrayMove(currentData, oldIndex, newIndex);

        setOrderedData(newLists);
        
        // Trigger Server Action with proper lexorank ordering
        const updates = newLists.reduce((acc, list, index) => {
          // Generate proper lexorank: m, n, o, p, etc.
          let order = "m";
          if (index > 0 && acc[index - 1]) {
            order = generateNextOrder(acc[index - 1].order);
          }
          acc.push({ ...list, order });
          return acc;
        }, [] as typeof newLists);
        updateListOrder(updates, boardId);
    }

    // --- CASE B: Reordering CARDS ---
    if (isActiveACard && isOverACard) {
        const activeListIndex = currentData.findIndex((list) => list.cards.find((i) => i.id === activeId));
        
        if (activeListIndex > -1) {
            const list = currentData[activeListIndex];
            const oldIndex = list.cards.findIndex((item) => item.id === activeId);
            const newIndex = list.cards.findIndex((item) => item.id === overId);

            // Reorder
            const reorderedCards = arrayMove(list.cards, oldIndex, newIndex);
            
            // Update State
            const newOrderedData = [...currentData];
            newOrderedData[activeListIndex] = { ...list, cards: reorderedCards };
            setOrderedData(newOrderedData);

            // Trigger Server Action with proper lexorank ordering
            const updates = reorderedCards.reduce((acc, card, index) => {
              // Generate proper lexorank: m, n, o, p, etc.
              let order = "m";
              if (index > 0 && acc[index - 1]) {
                order = generateNextOrder(acc[index - 1].order);
              }
              acc.push({ ...card, order, listId: list.id });
              return acc;
            }, [] as typeof reorderedCards);
            updateCardOrder(updates, boardId);
        }
    }

    // --- CASE C: Dropped Card into Empty List ---
    if (isActiveACard && isOverAContainer) {
         const listIndex = currentData.findIndex((list) => list.id === overId);
         
         if (listIndex > -1) {
            const list = currentData[listIndex];
            const reorderedCards = list.cards; // Order already managed by DragOver

            // Trigger Server Action to persist the "Move" with proper lexorank
            const updates = reorderedCards.reduce((acc, card, index) => {
              // Generate proper lexorank: m, n, o, p, etc.
              let order = "m";
              if (index > 0 && acc[index - 1]) {
                order = generateNextOrder(acc[index - 1].order);
              }
              acc.push({ ...card, order, listId: list.id });
              return acc;
            }, [] as typeof reorderedCards);
            updateCardOrder(updates, boardId);
         }
    }
  }, [boardId]);

  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const isDark = mounted && resolvedTheme === "dark";

  if (!isMounted) return null;

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Shared horizontal scroller — canvas + footer scroll together */}
      <div
        className="board-scrollbar flex-1 overflow-x-auto overflow-y-hidden flex flex-col pb-9"
      >
      {/* Board canvas */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
      >
        <div
          className="flex gap-3.5 items-start px-6 pt-4.5 pb-2"
        >
          <SortableContext
            items={orderedData.map(item => item.id)}
            strategy={horizontalListSortingStrategy}
          >
            {orderedData.map((list, index) => (
              <ListItem
                key={list.id}
                index={index}
                data={list}
                boardId={boardId}
              />
            ))}
          </SortableContext>

          {/* Add new list column */}
          <div
            className="animate-list-enter w-66.25 shrink-0"
            style={{ animationDelay: `${orderedData.length * 0.08}s` }}
          >
            <form
              action={async (formData) => {
                const title = formData.get("title") as string;
                const boardIdValue = formData.get("boardId") as string;
                const result = await createList({ title, boardId: boardIdValue });
                if (result.error) {
                  logger.error("Failed to create list", { error: result.error, boardId: boardIdValue });
                }
              }}
            >
              <input hidden name="boardId" value={boardId} readOnly />
              {/* Title input */}
              <div className="flex items-center gap-2 px-3.5 py-2.75 mb-2 bg-[#FFFDF9] dark:bg-white/2.5 border border-dashed border-black/10 dark:border-white/10 rounded-xl shadow-[0_1px_6px_rgba(0,0,0,0.04)] dark:shadow-none">
                <input
                  name="title"
                  placeholder="Name this list…"
                  required
                  className="flex-1 bg-transparent border-none outline-none text-[#1A1714] dark:text-[#E8E4F0] text-[13px] font-medium font-sans placeholder:text-[#9A8F85]"
                />
              </div>
              {/* Add List button */}
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl border-none bg-gradient-to-br from-[#7B2FF7] to-[#C01CC4] text-white text-[13px] font-semibold font-sans flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_4px_16px_rgba(123,47,247,0.28)] hover:shadow-[0_6px_24px_rgba(123,47,247,0.42)] transition-shadow duration-200"
              >
                + Add List
              </button>
            </form>
          </div>
        </div>
      </DndContext>

      </div>{/* end shared scroll wrapper */}

      {/* Footer status bar — fixed to the bottom of the viewport */}
      <div className="fixed bottom-0 left-0 right-0 z-50 h-9 px-6 flex items-center justify-between gap-8 bg-[rgba(255,253,249,0.96)] dark:bg-[rgba(13,12,20,0.92)] backdrop-blur-[14px] border-t border-black/7 dark:border-white/6">
        <div className="flex items-center gap-4">
          {orderedData.map((list, i) => {
            const LIST_COLORS = ["#7C3AED","#D97706","#8B5CF6","#059669","#1A73E8","#E0284A"];
            const col = LIST_COLORS[i % LIST_COLORS.length];
            return (
              <div key={list.id} className="flex items-center gap-1.25">
                <div
                  className="w-1.25 h-1.25 rounded-full"
                  style={{ background: col, boxShadow: isDark ? `0 0 4px ${col}66` : "none" }}
                />
                <span className="text-[10.5px] text-[#BFB9B3] dark:text-white/28">
                  {list.title} ·{" "}
                  <span className="text-[#6B6560] dark:text-white/45 font-medium">
                    {list.cards.length}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10.5px] text-[#BFB9B3] dark:text-white/20">Auto-save</span>
          <div
            className="animate-pulse-dot w-1.25 h-1.25 rounded-full bg-[#059669] dark:bg-[#4FFFB0] shadow-[0_0_4px_rgba(5,150,105,0.4)] dark:shadow-[0_0_4px_rgba(79,255,176,0.5)]"
          />
        </div>
      </div>
    </div>
  );
};