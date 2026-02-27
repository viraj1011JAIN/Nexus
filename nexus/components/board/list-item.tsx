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
  const { theme } = useTheme();
  const isDark = theme === "dark";
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
      style={{
        ...style,
        width: 280,
        flexShrink: 0,
        userSelect: "none",
        touchAction: "none",
      }}
      {...attributes}
      className="animate-list-enter kanban-list-col"
    >
      {/* List column outer shell */}
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          paddingBottom: 10,
          borderRadius: 14,
        }}
      >
        {/* List Header — drag handle */}
        <div
          {...listeners}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "11px 14px",
            marginBottom: 10,
            background: isDark
              ? `linear-gradient(135deg, ${listColor}18 0%, rgba(255,255,255,0.03) 100%)`
              : `linear-gradient(135deg, ${listColor}0D 0%, #FFFDF9 100%)`,
            border: isDark ? `1px solid ${listColor}35` : `1px solid ${listColor}25`,
            borderTop: `3px solid ${listColor}`,
            borderRadius: "12px 12px 10px 10px",
            boxShadow: isDark
              ? `0 2px 12px ${listColor}18, 0 1px 4px rgba(0,0,0,0.3)`
              : `0 2px 8px rgba(0,0,0,0.05), 0 1px 0 ${listColor}15`,
            cursor: "grab",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
            {/* Color dot — always visible in both themes */}
            <div style={{
              width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
              background: listColor,
              boxShadow: isDark ? `0 0 8px ${listColor}99` : `0 0 4px ${listColor}66`,
            }}/>

            {/* Inline title editing — keep existing logic */}
            {isEditing ? (
              <form ref={formRef} action={handleSubmit} className="flex-1 min-w-0">
                <input hidden name="listId" value={data.id} readOnly />
                <input hidden name="boardId" value={boardId} readOnly />
                <input
                  ref={inputRef}
                  name="title"
                  defaultValue={data.title}
                  onBlur={() => formRef.current?.requestSubmit()}
                  style={{
                    fontSize: 13, fontWeight: 700,
                    width: "100%",
                    background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                    border: `1px solid ${listColor}66`,
                    borderRadius: 6,
                    padding: "2px 8px",
                    outline: "none",
                    color: isDark ? "#E8E4F0" : "#1A1714",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                />
                <button type="submit" hidden />
              </form>
            ) : (
              <span
                onClick={enableEditing}
                style={{
                  fontSize: 13, fontWeight: 700,
                  color: isDark ? "#E8E4F0" : "#1A1714",
                  fontFamily: "'DM Sans', sans-serif",
                  letterSpacing: "-0.01em",
                  cursor: "pointer",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {data.title}
              </span>
            )}

            {/* Card count pill */}
            <span
              style={{
                fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, flexShrink: 0,
                background: `${listColor}20`,
                color: listColor,
                border: `1px solid ${listColor}40`,
              }}
            >
              {data.cards.length}
            </span>
          </div>

          {/* Header actions */}
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {/* Add card button */}
            <button
              onClick={() => cardInputRef.current?.focus()}
              style={{
                width: 26, height: 26, borderRadius: 7, border: "none",
                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                color: isDark ? "rgba(255,255,255,0.4)" : "#9A8F85",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "all 0.15s ease",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = `${listColor}25`;
                (e.currentTarget as HTMLElement).style.color = listColor;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)";
                (e.currentTarget as HTMLElement).style.color = isDark ? "rgba(255,255,255,0.4)" : "#9A8F85";
              }}
            >
              <Plus className="w-3 h-3" />
            </button>

            {/* More menu (delete/rename) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  style={{
                    width: 26, height: 26, borderRadius: 7, border: "none",
                    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                    color: isDark ? "rgba(255,255,255,0.35)" : "#BFB9B3",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <MoreHorizontal className="w-3 h-3" />
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
          <div
            className="flex flex-col gap-y-2 board-scrollbar"
            style={{
              overflow: "hidden auto",
              maxHeight: "calc(100vh - 280px)",
              padding: "0 2px 4px",
            }}
          >
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
        <div style={{ padding: "8px 2px 0" }}>
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

            <div className="flex gap-2 items-center">
              <input
                name="title"
                placeholder="Add a card…"
                onChange={handleCardTitleChange}
                ref={cardInputRef}
                required
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.1)",
                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                  outline: "none",
                  color: isDark ? "#E8E4F0" : "#1A1714",
                  fontSize: 12.5,
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                  transition: "border-color 0.15s ease",
                }}
                onFocus={e => (e.currentTarget.style.borderColor = `${listColor}66`)}
                onBlur={e => (e.currentTarget.style.borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)")}
              />
              <button
                type="submit"
                style={{
                  width: 32, height: 32, borderRadius: 8, border: "none",
                  background: `${listColor}22`,
                  color: listColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", fontSize: 18, fontWeight: 400,
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = `${listColor}40`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = `${listColor}22`;
                }}
              >
                +
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