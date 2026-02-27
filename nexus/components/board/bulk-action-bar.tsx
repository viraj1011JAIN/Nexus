"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { 
  X, Trash2, MoveRight, Flag, User, Tag,
  CheckSquare, ChevronDown, AlertTriangle, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { bulkUpdateCards, bulkDeleteCards, bulkMoveCards } from "@/actions/bulk-card-actions";
import { Priority } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ListOption {
  id: string;
  title: string;
}

interface MemberOption {
  id: string;
  name: string;
  imageUrl?: string | null;
}

interface LabelOption {
  id: string;
  name: string;
  color: string;
}

interface BulkActionBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onActionComplete: () => void;
  lists?: ListOption[];
  members?: MemberOption[];
  labels?: LabelOption[];
}

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "URGENT", label: "Urgent", color: "text-red-500" },
  { value: "HIGH", label: "High", color: "text-orange-500" },
  { value: "MEDIUM", label: "Medium", color: "text-yellow-500" },
  { value: "LOW", label: "Low", color: "text-blue-500" },
];

// ─── BulkActionBar ────────────────────────────────────────────────────────────

export function BulkActionBar({
  selectedIds,
  onClearSelection,
  onActionComplete,
  lists = [],
  members = [],
  labels = [],
}: BulkActionBarProps) {
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const n = selectedIds.length;

  const withLoading = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true);
    try {
      await fn();
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSetPriority = (priority: Priority) => {
    withLoading(async () => {
      const result = await bulkUpdateCards(selectedIds, { priority });
      if (result.error) { toast.error(result.error); return; }
      toast.success(`Set priority on ${n} card${n > 1 ? "s" : ""}.`);
      onActionComplete();
      onClearSelection();
    });
  };

  const handleAssign = (assigneeId: string | null) => {
    withLoading(async () => {
      const result = await bulkUpdateCards(selectedIds, { assigneeId });
      if (result.error) { toast.error(result.error); return; }
      toast.success(assigneeId ? `Assigned ${n} card${n > 1 ? "s" : ""}.` : `Unassigned ${n} card${n > 1 ? "s" : ""}.`);
      onActionComplete();
      onClearSelection();
    });
  };

  const handleAddLabel = (labelId: string) => {
    withLoading(async () => {
      const result = await bulkUpdateCards(selectedIds, { labelIds: [labelId] });
      if (result.error) { toast.error(result.error); return; }
      toast.success(`Label added to ${n} card${n > 1 ? "s" : ""}.`);
      onActionComplete();
      onClearSelection();
    });
  };

  const handleMove = (listId: string) => {
    withLoading(async () => {
      const result = await bulkMoveCards(selectedIds, listId);
      if (result.error) { toast.error(result.error); return; }
      toast.success(`Moved ${n} card${n > 1 ? "s" : ""}.`);
      onActionComplete();
      onClearSelection();
    });
  };

  const handleDelete = () => {
    withLoading(async () => {
      const result = await bulkDeleteCards(selectedIds);
      if (result.error) { toast.error(result.error); return; }
      toast.success(`Deleted ${n} card${n > 1 ? "s" : ""}.`);
      onActionComplete();
      onClearSelection();
    });
  };

  return (
    <>
      <AnimatePresence>
        {n > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-1.5 bg-slate-900 dark:bg-slate-800 text-white
              rounded-2xl shadow-2xl shadow-black/30 border border-slate-700 px-4 py-2.5
              min-w-[480px] max-w-[90vw]"
            >
              {/* Selection count */}
              <div className="flex items-center gap-2 pr-3 border-r border-slate-600">
                <div className="h-7 w-7 rounded-full bg-indigo-500 flex items-center justify-center">
                  <CheckSquare className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {n} selected
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 ml-1">
                {/* Move to list */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-white/80 hover:text-white hover:bg-white/10 gap-1.5"
                      disabled={loading || lists.length === 0}
                    >
                      <MoveRight className="h-4 w-4" />
                      Move
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-48">
                    <DropdownMenuLabel>Move to list</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {lists.map((l) => (
                      <DropdownMenuItem key={l.id} onClick={() => handleMove(l.id)}>
                        {l.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Set priority */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-white/80 hover:text-white hover:bg-white/10 gap-1.5"
                      disabled={loading}
                    >
                      <Flag className="h-4 w-4" />
                      Priority
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-44">
                    <DropdownMenuLabel>Set priority</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {PRIORITIES.map((p) => (
                      <DropdownMenuItem
                        key={p.value}
                        onClick={() => handleSetPriority(p.value)}
                        className={cn("gap-2", p.color)}
                      >
                        <Flag className="h-3.5 w-3.5" />
                        {p.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Assign */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-white/80 hover:text-white hover:bg-white/10 gap-1.5"
                      disabled={loading || members.length === 0}
                    >
                      <User className="h-4 w-4" />
                      Assign
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-52">
                    <DropdownMenuLabel>Assign to</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleAssign(null)} className="text-muted-foreground">
                      <User className="h-3.5 w-3.5 mr-2" />
                      Unassign
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {members.map((m) => (
                      <DropdownMenuItem key={m.id} onClick={() => handleAssign(m.id)}>
                        <span className="flex items-center gap-2">
                          {m.imageUrl ? (
                            <Image src={m.imageUrl} alt={m.name} width={20} height={20} className="rounded-full" />
                          ) : (
                            <div className="h-5 w-5 rounded-full bg-indigo-200 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                              {m.name[0]?.toUpperCase()}
                            </div>
                          )}
                          {m.name}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Label */}
                {labels.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-white/80 hover:text-white hover:bg-white/10 gap-1.5"
                        disabled={loading}
                      >
                        <Tag className="h-4 w-4" />
                        Label
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-48">
                      <DropdownMenuLabel>Add label</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {labels.map((l) => (
                        <DropdownMenuItem key={l.id} onClick={() => handleAddLabel(l.id)}>
                          <span className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: l.color }}
                            />
                            {l.name}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Delete */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1.5"
                  disabled={loading}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>

              {/* Loading indicator */}
              {loading && (
                <div className="ml-2 pl-2 border-l border-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                </div>
              )}

              {/* Close */}
              <button
                aria-label="Clear selection"
                onClick={onClearSelection}
                className="ml-2 pl-2 border-l border-slate-600 text-white/50 hover:text-white transition-colors"
                disabled={loading}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete {n} card{n > 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {n} card{n > 1 ? "s" : ""} and all associated
              data (checklists, comments, attachments). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { setShowDeleteConfirm(false); handleDelete(); }}
            >
              Delete {n} card{n > 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── useBulkSelection ─────────────────────────────────────────────────────────

export function useBulkSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  }, []);

  const select = useCallback((id: string) => {
    setSelectedIds((prev) => new Set([...prev, id]));
    setSelectionMode(true);
  }, []);

  const deselect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  }, [setSelectionMode]);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
    setSelectionMode(true);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, []);

  const enableSelectionMode = useCallback(() => setSelectionMode(true), []);

  return {
    selectedIds: [...selectedIds],
    selectionMode,
    isSelected: (id: string) => selectedIds.has(id),
    toggle,
    select,
    deselect,
    selectAll,
    clearSelection,
    enableSelectionMode,
  };
}
