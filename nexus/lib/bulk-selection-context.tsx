"use client";

/**
 * TASK-015 — Bulk Selection Context
 *
 * Provides card selection state across the component tree without prop-drilling.
 * Wrap <BoardTabs> (or the board root) with <BulkSelectionProvider>.
 * Consume with useBulkSelection().
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface BulkSelectionState {
  selectedIds: string[];
  isBulkMode: boolean;
  isSelected: (id: string) => boolean;
  toggleCard: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  enterBulkMode: () => void;
  exitBulkMode: () => void;
}

const BulkSelectionContext = createContext<BulkSelectionState | null>(null);

export function BulkSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // forceBulkMode captures explicit enter/exit via enterBulkMode/exitBulkMode.
  // isBulkMode is derived synchronously so there's no render lag.
  const [forceBulkMode, setForceBulkMode] = useState(false);
  const isBulkMode = forceBulkMode || selectedIds.size > 0;

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const toggleCard = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  // clearSelection deselects all cards but stays in bulk mode (use exitBulkMode to leave).
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const enterBulkMode = useCallback(() => setForceBulkMode(true), []);
  const exitBulkMode = useCallback(() => {
    setForceBulkMode(false);
    setSelectedIds(new Set());
  }, []);

  return (
    <BulkSelectionContext.Provider
      value={{
        selectedIds: [...selectedIds],
        isBulkMode,
        isSelected,
        toggleCard,
        selectAll,
        clearSelection,
        enterBulkMode,
        exitBulkMode,
      }}
    >
      {children}
    </BulkSelectionContext.Provider>
  );
}

export function useBulkSelection(): BulkSelectionState {
  const ctx = useContext(BulkSelectionContext);
  if (!ctx) throw new Error("useBulkSelection must be used within BulkSelectionProvider");
  return ctx;
}
