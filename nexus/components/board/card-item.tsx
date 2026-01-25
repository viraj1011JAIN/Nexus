"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@prisma/client";
import { MoreHorizontal, Trash2 } from "lucide-react"; 
import { Button } from "@/components/ui/button";
import { deleteCard } from "@/actions/delete-card"; 
import { useParams } from "next/navigation"; 
import { useCardModal } from "@/hooks/use-card-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CardItemProps {
  data: Card;
  index: number;
}

export const CardItem = ({
  data,
  index,
}: CardItemProps) => {
  const params = useParams(); 
  const cardModal = useCardModal();

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      // ONLY WAY TO EDIT: Click the card body
      onClick={() => cardModal.onOpen(data.id)}
      className="group relative border-2 border-transparent hover:border-black/5 py-2 px-3 text-sm bg-white rounded-md shadow-sm cursor-pointer min-h-[36px] flex items-center justify-between transition-colors"
    >
        {/* Title Display */}
        <span className="truncate block pr-6 h-5 w-full font-medium text-neutral-700">
            {data.title} 
        </span>

        {/* 3 DOTS MENU (Delete Only) */}
        <div className="absolute right-1 top-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-neutral-500 hover:text-neutral-900 focus:opacity-100"
                        onClick={(e) => e.stopPropagation()} 
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                
                <DropdownMenuContent align="end" side="bottom" className="w-auto pb-2">
                    <DropdownMenuItem 
                        onClick={handleDelete}
                        className="text-rose-600 cursor-pointer hover:!text-rose-700 hover:!bg-rose-50 font-medium text-xs px-2"
                    >
                        <Trash2 className="h-3 w-3 mr-2" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    </div>
  );
};