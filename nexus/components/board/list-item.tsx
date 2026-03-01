"use client";

import { ElementRef, memo, useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { List, Card } from "@prisma/client";
import { createCard } from "@/actions/create-card";
import { deleteList } from "@/actions/delete-list";
import { logger } from "@/lib/logger";
import { updateList } from "@/actions/update-list";
import { suggestPriority } from "@/actions/ai-actions";
import { CardItem } from "./card-item";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ListWithCards = List & { cards: Card[] };

interface ListItemProps {
  index: number;
  data: ListWithCards;
  boardId: string;
}

const LIST_COLORS = ["#7C3AED","#D97706","#8B5CF6","#059669","#1A73E8","#E0284A"];

const ListItemInner = ({
  index,
  data,
  boardId,
}: ListItemProps) => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted && resolvedTheme === "dark";
  const listColor = LIST_COLORS[index % LIST_COLORS.length];
  // 1. State for Editing
  const [isEditing, setIsEditing] = useState(false);
  const formRef = useRef<ElementRef<"form">>(null);
  const inputRef = useRef<ElementRef<"input">>(null);
  const cardInputRef = useRef<ElementRef<"input">>(null);

  // AI priority suggestion for card creation (TASK-022)
  const [suggestedPriority, setSuggestedPriority] = useState<string | null>(null);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [formPriority, setFormPriority] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Tracks the most-recent request so stale responses are silently discarded.
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const handleCardTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSuggestedPriority(null);
    clearTimeout(debounceRef.current);
    if (value.trim().length < 5) return;
    const currentRequestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      setIsLoadingSuggestion(true);
      try {
        const result = await suggestPriority({ title: value });
        // Ignore stale responses that arrived after a newer request was fired.
        if (requestIdRef.current === currentRequestId && result?.data?.priority) {
          setSuggestedPriority(result.data.priority);
        }
      } catch {
        // Silent fail — suggestion is non-blocking
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setIsLoadingSuggestion(false);
        }
      }
    }, 800);
  };

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
      className="animate-list-enter kanban-list-col w-72 shrink-0 select-none touch-none"
    >
      {/* List column outer shell */}
      <div
        className="w-full flex flex-col rounded-[16px] overflow-hidden"
        style={{
          background: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.018)",
          border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.06)",
          boxShadow: isDark
            ? "0 4px 24px rgba(0,0,0,0.35)"
            : "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        {/* List Header — drag handle */}
        <div
          {...listeners}
          className="flex items-center justify-between px-3.5 pt-3 pb-3 cursor-grab active:cursor-grabbing"
          style={{
            background: isDark
              ? `linear-gradient(135deg, ${listColor}14 0%, rgba(255,255,255,0.02) 100%)`
              : `linear-gradient(135deg, ${listColor}09 0%, rgba(255,253,249,0.8) 100%)`,
            borderBottom: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.05)",
            borderTop: `3px solid ${listColor}`,
          }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Color dot */}
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: listColor, boxShadow: isDark ? `0 0 7px ${listColor}bb` : `0 0 5px ${listColor}77` }}
            />

            {/* Inline title editing */}
            {isEditing ? (
              <form ref={formRef} action={handleSubmit} className="flex-1 min-w-0">
                <input hidden name="listId" value={data.id} readOnly />
                <input hidden name="boardId" value={boardId} readOnly />
                <input
                  ref={inputRef}
                  name="title"
                  defaultValue={data.title}
                  aria-label="List title"
                  onBlur={() => formRef.current?.requestSubmit()}
                  className="w-full text-[13px] font-bold font-sans rounded-[6px] px-2 py-0.5 outline-none bg-black/5 dark:bg-white/8 text-[#1A1714] dark:text-[#E8E4F0]"
                  style={{ border: `1.5px solid ${listColor}80` }}
                />
                <button type="submit" hidden />
              </form>
            ) : (
              <span
                onClick={enableEditing}
                title="Click to rename"
                className="text-[13px] font-bold tracking-[-0.01em] cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap text-[#1A1714] dark:text-[#E8E4F0] hover:text-[#0F0D0B] dark:hover:text-white transition-colors duration-100"
              >
                {data.title}
              </span>
            )}

            {/* Card count pill */}
            <span
              className="shrink-0 text-[10px] font-bold px-1.5 py-px rounded-full leading-none"
              style={{
                background: `${listColor}1A`,
                color: isDark ? `${listColor}` : `${listColor}`,
                border: `1px solid ${listColor}30`,
              }}
            >
              {data.cards.length}
            </span>
          </div>

          {/* Header actions */}
          <div className="flex gap-0.5 shrink-0 ml-2">
            {/* Add card button */}
            <button
              onClick={() => cardInputRef.current?.focus()}
              title="Add card"
              className="w-7 h-7 rounded-[8px] border-none flex items-center justify-center cursor-pointer transition-all duration-150 bg-black/4 dark:bg-white/6 text-[#9A8F85] dark:text-white/40 hover:scale-105"
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = `${listColor}28`;
                (e.currentTarget as HTMLElement).style.color = listColor;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "";
                (e.currentTarget as HTMLElement).style.color = "";
              }}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            {/* More menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  title="List options"
                  className="w-7 h-7 rounded-[8px] border-none flex items-center justify-center cursor-pointer transition-all duration-150 bg-black/4 dark:bg-white/6 text-[#BFB9B3] dark:text-white/30 hover:bg-black/8 dark:hover:bg-white/10 hover:text-[#6B6560] dark:hover:text-white/60"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom" className="w-auto pb-2">
                <DropdownMenuItem asChild>
                  <form action={handleDelete}>
                    <input hidden name="listId" value={data.id} readOnly />
                    <input hidden name="boardId" value={boardId} readOnly />
                    <button
                      type="submit"
                      className="flex items-center gap-2 text-destructive cursor-pointer text-xs px-3 py-2 rounded-lg w-full hover:bg-destructive/10 font-semibold"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete list
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Cards Area */}
        <SortableContext items={data.cards} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-y-2 board-scrollbar overflow-x-hidden overflow-y-auto max-h-[calc(100vh-260px)] px-2.5 py-2.5">
            {data.cards.map((card, cardIndex) => (
              <CardItem
                index={cardIndex}
                key={card.id}
                data={card}
                listColor={listColor}
              />
            ))}
          </div>
        </SortableContext>

        {/* Add Card Form */}
        <div
          className="px-2.5 pb-2.5 pt-1"
          style={{ borderTop: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.04)" }}
        >
          <form
            action={async (formData) => {
              const title = formData.get("title") as string;
              const listIdValue = formData.get("listId") as string;
              const boardIdValue = formData.get("boardId") as string;
              const priority = (formData.get("priority") as string | null) ?? undefined;
              const result = await createCard({
                title,
                listId: listIdValue,
                boardId: boardIdValue,
                ...(priority ? { priority: priority as "URGENT" | "HIGH" | "MEDIUM" | "LOW" } : {}),
              });
              if (result.error) {
                logger.error("Failed to create card", { error: result.error, listId: listIdValue, boardId: boardIdValue });
              }
              setFormPriority(null);
            }}
          >
            <input hidden name="listId" value={data.id} readOnly />
            <input hidden name="boardId" value={boardId} readOnly />
            {formPriority && <input hidden name="priority" value={formPriority} readOnly />}

            <div className="flex gap-1.5 items-center mt-1.5">
              <input
                name="title"
                placeholder="Add a card…"
                aria-label="New card title"
                onChange={handleCardTitleChange}
                ref={cardInputRef}
                required
                className="flex-1 px-3 py-[7px] rounded-[10px] outline-none text-[12.5px] font-medium transition-colors duration-150 bg-black/4 dark:bg-white/5 text-[#1A1714] dark:text-[#E8E4F0] border border-black/8 dark:border-white/8 placeholder:text-black/25 dark:placeholder:text-white/25"
                onFocus={e => (e.currentTarget.style.borderColor = `${listColor}70`)}
                onBlur={e => (e.currentTarget.style.borderColor = "")}
              />
              <button
                type="submit"
                title="Add card"
                className="h-8 w-8 rounded-[10px] border-none shrink-0 flex items-center justify-center cursor-pointer transition-all duration-150 hover:scale-105 active:scale-95"
                style={{ background: `${listColor}20`, color: listColor }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = `${listColor}38`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = `${listColor}20`;
                }}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* AI Priority Suggestion Pill */}
            {isLoadingSuggestion && (
              <p className="text-xs text-muted-foreground mt-1 animate-pulse">✨ Thinking...</p>
            )}
            {suggestedPriority && !isLoadingSuggestion && (
              <div className="flex items-center gap-2 mt-1 text-xs">
                <span className="text-muted-foreground">✨ Suggested:</span>
                <span className={cn(
                  "font-medium",
                  suggestedPriority === "URGENT" && "text-red-500",
                  suggestedPriority === "HIGH"   && "text-orange-500",
                  suggestedPriority === "MEDIUM" && "text-yellow-500",
                  suggestedPriority === "LOW"    && "text-green-500",
                )}>
                  {suggestedPriority}
                </span>
                <button
                  type="button"
                  onClick={() => { setFormPriority(suggestedPriority); setSuggestedPriority(null); }}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Apply
                </button>
                <button
                  type="button"
                  aria-label="Dismiss suggested priority"
                  onClick={() => setSuggestedPriority(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export const ListItem = memo(ListItemInner, (prev, next) => {
  // Only re-render when the list data identity changes or index/boardId changes
  return (
    prev.data === next.data &&
    prev.index === next.index &&
    prev.boardId === next.boardId
  );
});