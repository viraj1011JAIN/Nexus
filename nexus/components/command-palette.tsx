"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { 
  Layout, 
  FileText, 
  Plus, 
  Home,
  Settings,
  CreditCard,
  Activity,
  ChevronRight,
  Search as SearchIcon,
  Loader2,
  Clock,
  Hash,
  List,
  Zap,
  TrendingUp,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { Command as CommandPrimitive } from "cmdk";
import { Badge } from "@/components/ui/badge";

interface Board {
  id: string;
  title: string;
}

interface Card {
  id: string;
  title: string;
  description: string | null;
  priority?: string;
  dueDate?: string;
  list: {
    title: string;
    board: {
      id: string;
      title: string;
    };
  };
}

interface RecentItem {
  type: "board" | "card";
  id: string;
  title: string;
  timestamp: number;
}

const RECENT_ITEMS_KEY = "nexus-recent-items";
const MAX_RECENT_ITEMS = 5;

const useRecentItems = () => {
  const [recentItems, setRecentItems] = React.useState<RecentItem[]>([]);

  React.useEffect(() => {
    const stored = localStorage.getItem(RECENT_ITEMS_KEY);
    if (stored) {
      try {
        setRecentItems(JSON.parse(stored));
      } catch {
        setRecentItems([]);
      }
    }
  }, []);

  const addRecentItem = React.useCallback((item: Omit<RecentItem, "timestamp">) => {
    setRecentItems((prev) => {
      const filtered = prev.filter((i) => !(i.type === item.type && i.id === item.id));
      const updated = [{ ...item, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT_ITEMS);
      localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { recentItems, addRecentItem };
};

export const CommandPalette = () => {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [boards, setBoards] = React.useState<Board[]>([]);
  const [cards, setCards] = React.useState<Card[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { recentItems, addRecentItem } = useRecentItems();

  // Toggle with Cmd+K / Ctrl+K
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      // ESC to close
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open]);

  // Fetch data when opened
  React.useEffect(() => {
    if (open && boards.length === 0 && !loading) {
      setLoading(true);
      setError(null);
      Promise.all([
        fetch("/api/boards").then((res) => {
          if (!res.ok) throw new Error("Failed to fetch boards");
          return res.json();
        }),
        fetch("/api/cards/search?limit=50").then((res) => {
          if (!res.ok) throw new Error("Failed to fetch cards");
          return res.json();
        }),
      ])
        .then(([boardsData, cardsData]) => {
          setBoards(Array.isArray(boardsData) ? boardsData : []);
          setCards(Array.isArray(cardsData) ? cardsData : []);
          setError(null);
        })
        .catch((err) => {
          setError(err.message || "Failed to load data");
          setBoards([]);
          setCards([]);
        })
        .finally(() => setLoading(false));
    }
  }, [open, boards.length, loading]);

  // Reset search when closing
  React.useEffect(() => {
    if (!open) {
      setSearch("");
      setError(null);
    }
  }, [open]);

  const runCommand = React.useCallback((callback: () => void, item?: { type: "board" | "card"; id: string; title: string }) => {
    setOpen(false);
    if (item) {
      addRecentItem(item);
    }
    setTimeout(() => {
      callback();
    }, 100);
  }, [addRecentItem]);

  // Get recent boards and cards
  const recentBoards = React.useMemo(() => {
    return recentItems
      .filter((item) => item.type === "board")
      .map((item) => boards.find((b) => b.id === item.id))
      .filter(Boolean) as Board[];
  }, [recentItems, boards]);

  const recentCards = React.useMemo(() => {
    return recentItems
      .filter((item) => item.type === "card")
      .map((item) => cards.find((c) => c.id === item.id))
      .filter(Boolean) as Card[];
  }, [recentItems, cards]);

  // Filtered results
  const filteredBoards = React.useMemo(() => {
    if (!search) return boards.slice(0, 8);
    return boards.filter((b) => 
      b.title.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 8);
  }, [boards, search]);

  const filteredCards = React.useMemo(() => {
    if (!search) return cards.slice(0, 8);
    return cards.filter((c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase()) ||
      c.list.title.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 8);
  }, [cards, search]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 gap-0 max-w-2xl">
        <VisuallyHidden>
          <DialogTitle>Command Menu</DialogTitle>
        </VisuallyHidden>
        <CommandPrimitive
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
          shouldFilter={true}
        >
          <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
            <SearchIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandPrimitive.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Type to search boards, cards, or commands..."
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <CommandPrimitive.List className="max-h-[400px] overflow-y-auto overflow-x-hidden p-2">
            <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </CommandPrimitive.Empty>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
              </div>
            ) : (
              <>
                {/* Quick Actions */}
                <CommandPrimitive.Group heading="Quick Actions" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
                  <CommandPrimitive.Item
                    value="create-board"
                    onSelect={() => runCommand(() => {
                      router.push("/dashboard");
                      toast.success("Opening dashboard");
                    })}
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <Plus className="mr-2 h-4 w-4 text-emerald-500" />
                    <span>Create New Board</span>
                  </CommandPrimitive.Item>
                  <CommandPrimitive.Item
                    value="dashboard"
                    onSelect={() => runCommand(() => {
                      router.push("/dashboard");
                    })}
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <Layout className="mr-2 h-4 w-4 text-blue-500" />
                    <span>Go to Dashboard</span>
                  </CommandPrimitive.Item>
                </CommandPrimitive.Group>

                <CommandPrimitive.Separator className="h-px bg-border my-1" />

                {/* Boards */}
                {boards.length > 0 && (
                  <>
                    <CommandPrimitive.Group heading="Boards" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
                      {boards.slice(0, 8).map((board) => (
                        <CommandPrimitive.Item
                          key={board.id}
                          value={`board-${board.title}`}
                          onSelect={() => runCommand(() => {
                            router.push(`/board/${board.id}`);
                          })}
                          className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          <Layout className="mr-2 h-4 w-4 text-indigo-500" />
                          <span className="flex-1">{board.title}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50" />
                        </CommandPrimitive.Item>
                      ))}
                    </CommandPrimitive.Group>
                    <CommandPrimitive.Separator className="h-px bg-border my-1" />
                  </>
                )}

                {/* Cards */}
                {cards.length > 0 && (
                  <>
                    <CommandPrimitive.Group heading="Cards" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
                      {cards.slice(0, 8).map((card) => (
                        <CommandPrimitive.Item
                          key={card.id}
                          value={`card-${card.title}`}
                          onSelect={() => runCommand(() => {
                            router.push(`/board/${card.list.board.id}`);
                            toast.success(`Opening ${card.list.board.title}`);
                          })}
                          className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          <FileText className="mr-2 h-4 w-4 text-purple-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{card.title}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {card.list.title} • {card.list.board.title}
                            </div>
                          </div>
                        </CommandPrimitive.Item>
                      ))}
                    </CommandPrimitive.Group>
                    <CommandPrimitive.Separator className="h-px bg-border my-1" />
                  </>
                )}

                {/* Navigation */}
                <CommandPrimitive.Group heading="Navigation" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
                  <CommandPrimitive.Item
                    value="home"
                    onSelect={() => runCommand(() => router.push("/"))}
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <Home className="mr-2 h-4 w-4" />
                    <span>Home</span>
                  </CommandPrimitive.Item>
                  <CommandPrimitive.Item
                    value="activity"
                    onSelect={() => runCommand(() => router.push("/activity"))}
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <Activity className="mr-2 h-4 w-4" />
                    <span>Activity</span>
                  </CommandPrimitive.Item>
                  <CommandPrimitive.Item
                    value="settings"
                    onSelect={() => runCommand(() => router.push("/settings"))}
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </CommandPrimitive.Item>
                  <CommandPrimitive.Item
                    value="billing"
                    onSelect={() => runCommand(() => router.push("/billing"))}
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Billing</span>
                  </CommandPrimitive.Item>
                </CommandPrimitive.Group>
              </>
            )}
          </CommandPrimitive.List>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
};
