"use client";

import { useEffect, useCallback } from "react";

export interface ShortcutDefinition {
  key: string;              // e.g. "k", "Enter", "/"
  modifiers?: {
    ctrl?: boolean;
    meta?: boolean;
    alt?: boolean;
    shift?: boolean;
  };
  description: string;
  action: () => void;
  /** Skip when user is typing in an input/textarea/contenteditable */
  ignoreInInput?: boolean;
}

function modifiersMatch(e: KeyboardEvent, mods?: ShortcutDefinition["modifiers"]): boolean {
  const ctrl = !!(mods?.ctrl);
  const meta = !!(mods?.meta);
  const alt = !!(mods?.alt);
  const shift = !!(mods?.shift);

  return (
    e.ctrlKey === ctrl &&
    e.metaKey === meta &&
    e.altKey === alt &&
    e.shiftKey === shift
  );
}

function isInInput(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

/**
 * Register keyboard shortcuts. Call this in a component that is mounted when
 * you want the shortcuts active. Pass a stable array (useMemo or module-level).
 */
export function useKeyboardShortcuts(shortcuts: ShortcutDefinition[]) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        if (!keyMatch) continue;
        if (!modifiersMatch(e, shortcut.modifiers)) continue;
        if (shortcut.ignoreInInput !== false && isInInput()) continue;

        e.preventDefault();
        e.stopPropagation();
        shortcut.action();
        return;
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
