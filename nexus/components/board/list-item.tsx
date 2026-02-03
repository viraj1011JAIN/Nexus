"use client";

import { ElementRef, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { List, Card } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { createCard } from "@/actions/create-card";
import { deleteList } from "@/actions/delete-list";
import { logger } from "@/lib/logger"; 
import { updateList } from "@/actions/update-list"; // <--- Import new action
import { CardItem } from "./card-item";
import { Trash2 } from "lucide-react"; 

type ListWithCards = List & { cards: Card[] };

interface ListItemProps {
  index: number;
  data: ListWithCards;
  boardId: string;
}

export const ListItem = ({
  index,
  data,
  boardId,
}: ListItemProps) => {
  // 1. State for Editing
  const [isEditing, setIsEditing] = useState(false);
  const formRef = useRef<ElementRef<"form">>(null);
  const inputRef = useRef<ElementRef<"input">>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: data.id,
    data: {
      type: "List",
      list: data,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  // 2. Enable Edit Mode
  const enableEditing = () => {
    setIsEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  // 3. Disable Edit Mode
  const disableEditing = () => {
    setIsEditing(false);
  };

  // 4. Handle Save (on Enter or Blur)
  const handleSubmit = async (formData: FormData) => {
    const title = formData.get("title") as string;
    const listId = formData.get("listId") as string;
    const boardId = formData.get("boardId") as string;

    if (title === data.title) {
      disableEditing();
      return;
    }

    const result = await updateList({ id: listId, boardId, title });
    
    if (result.error) {
      logger.error("Failed to update list", { error: result.error, listId, boardId });
    }
    
    disableEditing();
  };

  // Helper for delete
  const handleDelete = async (formData: FormData) => {
    const listId = formData.get("listId") as string;
    const boardId = formData.get("boardId") as string;
    await deleteList(listId, boardId);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="w-72 sm:w-80 shrink-0 h-full select-none animate-fadeInUp touch-manipulation"
    >
      <div 
        {...listeners} 
        className="w-full rounded-xl glass-effect shadow-lg hover:shadow-xl transition-all duration-300 pb-3 border border-white/20"
      >
        {/* List Header (Now Switchable!) */}
        <div className="pt-3 px-3 text-sm font-bold flex justify-between items-start gap-x-2">
          
          {/* IF EDITING: Show Input */}
          {isEditing ? (
             <form 
                ref={formRef}
                action={handleSubmit}
                className="flex-1 px-[2px]"
             >
                <input hidden name="listId" value={data.id} readOnly />
                <input hidden name="boardId" value={boardId} readOnly />
                <input 
                    ref={inputRef}
                    name="title"
                    defaultValue={data.title}
                    onBlur={() => formRef.current?.requestSubmit()}
                    className="text-sm font-bold border-transparent h-8 w-full px-3 py-1 bg-white/90 focus:bg-white border transition truncate focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded-lg shadow-sm"
                    placeholder="Enter list title..."
                />
                <button type="submit" hidden />
             </form>
          ) : (
             /* IF NOT EDITING: Show Title (Click to Edit) */
             <div 
                onClick={enableEditing}
                className="w-full text-sm px-3 py-1.5 h-8 font-bold border-transparent cursor-pointer hover:bg-white/60 rounded-lg transition-all text-slate-800"
             >
               {data.title}
             </div>
          )}
          
          {/* DELETE BUTTON */}
          <form action={handleDelete}>
            <input hidden name="listId" value={data.id} readOnly />
            <input hidden name="boardId" value={boardId} readOnly />
            <Button 
                size="sm" 
                variant="ghost" 
                className="h-auto w-auto p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all hover:scale-110 active:scale-95"
            >
                <Trash2 className="h-4 w-4" />
            </Button>
          </form>
        </div>

        {/* Cards Area */}
        <SortableContext items={data.cards} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-y-2.5 mx-2 px-1 py-0.5 mt-3">
            {data.cards.map((card, index) => (
              <CardItem
                index={index}
                key={card.id}
                data={card}
              />
            ))}
          </div>
        </SortableContext>

        {/* Add Card Form */}
        <div className="px-3 mt-3">
             <form 
                action={async (formData) => {
                    const title = formData.get("title") as string;
                    const listIdValue = formData.get("listId") as string;
                    const boardIdValue = formData.get("boardId") as string;
                    const result = await createCard({ title, listId: listIdValue, boardId: boardIdValue });
                    if (result.error) {
                        logger.error("Failed to create card", { error: result.error, listId: listIdValue, boardId: boardIdValue });
                    }
                }} 
                className="mt-2"
             >
                <input hidden name="listId" value={data.id} readOnly />
                <input hidden name="boardId" value={boardId} readOnly />
                
                <div className="flex gap-2 items-center">
                  <input 
                    name="title" 
                    placeholder="Add a card..." 
                    className="flex-1 px-3 py-2 text-sm border-0 rounded-lg bg-white/80 hover:bg-white focus:bg-white transition-all outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm font-medium placeholder:text-slate-400"
                    required
                  />
                  <Button size="sm" className="h-8 w-8 p-0 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm hover:scale-110 active:scale-95 transition-all" type="submit">
                    +
                  </Button>
                </div>
              </form>
        </div>
      </div>
    </div>
  );
};