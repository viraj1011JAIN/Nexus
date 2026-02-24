"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, LayoutGrid, Layers, Clock } from "lucide-react";
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

// Rich gradient palettes for board cover fallbacks
const boardGradients = [
  { from: "from-violet-600",  to: "to-purple-700",  text: "text-violet-100"  },
  { from: "from-blue-500",    to: "to-indigo-600",  text: "text-blue-100"    },
  { from: "from-rose-500",    to: "to-pink-600",    text: "text-rose-100"    },
  { from: "from-emerald-500", to: "to-teal-600",    text: "text-emerald-100" },
  { from: "from-orange-500",  to: "to-red-600",     text: "text-orange-100"  },
  { from: "from-cyan-500",    to: "to-blue-600",    text: "text-cyan-100"    },
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
          imageLinkUrl: selectedPhoto.userLink,
        } : {}),
        ...(selectedTemplate ? { templateId: selectedTemplate.id } : {}),
      });

      if (result.fieldErrors?.title) {
        toast.error(result.fieldErrors.title[0]);
      } else if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        toast.success(`Board "${result.data.title}" created!`);
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
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-4 w-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
          <span className="text-sm">Loading boards...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 sm:p-8 lg:p-10">

        {/* ── Page Header ─────────────────────────────────────────────── */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              My Boards
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {boards.length === 0
                ? "No boards yet — create your first below"
                : `${boards.length} board${boards.length !== 1 ? "s" : ""} in your workspace`}
            </p>
          </div>
          {boards.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full border border-border">
              <LayoutGrid className="h-3 w-3" />
              {boards.length}
            </span>
          )}
        </div>

        {/* ── Create Board Form ────────────────────────────────────────── */}
        <form onSubmit={handleCreateBoard} className="mb-10">

          {/* Photo preview banner */}
          {selectedPhoto && (
            <div
              className="w-full max-w-2xl h-24 rounded-xl mb-2 bg-cover bg-center relative overflow-hidden border border-border"
              style={{ backgroundImage: `url(${selectedPhoto.thumbUrl})` }}
            >
              <div className="absolute inset-0 bg-black/25" />
              <p className="absolute bottom-2 right-2.5 text-[10px] text-white/80">
                Photo by{" "}
                <a href={selectedPhoto.userLink} target="_blank" rel="noopener noreferrer" className="underline">
                  {selectedPhoto.userName}
                </a>{" "}on{" "}
                <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="underline">Unsplash</a>
              </p>
            </div>
          )}

          {/* Input row */}
          <div className="flex gap-2 max-w-2xl">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name your new board..."
              className="flex-1 px-4 py-2.5 text-sm bg-card text-foreground placeholder:text-muted-foreground rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm"
              disabled={isPending}
              autoComplete="off"
            />
            <Button
              type="submit"
              disabled={isPending}
              size="default"
              className="gradient-brand text-white shadow-sm hover:opacity-90 border-0 font-medium"
            >
              {isPending ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span className="ml-1.5">New Board</span>
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-label="Toggle advanced options"
              className="shrink-0"
            >
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          {/* Advanced options */}
          {showAdvanced && (
            <div className="mt-3 max-w-2xl p-4 rounded-xl border border-border bg-card space-y-4 shadow-sm">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Background Photo</p>
                <UnsplashPicker
                  selectedId={selectedPhoto?.id}
                  onSelect={(photo) => setSelectedPhoto(photo)}
                  onClear={() => setSelectedPhoto(null)}
                />
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Start from Template</p>
                <TemplatePicker
                  selectedId={selectedTemplate?.id}
                  onSelect={(tmpl) => setSelectedTemplate(tmpl)}
                  onClear={() => setSelectedTemplate(null)}
                />
              </div>
            </div>
          )}
        </form>

        {/* ── Boards Grid ──────────────────────────────────────────────── */}
        {boards.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 px-6 border border-dashed border-border rounded-2xl bg-card"
          >
            <div className="w-14 h-14 mb-5 rounded-2xl bg-primary/10 flex items-center justify-center">
              <LayoutGrid className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1.5">
              No boards yet
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-xs leading-relaxed">
              Create your first board above to start organizing your work.
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {boards.map((board, index) => {
              const grad = boardGradients[index % boardGradients.length];
              return (
                <motion.div
                  key={board.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.25 }}
                  className="group"
                >
                  <Link href={`/board/${board.id}`}>
                    <div className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 overflow-hidden">

                      {/* Board cover — photo or gradient */}
                      {board.imageThumbUrl ? (
                        <div
                          className="h-[104px] w-full bg-cover bg-center"
                          style={{ backgroundImage: `url(${board.imageThumbUrl})` }}
                        />
                      ) : (
                        <div className={`h-[104px] w-full bg-linear-to-br ${grad.from} ${grad.to} flex items-end p-3`}>
                          <span className={`text-[11px] font-semibold uppercase tracking-widest ${grad.text} opacity-70 select-none`}>
                            {board.title.substring(0, 12)}
                          </span>
                        </div>
                      )}

                      {/* Title row */}
                      <div className="px-4 pt-3.5 pb-0 flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-[14px] text-foreground truncate group-hover:text-primary transition-colors leading-snug">
                            {board.title}
                          </h3>
                          <p className="text-[11.5px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5 shrink-0" />
                            {formatRelativeDate(board.updatedAt)}
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
                          className="opacity-0 group-hover:opacity-100 mt-0.5 p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground/60 hover:text-destructive transition-all shrink-0"
                          disabled={isPending}
                          aria-label={`Delete board ${board.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Stats footer */}
                      <div className="px-4 py-3 mt-3 border-t border-border/60 flex items-center gap-3 text-[11.5px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Layers className="h-3 w-3 text-primary/70" />
                          <span>{board.listCount} {board.listCount === 1 ? "list" : "lists"}</span>
                        </div>
                        <div className="w-px h-3 bg-border" />
                        <div className="flex items-center gap-1.5">
                          <LayoutGrid className="h-3 w-3 text-muted-foreground/60" />
                          <span>{board.cardCount} {board.cardCount === 1 ? "card" : "cards"}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
