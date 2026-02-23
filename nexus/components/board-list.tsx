"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, isValid, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { createBoard } from "@/actions/create-board";
import { deleteBoard } from "@/actions/delete-board";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { UnsplashPicker, type UnsplashPhoto } from "@/components/board/unsplash-picker";
import { TemplatePicker } from "@/components/board/template-picker";
import { type TemplateSummary } from "@/actions/template-actions";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Shape returned by /api/boards */
interface DashboardBoard {
  id: string;
  title: string;
  updatedAt: string | Date;
  imageThumbUrl: string | null;
  listCount: number;
  cardCount: number;
}

// Modern, bold gradient colors for board icons
const boardColors = [
  "from-purple-600 to-indigo-600",
  "from-pink-600 to-rose-600",
  "from-blue-600 to-cyan-600",
  "from-emerald-600 to-green-600",
  "from-orange-600 to-amber-600",
  "from-red-600 to-pink-600",
];

// Helper function to format dates safely
function formatRelativeDate(date: string | Date | null | undefined): string {
  if (!date) return "Never";

  try {
    const dateObj = typeof date === "string" ? parseISO(date) : date;

    if (!isValid(dateObj)) {
      return "Recently";
    }

    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch {
    return "Recently";
  }
}

export function BoardList() {
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [boards, setBoards] = useState<DashboardBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<UnsplashPhoto | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateSummary | null>(null);

  const fetchBoards = useCallback(async () => {
    try {
      const res = await fetch('/api/boards');
      if (res.ok) {
        const data = await res.json();
        setBoards(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoards();

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Re-fetch whenever boards, lists, or cards change so counts stay accurate.
    const channel = supabase
      .channel('dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, fetchBoards)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, fetchBoards)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, fetchBoards)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBoards]);

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || title.trim().length === 0) {
      toast.error("Board title is required");
      return;
    }

    startTransition(async () => {
      const result = await createBoard({
        title: title.trim(),
        ...(selectedPhoto ? {
          imageId:       selectedPhoto.id,
          imageThumbUrl: selectedPhoto.thumbUrl,
          imageFullUrl:  selectedPhoto.fullUrl,
          imageUserName: selectedPhoto.userName,
          imageLinkHTML: selectedPhoto.linkHtml,
        } : {}),
        ...(selectedTemplate ? { templateId: selectedTemplate.id } : {}),
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Board "${result.data?.title}" created!`);
        setTitle("");
        setSelectedPhoto(null);
        setSelectedTemplate(null);
        setShowAdvanced(false);
        fetchBoards();
      }
    });
  };

  const handleDeleteBoard = async (id: string, boardTitle: string) => {
    startTransition(async () => {
      const result = await deleteBoard({ id });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Board "${boardTitle}" deleted`);
        fetchBoards();
      }
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading boards...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
            Boards
          </h1>
          <p className="text-sm text-muted-foreground">
            {boards.length} {boards.length === 1 ? "workspace" : "workspaces"}
          </p>
        </div>

        {/* Create Board */}
        <form onSubmit={handleCreateBoard} className="mb-8">
          {/* Selected photo preview */}
          {selectedPhoto && (
            <div
              className="w-full max-w-2xl h-24 rounded-lg mb-2 bg-cover bg-center relative overflow-hidden"
              style={{ backgroundImage: `url(${selectedPhoto.thumbUrl})` }}
            >
              <div className="absolute inset-0 bg-black/20" />
              <p
                className="absolute bottom-1.5 right-2 text-[10px] text-white/70"
                dangerouslySetInnerHTML={{ __html: selectedPhoto.linkHtml }}
              />
            </div>
          )}

          {/* Main create row */}
          <div className="flex gap-2 max-w-2xl">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Create new board..."
              className="flex-1 px-4 py-2.5 text-sm bg-muted text-foreground placeholder:text-muted-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              disabled={isPending}
              autoComplete="off"
            />
            <Button type="submit" disabled={isPending} size="default">
              {isPending ? (
                <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span className="ml-2">New Board</span>
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-label="Toggle advanced options"
            >
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          {/* Advanced options: background + template */}
          {showAdvanced && (
            <div className="mt-3 max-w-2xl p-4 rounded-lg border bg-muted/30 space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Background Photo</p>
                <UnsplashPicker
                  selectedId={selectedPhoto?.id}
                  onSelect={(photo) => setSelectedPhoto(photo)}
                  onClear={() => setSelectedPhoto(null)}
                />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Start from Template</p>
                <TemplatePicker
                  selectedId={selectedTemplate?.id}
                  onSelect={(tmpl) => setSelectedTemplate(tmpl)}
                  onClear={() => setSelectedTemplate(null)}
                />
              </div>
            </div>
          )}
        </form>

        {/* Boards Grid */}
        {boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 bg-card rounded-lg">
            <div className="w-12 h-12 mb-4 rounded-lg bg-muted flex items-center justify-center">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              No boards yet
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Create your first board to start organizing
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {boards.map((board, index) => (
              <motion.div
                key={board.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group"
              >
                <Link href={`/board/${board.id}`}>
                  <div className="bg-card rounded-lg hover:shadow-md hover:ring-2 hover:ring-primary/20 transition-all duration-200 overflow-hidden">
                    {/* Board Header — image when available, gradient fallback */}
                    {board.imageThumbUrl ? (
                      <div
                        className="h-24 w-full bg-cover bg-center"
                        style={{ backgroundImage: `url(${board.imageThumbUrl})` }}
                      />
                    ) : (
                      <div
                        className={`h-24 w-full bg-linear-to-br ${
                          boardColors[index % boardColors.length]
                        } flex items-center justify-center`}
                      >
                        <span className="text-white/25 font-bold text-6xl select-none">
                          {board.title.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* Title & Actions */}
                    <div className="p-4 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {board.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Updated {formatRelativeDate(board.updatedAt)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (confirm(`Delete "${board.title}"?`)) {
                            handleDeleteBoard(board.id, board.title);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded transition-all"
                        disabled={isPending}
                        aria-label={`Delete board ${board.title}`}
                        title={`Delete board ${board.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Stats */}
                    <div className="px-4 pb-4 flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span>{board.listCount} {board.listCount === 1 ? "list" : "lists"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                        <span>{board.cardCount} {board.cardCount === 1 ? "card" : "cards"}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
