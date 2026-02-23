"use client";

import { useState, Fragment } from "react";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { Badge } from "@/components/ui/badge";

/* ── Shortcut data ─────────────────────────────────────────────────────────── */

interface ShortcutEntry {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  category: string;
  entries: ShortcutEntry[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    category: "Navigation",
    entries: [
      { keys: ["?"], description: "Open keyboard shortcuts" },
      { keys: ["B"], description: "Jump to board list" },
      { keys: ["/"], description: "Focus search" },
      { keys: ["Esc"], description: "Close modal / cancel" },
    ],
  },
  {
    category: "Card Actions",
    entries: [
      { keys: ["N"], description: "Create new card in focused list" },
      { keys: ["E"], description: "Edit card title (when hovering)" },
      { keys: ["D"], description: "Set / edit due date" },
      { keys: ["L"], description: "Open label picker" },
      { keys: ["A"], description: "Open assignee picker" },
      { keys: ["C"], description: "Open cover picker" },
    ],
  },
  {
    category: "Global",
    entries: [
      { keys: ["Ctrl", "Z"], description: "Undo last action" },
      { keys: ["Ctrl", "Shift", "Z"], description: "Redo" },
      { keys: ["Ctrl", "K"], description: "Open command palette" },
      { keys: ["Ctrl", "\\"], description: "Toggle sidebar" },
    ],
  },
];

/* ── Kbd chip ──────────────────────────────────────────────────────────────── */

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 shadow-sm">
      {children}
    </kbd>
  );
}

/* ── Modal ─────────────────────────────────────────────────────────────────── */

export function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false);

  // Register global "?" shortcut
  useKeyboardShortcuts([
    {
      key: "?",
      description: "Open keyboard shortcuts",
      action: () => setOpen((prev) => !prev),
      ignoreInInput: true,
    },
  ]);

  return (
    <>
      {/* Trigger button — used in footer */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs px-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-all duration-200"
        onClick={() => setOpen(true)}
      >
        <Keyboard className="h-3 w-3 mr-1.5" />
        Shortcuts
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border-none p-0">
          <DialogTitle className="sr-only">Keyboard Shortcuts</DialogTitle>

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Keyboard className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Keyboard Shortcuts</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Press <Kbd>?</Kbd> anywhere to toggle</p>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hidden sm:flex">
              {SHORTCUT_GROUPS.reduce((a, g) => a + g.entries.length, 0)} shortcuts
            </Badge>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.category} className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {group.category}
                </h3>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {group.entries.map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <span className="text-sm text-slate-700 dark:text-slate-300">{entry.description}</span>
                      <div className="flex items-center gap-1">
                        {entry.keys.map((k, ki) => (
                          <Fragment key={ki}>
                            <Kbd>{k}</Kbd>
                            {ki < entry.keys.length - 1 && (
                              <span className="text-slate-400 text-xs">+</span>
                            )}
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
