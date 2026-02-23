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
  const [isBulkMode, setIsBulkMode] = useState(false);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const toggleCard = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Exit bulk mode when last card is deselected
        if (next.size === 0) setIsBulkMode(false);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
    if (ids.length > 0) setIsBulkMode(true);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsBulkMode(false);
  }, []);

  const enterBulkMode = useCallback(() => setIsBulkMode(true), []);
  const exitBulkMode = useCallback(() => {
    setIsBulkMode(false);
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
