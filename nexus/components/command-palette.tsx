"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search, Layout, FileText } from "lucide-react";
import { db } from "@/lib/db";

export const CommandPalette = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [boards, setBoards] = useState<any[]>([]);

  // Toggle with Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Fetch boards when opened
  useEffect(() => {
    if (open) {
      fetch("/api/boards")
        .then((res) => res.json())
        .then((data) => setBoards(data))
        .catch(() => setBoards([]));
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-black/50 flex items-start justify-center pt-[20vh] animate-in fade-in">
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden border"
      >
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-slate-400 mr-2" />
          <Command.Input
            placeholder="Search boards, cards..."
            className="flex-1 py-3 text-sm outline-none bg-transparent"
          />
        </div>

        <Command.List className="max-h-[300px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-slate-500">
            No results found.
          </Command.Empty>

          <Command.Group heading="Boards" className="text-xs text-slate-500 px-2 py-1 font-medium">
            {boards.map((board) => (
              <Command.Item
                key={board.id}
                onSelect={() => {
                  router.push(`/board/${board.id}`);
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <Layout className="h-4 w-4 text-slate-400" />
                <span className="text-sm">{board.title}</span>
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>

        <div className="border-t px-3 py-2 text-xs text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <kbd className="px-2 py-1 bg-slate-100 rounded text-[10px] font-medium">↑↓</kbd>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-4">
            <kbd className="px-2 py-1 bg-slate-100 rounded text-[10px] font-medium">↵</kbd>
            <span>Select</span>
          </div>
          <div className="flex items-center gap-4">
            <kbd className="px-2 py-1 bg-slate-100 rounded text-[10px] font-medium">ESC</kbd>
            <span>Close</span>
          </div>
        </div>
      </Command.Dialog>
    </div>
  );
};
