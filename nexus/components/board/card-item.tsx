"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, Priority } from "@prisma/client";
import { MoreHorizontal, Trash2, Calendar, Clock, User } from "lucide-react"; 
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { deleteCard } from "@/actions/delete-card"; 
import { useParams } from "next/navigation"; 
import { useCardModal } from "@/hooks/use-card-modal";
import { PriorityBadge } from "@/components/priority-badge";
import { format, isPast, differenceInHours } from "date-fns";
import { cn } from "@/lib/utils";
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

  // Calculate due date status
  const isOverdue = data.dueDate && isPast(new Date(data.dueDate));
  const hoursUntilDue = data.dueDate 
    ? differenceInHours(new Date(data.dueDate), new Date())
    : null;
  const isDueSoon = hoursUntilDue !== null && hoursUntilDue > 0 && hoursUntilDue < 24;

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
        ease: [0.4, 0, 0.2, 1],
        delay: index * 0.05
      }}
      onClick={() => cardModal.onOpen(data.id)}
      className="group relative border-2 border-transparent hover:border-indigo-200/50 active:border-indigo-300 p-3 sm:p-4 text-sm bg-white/90 backdrop-blur-sm rounded-xl shadow-sm hover:shadow-lg active:shadow-md cursor-pointer transition-all duration-200 touch-manipulation min-h-[80px]"
    >
      {/* Card Content */}
      <div className="space-y-2">
        {/* Title */}
        <div className="pr-8">
          <span className="block font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors line-clamp-2">
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
                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                : isDueSoon
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            )}>
              <Clock className="w-3 h-3" />
              <span>{format(new Date(data.dueDate), "MMM d")}</span>
            </div>
          )}
        </div>
      </div>

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