"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@prisma/client";
import { MoreHorizontal, Trash2 } from "lucide-react"; 
import { motion } from "framer-motion";
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
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ 
        duration: 0.2, 
        ease: "easeOut",
        delay: index * 0.05 // Senior "Stagger" effect - each card animates slightly after the previous
      }}
      // ONLY WAY TO EDIT: Click the card body
      onClick={() => cardModal.onOpen(data.id)}
      className="group relative border-2 border-transparent hover:border-indigo-200/50 py-3 px-4 text-sm bg-white/90 backdrop-blur-sm rounded-xl shadow-sm hover:shadow-lg cursor-pointer min-h-9 flex items-center justify-between transition-all duration-300"
    >
        {/* Title Display */}
        <span className="truncate block pr-6 h-5 w-full font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">
            {data.title} 
        </span>

        {/* 3 DOTS MENU (Delete Only) */}
        <div className="absolute right-1 top-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-slate-400 hover:text-slate-900 hover:bg-slate-100 focus:opacity-100 rounded-lg transition-all hover:scale-110"
                        onClick={(e) => e.stopPropagation()} 
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                
                <DropdownMenuContent align="end" side="bottom" className="w-auto pb-2">
                    <DropdownMenuItem 
                        onClick={handleDelete}
                        className="text-rose-600 cursor-pointer hover:text-rose-700! hover:bg-rose-50! font-semibold text-xs px-3 py-2 rounded-lg"
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