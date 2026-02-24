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

/* ── Shortcut entry coming from board-tabs ─────────────────────────────────── */
interface ExternalShortcut {
  key: string;
  description: string;
  modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean };
}

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
      { keys: ["Esc"], description: "Close modal / clear selection" },
      { keys: ["1–6"], description: "Switch view (Board, Table, Calendar, Sprints, Workload, Analytics)" },
    ],
  },
  {
    // These shortcuts fire while a card modal is open
    category: "Card Modal",
    entries: [
      { keys: ["P"], description: "Set priority" },
      { keys: ["D"], description: "Set / edit due date" },
      { keys: ["L"], description: "Open label picker" },
      { keys: ["A"], description: "Open assignee picker" },
      { keys: ["C"], description: "Open cover picker" },
    ],
  },
  {
    category: "Global",
    entries: [
      { keys: ["Ctrl", "K"], description: "Open command palette" },
      { keys: ["b"], description: "Toggle bulk selection mode" },
      { keys: ["Ctrl", "A"], description: "Select all visible cards" },
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

interface KeyboardShortcutsModalProps {
  /** Controlled open state (from parent). When omitted the component manages its own state. */
  open?: boolean;
  /** Called when the dialog should close (controlled mode). */
  onClose?: () => void;
  /** Additional shortcuts to surface under a "Board Navigation" section. */
  shortcuts?: ExternalShortcut[];
}

export function KeyboardShortcutsModal({ open: openProp, onClose, shortcuts: externalShortcuts }: KeyboardShortcutsModalProps = {}) {
  // Uncontrolled state used when the parent does not supply `open` / `onClose`
  const [openInternal, setOpenInternal] = useState(false);

  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : openInternal;
  const setOpen = isControlled
    ? (val: boolean) => { if (!val) onClose?.(); }
    : setOpenInternal;

  // When used standalone, register the "?" shortcut ourselves.
  // (When used inside board-tabs the parent already registers it.)
  useKeyboardShortcuts(
    isControlled
      ? []
      : [
          {
            key: "?",
            description: "Open keyboard shortcuts",
            action: () => setOpen(true),
            ignoreInInput: true,
          },
        ]
  );

  // Merge hard-coded groups with any board-level shortcuts from the parent
  const allGroups = [...SHORTCUT_GROUPS];
  if (externalShortcuts && externalShortcuts.length > 0) {
    allGroups.unshift({
      category: "Board Navigation",
      entries: externalShortcuts.map((s) => ({
        keys: [
          ...(s.modifiers?.ctrl ? ["Ctrl"] : []),
          ...(s.modifiers?.shift ? ["Shift"] : []),
          ...(s.modifiers?.alt ? ["Alt"] : []),
          s.key,
        ],
        description: s.description,
      })),
    });
  }

  const totalCount = allGroups.reduce((a, g) => a + g.entries.length, 0);

  return (
    <>
      {/* Trigger button — only rendered in standalone (uncontrolled) mode */}
      {!isControlled && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs px-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-all duration-200"
          onClick={() => setOpen(true)}
        >
          <Keyboard className="h-3 w-3 mr-1.5" />
          Shortcuts
        </Button>
      )}

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
              {totalCount} shortcuts
            </Badge>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {allGroups.map((group) => (
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
