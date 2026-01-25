"use client";

import { ElementRef, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { List, Card } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { createCard } from "@/actions/create-card";
import { deleteList } from "@/actions/delete-list"; 
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
      console.error("Failed to update list:", result.error);
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
      className="w-72 shrink-0 h-full select-none"
    >
      <div 
        {...listeners} 
        className="w-full rounded-md bg-[#f1f2f4] shadow-md pb-2"
      >
        {/* List Header (Now Switchable!) */}
        <div className="pt-2 px-2 text-sm font-semibold flex justify-between items-start gap-x-2">
          
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
                    onBlur={() => formRef.current?.requestSubmit()} // Save when clicking away
                    className="text-sm font-medium border-transparent h-7 w-full px-[7px] py-1 bg-white focus:bg-white border transition truncate focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-sm"
                    placeholder="Enter list title..."
                />
                <button type="submit" hidden />
             </form>
          ) : (
             /* IF NOT EDITING: Show Title (Click to Edit) */
             <div 
                onClick={enableEditing}
                className="w-full text-sm px-2.5 py-1 h-7 font-medium border-transparent cursor-pointer hover:bg-white/50 rounded-sm transition"
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
                className="h-auto w-auto p-1 text-rose-500 hover:text-rose-600 hover:bg-rose-100"
            >
                <Trash2 className="h-4 w-4" />
            </Button>
          </form>
        </div>

        {/* Cards Area */}
        <SortableContext items={data.cards} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-y-2 mx-1 px-1 py-0.5 mt-2">
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
        <div className="px-2 mt-2">
             <form 
                action={async (formData) => {
                    const title = formData.get("title") as string;
                    const listIdValue = formData.get("listId") as string;
                    const boardIdValue = formData.get("boardId") as string;
                    const result = await createCard({ title, listId: listIdValue, boardId: boardIdValue });
                    if (result.error) {
                        console.error("Failed to create card:", result.error);
                    }
                }} 
                className="mt-2"
             >
                <input hidden name="listId" value={data.id} readOnly />
                <input hidden name="boardId" value={boardId} readOnly />
                
                <div className="flex gap-1 items-center">
                  <input 
                    name="title" 
                    placeholder="Add a card..." 
                    className="w-full px-2 py-1 text-sm border rounded hover:bg-slate-50 focus:bg-white transition outline-none focus:border-sky-500"
                    required
                  />
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" type="submit">
                    +
                  </Button>
                </div>
              </form>
        </div>
      </div>
    </div>
  );
};