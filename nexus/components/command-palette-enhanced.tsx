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
  AlertCircle,
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

  const hasRecentItems = recentBoards.length > 0 || recentCards.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 gap-0 max-w-2xl shadow-2xl">
        <VisuallyHidden>
          <DialogTitle>Command Menu</DialogTitle>
        </VisuallyHidden>
        <CommandPrimitive
          className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
          shouldFilter={true}
        >
          <div className="flex items-center border-b px-4 py-2 bg-muted/30" cmdk-input-wrapper="">
            <SearchIcon className="mr-3 h-5 w-5 shrink-0 text-muted-foreground" />
            <CommandPrimitive.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search boards, cards, or type a command..."
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              autoFocus
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-1 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">ESC</span>
            </kbd>
          </div>

          <CommandPrimitive.List className="max-h-[450px] overflow-y-auto overflow-x-hidden p-2 scrollbar-thin">
            <CommandPrimitive.Empty className="py-12 text-center">
              <div className="flex flex-col items-center gap-2">
                <SearchIcon className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">No results found</p>
                <p className="text-xs text-muted-foreground/70">Try different keywords or check spelling</p>
              </div>
            </CommandPrimitive.Empty>

            {error ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-2 text-destructive">
                  <AlertCircle className="h-8 w-8" />
                  <p className="text-sm font-medium">{error}</p>
                  <button
                    onClick={() => {
                      setBoards([]);
                      setCards([]);
                      setError(null);
                    }}
                    className="mt-2 text-xs underline underline-offset-2 hover:text-destructive/80"
                  >
                    Try again
                  </button>
                </div>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Recent Items */}
                {!search && hasRecentItems && (
                  <>
                    <CommandPrimitive.Group heading="Recent" className="mb-2">
                      {recentBoards.map((board) => (
                        <CommandPrimitive.Item
                          key={`recent-board-${board.id}`}
                          value={`recent-board-${board.title}`}
                          onSelect={() => runCommand(() => {
                            router.push(`/board/${board.id}`);
                            toast.success(`Opening ${board.title}`);
                          }, { type: "board", id: board.id, title: board.title })}
                          className="relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm outline-none aria-selected:bg-accent/50 hover:bg-accent/30 transition-colors duration-150"
                        >
                          <Clock className="h-4 w-4 text-amber-500" />
                          <Layout className="h-4 w-4 text-indigo-500" />
                          <span className="flex-1 font-medium">{board.title}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                        </CommandPrimitive.Item>
                      ))}
                      {recentCards.map((card) => (
                        <CommandPrimitive.Item
                          key={`recent-card-${card.id}`}
                          value={`recent-card-${card.title}`}
                          onSelect={() => runCommand(() => {
                            router.push(`/board/${card.list.board.id}`);
                            toast.success(`Opening ${card.list.board.title}`);
                          }, { type: "card", id: card.id, title: card.title })}
                          className="relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm outline-none aria-selected:bg-accent/50 hover:bg-accent/30 transition-colors duration-150"
                        >
                          <Clock className="h-4 w-4 text-amber-500" />
                          <FileText className="h-4 w-4 text-purple-500" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{card.title}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {card.list.title} • {card.list.board.title}
                            </div>
                          </div>
                        </CommandPrimitive.Item>
                      ))}
                    </CommandPrimitive.Group>
                    <CommandPrimitive.Separator className="h-px bg-border/50 my-2" />
                  </>
                )}

                {/* Quick Actions */}
                <CommandPrimitive.Group heading="Quick Actions" className="mb-2">
                  <CommandPrimitive.Item
                    value="create-new-board"
                    onSelect={() => runCommand(() => {
                      router.push("/dashboard");
                      toast.success("Opening dashboard to create board");
                    })}
                    className="relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm outline-none aria-selected:bg-accent/50 hover:bg-accent/30 transition-colors duration-150"
                  >
                    <Plus className="h-4 w-4 text-emerald-500" />
                    <span className="flex-1 font-medium">Create New Board</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">⌘N</Badge>
                  </CommandPrimitive.Item>
                  <CommandPrimitive.Item
                    value="view-all-boards"
                    onSelect={() => runCommand(() => {
                      router.push("/dashboard");
                      toast.success("Opening dashboard");
                    })}
                    className="relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm outline-none aria-selected:bg-accent/50 hover:bg-accent/30 transition-colors duration-150"
                  >
                    <Layout className="h-4 w-4 text-blue-500" />
                    <span className="flex-1 font-medium">View All Boards</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{boards.length}</Badge>
                  </CommandPrimitive.Item>
                  <CommandPrimitive.Item
                    value="view-activity"
                    onSelect={() => runCommand(() => {
                      router.push("/activity");
                      toast.success("Opening activity log");
                    })}
                    className="relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm outline-none aria-selected:bg-accent/50 hover:bg-accent/30 transition-colors duration-150"
                  >
                    <TrendingUp className="h-4 w-4 text-orange-500" />
                    <span className="flex-1 font-medium">View Activity</span>
                  </CommandPrimitive.Item>
                </CommandPrimitive.Group>

                <CommandPrimitive.Separator className="h-px bg-border/50 my-2" />

                {/* Boards */}
                {filteredBoards.length > 0 && (
                  <>
                    <CommandPrimitive.Group heading={`Boards ${search ? `(${filteredBoards.length})` : ""}`} className="mb-2">
                      {filteredBoards.map((board) => (
                        <CommandPrimitive.Item
                          key={board.id}
                          value={`board-${board.title}`}
                          onSelect={() => runCommand(() => {
                            router.push(`/board/${board.id}`);
                            toast.success(`Opening ${board.title}`);
                          }, { type: "board", id: board.id, title: board.title })}
                          className="relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm outline-none aria-selected:bg-accent/50 hover:bg-accent/30 transition-colors duration-150 group"
                        >
                          <Layout className="h-4 w-4 text-indigo-500" />
                          <span className="flex-1 font-medium">{board.title}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-aria-selected:translate-x-0.5 transition-transform" />
                        </CommandPrimitive.Item>
                      ))}
                    </CommandPrimitive.Group>
                    <CommandPrimitive.Separator className="h-px bg-border/50 my-2" />
                  </>
                )}

                {/* Cards */}
                {filteredCards.length > 0 && (
                  <>
                    <CommandPrimitive.Group heading={`Cards ${search ? `(${filteredCards.length})` : ""}`} className="mb-2">
                      {filteredCards.map((card) => (
                        <CommandPrimitive.Item
                          key={card.id}
                          value={`card-${card.title}-${card.list.title}`}
                          onSelect={() => runCommand(() => {
                            router.push(`/board/${card.list.board.id}`);
                            toast.success(`Opening board: ${card.list.board.title}`);
                          }, { type: "card", id: card.id, title: card.title })}
                          className="relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm outline-none aria-selected:bg-accent/50 hover:bg-accent/30 transition-colors duration-150"
                        >
                          <FileText className="h-4 w-4 text-purple-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{card.title}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <span className="truncate">{card.list.title}</span>
                              <span>•</span>
                              <span className="truncate">{card.list.board.title}</span>
                            </div>
                          </div>
                          {card.priority && (
                            <Badge 
                              variant={card.priority === "URGENT" ? "destructive" : "secondary"}
                              className="text-[10px] px-1.5 py-0 shrink-0"
                            >
                              {card.priority}
                            </Badge>
                          )}
                        </CommandPrimitive.Item>
                      ))}
                    </CommandPrimitive.Group>
                    <CommandPrimitive.Separator className="h-px bg-border/50 my-2" />
                  </>
                )}

                {/* Navigation */}
                <CommandPrimitive.Group heading="Navigate" className="mb-2">
                  <CommandPrimitive.Item
                    value="go-home"
                    onSelect={() => runCommand(() => router.push("/"))}
                    className="relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm outline-none aria-selected:bg-accent/50 hover:bg-accent/30 transition-colors duration-150"
                  >
                    <Home className="h-4 w-4 text-slate-500" />
                    <span className="flex-1 font-medium">Home</span>
                  </CommandPrimitive.Item>
                  <CommandPrimitive.Item
                    value="open-settings"
                    onSelect={() => runCommand(() => router.push("/settings"))}
                    className="relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm outline-none aria-selected:bg-accent/50 hover:bg-accent/30 transition-colors duration-150"
                  >
                    <Settings className="h-4 w-4 text-gray-500" />
                    <span className="flex-1 font-medium">Settings</span>
                  </CommandPrimitive.Item>
                  <CommandPrimitive.Item
                    value="manage-billing"
                    onSelect={() => runCommand(() => router.push("/billing"))}
                    className="relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm outline-none aria-selected:bg-accent/50 hover:bg-accent/30 transition-colors duration-150"
                  >
                    <CreditCard className="h-4 w-4 text-cyan-500" />
                    <span className="flex-1 font-medium">Billing</span>
                  </CommandPrimitive.Item>
                </CommandPrimitive.Group>
              </>
            )}
          </CommandPrimitive.List>

          {/* Footer hint */}
          <div className="border-t px-4 py-2 text-xs text-muted-foreground bg-muted/20">
            <div className="flex items-center justify-between">
              <span>Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">⌘K</kbd> to open</span>
              <span>Use <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↑↓</kbd> to navigate</span>
            </div>
          </div>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
};
