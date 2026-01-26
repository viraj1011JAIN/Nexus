"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Layout } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

interface Board {
  id: string;
  title: string;
}

export const CommandPalette = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);

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

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search boards, cards..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Boards">
          {boards.map((board) => (
            <CommandItem
              key={board.id}
              onSelect={() => {
                router.push(`/board/${board.id}`);
                setOpen(false);
              }}
            >
              <Layout className="mr-2 h-4 w-4" />
              <span>{board.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};
