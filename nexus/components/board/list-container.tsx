"use client";

import { List, Card } from "@prisma/client";
import { useState, useEffect, useRef } from "react";
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
import { Button } from "@/components/ui/button";
import { createList } from "@/actions/create-list";
import { updateListOrder } from "@/actions/update-list-order"; 
import { updateCardOrder } from "@/actions/update-card-order"; 
import { generateNextOrder } from "@/lib/lexorank"; 

type ListWithCards = List & { cards: Card[] };

interface ListContainerProps {
  boardId: string;
  data: ListWithCards[];
}

export const ListContainer = ({
  boardId,
  data
}: ListContainerProps) => {
  const [orderedData, setOrderedData] = useState(data);
  
  // 1. Create a Ref to track state instantly (Fixes "Stale State" bugs)
  const orderedDataRef = useRef(data);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sync state and ref when data changes
  useEffect(() => {
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
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  );

  const onDragOver = (event: DragOverEvent) => {
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
  };

  const onDragEnd = (event: DragEndEvent) => {
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
  };

  if (!isMounted) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
    >
      <div className="flex gap-4 h-full">
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

        <div className="w-72 shrink-0">
            <form 
                action={async (formData) => {
                    const title = formData.get("title") as string;
                    const boardIdValue = formData.get("boardId") as string;
                    const result = await createList({ title, boardId: boardIdValue });
                    if (result.error) {
                        console.error("Failed to create list:", result.error);
                    }
                }} 
                className="bg-white/80 p-3 rounded-xl flex flex-col gap-2 hover:bg-white transition"
            >
            <input hidden name="boardId" value={boardId} readOnly />
            <input 
                name="title" 
                placeholder="List title..." 
                className="p-2 text-sm border-2 border-transparent focus:border-sky-500 rounded-md outline-none font-medium"
                required
            />
            <Button size="sm" variant="default" className="w-full justify-start">
                + Add List
            </Button>
            </form>
        </div>
      </div>
    </DndContext>
  );
};