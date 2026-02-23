"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, Priority } from "@prisma/client";
import { MoreHorizontal, Trash2, Clock } from "lucide-react"; 
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
      className="group relative text-sm bg-muted hover:bg-accent rounded-lg hover:shadow-md cursor-pointer transition-all duration-200 touch-manipulation min-h-20 overflow-hidden"
    >
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
      <div className="p-3 space-y-2">
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
        </div>
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