"use client";

import { useState, useRef } from "react";
import { CheckSquare, Plus, Trash2, MoreHorizontal, Pencil } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  addChecklist,
  renameChecklist,
  deleteChecklist,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  getChecklists,
} from "@/actions/checklist-actions";

// ─── Types ─────────────────────────────────────────────────────────────────

interface ChecklistItemData {
  id: string;
  title: string;
  isComplete: boolean;
  dueDate: Date | null;
  assigneeId: string | null;
  completedAt: Date | null;
  checklistId: string;
}

interface ChecklistData {
  id: string;
  title: string;
  cardId: string;
  items: ChecklistItemData[];
}

interface ChecklistPanelProps {
  cardId: string;
  boardId: string;
  initialChecklists: ChecklistData[];
}

// ─── Progress Bar ───────────────────────────────────────────────────────────

function ChecklistProgress({ items }: { items: ChecklistItemData[] }) {
  if (items.length === 0) return null;
  const done = items.filter((i) => i.isComplete).length;
  const pct = Math.round((done / items.length) * 100);

  return (
    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
      <span className="w-8 shrink-0 text-right font-medium">{pct}%</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <motion.div
          className={cn(
            "h-full rounded-full transition-all",
            pct === 100 ? "bg-emerald-500" : "bg-blue-500"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
      <span>{done}/{items.length}</span>
    </div>
  );
}

// ─── Single Checklist ───────────────────────────────────────────────────────

function Checklist({
  checklist,
  boardId,
  onUpdate,
}: {
  checklist: ChecklistData;
  boardId: string;
  onUpdate: (updated: ChecklistData) => void;
  onDelete: (id: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [isRenamingList, setIsRenamingList] = useState(false);
  const [listTitle, setListTitle] = useState(checklist.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddItem = async () => {
    const title = newItemTitle.trim();
    if (!title) return;

    const res = await addChecklistItem({ checklistId: checklist.id, boardId, title });
    if (res.error) { toast.error(res.error); return; }

    onUpdate({
      ...checklist,
      items: [...checklist.items, res.data!],
    });
    setNewItemTitle("");
    inputRef.current?.focus();
  };

  const handleToggleItem = async (item: ChecklistItemData) => {
    const updated = { ...item, isComplete: !item.isComplete };
    // Optimistic update
    onUpdate({ ...checklist, items: checklist.items.map((i) => (i.id === item.id ? updated : i)) });

    const res = await updateChecklistItem({ id: item.id, boardId, isComplete: !item.isComplete });
    if (res.error) {
      toast.error(res.error);
      onUpdate({ ...checklist }); // revert
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    onUpdate({ ...checklist, items: checklist.items.filter((i) => i.id !== itemId) });
    const res = await deleteChecklistItem(itemId, boardId);
    if (res.error) toast.error(res.error);
  };

  const handleRenameChecklist = async () => {
    const title = listTitle.trim();
    if (!title || title === checklist.title) { setIsRenamingList(false); return; }

    const res = await renameChecklist({ id: checklist.id, boardId, title });
    if (res.error) { toast.error(res.error); setListTitle(checklist.title); }
    else onUpdate({ ...checklist, title });
    setIsRenamingList(false);
  };

  const handleDeleteChecklist = async () => {
    const res = await deleteChecklist({ id: checklist.id, boardId });
    if (res.error) toast.error(res.error);
    // parent handles removal via onDelete
  };

  return (
    <div className="space-y-2">
      {/* Checklist Header */}
      <div className="flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" />
        {isRenamingList ? (
          <Input
            autoFocus
            value={listTitle}
            onChange={(e) => setListTitle(e.target.value)}
            onBlur={handleRenameChecklist}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameChecklist();
              if (e.key === "Escape") { setListTitle(checklist.title); setIsRenamingList(false); }
            }}
            className="h-7 text-sm font-semibold flex-1"
          />
        ) : (
          <span className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{checklist.title}</span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-700">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsRenamingList(true)} className="cursor-pointer text-sm">
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDeleteChecklist}
              className="cursor-pointer text-sm text-red-600 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Progress */}
      <ChecklistProgress items={checklist.items} />

      {/* Items */}
      <div className="space-y-1 pl-6">
        <AnimatePresence initial={false}>
          {checklist.items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-start gap-2 group/item"
            >
              <button
                onClick={() => handleToggleItem(item)}
                className={cn(
                  "mt-0.5 shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-all",
                  item.isComplete
                    ? "bg-emerald-500 border-emerald-500"
                    : "border-slate-300 dark:border-slate-600 hover:border-blue-400"
                )}
                aria-label={item.isComplete ? "Uncheck item" : "Check item"}
              >
                {item.isComplete && (
                  <svg viewBox="0 0 12 10" className="h-2.5 w-2.5 text-white fill-none stroke-white stroke-2">
                    <polyline points="1 5 4 9 11 1" />
                  </svg>
                )}
              </button>

              <span
                className={cn(
                  "flex-1 text-sm leading-relaxed",
                  item.isComplete
                    ? "line-through text-slate-400 dark:text-slate-600"
                    : "text-slate-700 dark:text-slate-300"
                )}
              >
                {item.title}
              </span>

              <button
                onClick={() => handleDeleteItem(item.id)}
                className="opacity-0 group-hover/item:opacity-100 h-5 w-5 text-slate-400 hover:text-red-500 transition-all"
                aria-label="Delete item"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add item form */}
        {isAdding ? (
          <div className="space-y-1.5 pt-1">
            <Input
              ref={inputRef}
              autoFocus
              placeholder="Add an item..."
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddItem();
                if (e.key === "Escape") { setIsAdding(false); setNewItemTitle(""); }
              }}
              className="h-8 text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={handleAddItem}>
                Add
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => { setIsAdding(false); setNewItemTitle(""); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors mt-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add an item
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export function ChecklistPanel({ cardId, boardId, initialChecklists }: ChecklistPanelProps) {
  const [checklists, setChecklists] = useState<ChecklistData[]>(initialChecklists);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("Checklist");
  const [isLoading, setIsLoading] = useState(false);

  const handleAddChecklist = async () => {
    const title = newTitle.trim() || "Checklist";
    setIsLoading(true);

    const res = await addChecklist({ cardId, boardId, title });
    setIsLoading(false);

    if (res.error) { toast.error(res.error); return; }

    // Cast to the expected shape
    const cl = res.data as unknown as ChecklistData;
    setChecklists((prev) => [...prev, cl]);
    setIsAdding(false);
    setNewTitle("Checklist");
  };

  const handleUpdateChecklist = (updated: ChecklistData) => {
    setChecklists((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleDeleteChecklist = (id: string) => {
    setChecklists((prev) => prev.filter((c) => c.id !== id));
  };

  // Reload from server
  const reload = async () => {
    const res = await getChecklists(cardId);
    if (res.data) setChecklists(res.data as unknown as ChecklistData[]);
  };

  // Override to hook delete into reload
  const handleDeleteWithReload = async (id: string, boardId: string) => {
    handleDeleteChecklist(id);
    await reload();
  };

  return (
    <div className="space-y-6">
      {/* Existing checklists */}
      <AnimatePresence initial={false}>
        {checklists.map((cl) => (
          <motion.div
            key={cl.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm"
          >
            <Checklist
              checklist={cl}
              boardId={boardId}
              onUpdate={handleUpdateChecklist}
              onDelete={(id) => handleDeleteWithReload(id, boardId)}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Add checklist */}
      {isAdding ? (
        <div className="space-y-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
          <Input
            autoFocus
            placeholder="Checklist title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddChecklist();
              if (e.key === "Escape") { setIsAdding(false); setNewTitle("Checklist"); }
            }}
            className="h-9 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-8 text-xs" onClick={handleAddChecklist} disabled={isLoading}>
              {isLoading ? "Adding…" : "Add checklist"}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full h-9 border-dashed border-2 text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add checklist
        </Button>
      )}
    </div>
  );
}
