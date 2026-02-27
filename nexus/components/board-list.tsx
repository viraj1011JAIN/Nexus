"use client";

import { useState, useTransition, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Trash2, ChevronDown, LayoutGrid, Layers, Clock, List, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, isValid, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { createBoard } from "@/actions/create-board";
import { deleteBoard } from "@/actions/delete-board";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme-provider";
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

// Board cover gradient palettes
const BOARD_GRADIENTS = [
  "linear-gradient(135deg, #7B2FF7 0%, #F107A3 100%)",
  "linear-gradient(135deg, #1A73E8 0%, #6C63FF 100%)",
  "linear-gradient(135deg, #C0392B 0%, #F44369 100%)",
  "linear-gradient(135deg, #059669 0%, #10B981 100%)",
  "linear-gradient(135deg, #D97706 0%, #F59E0B 100%)",
  "linear-gradient(135deg, #0891B2 0%, #06B6D4 100%)",
];

function getBoardGradient(board: DashboardBoard): string {
  // Always generate a gradient – imageThumbUrl boards get gradient on swatch/health bar
  const index = board.id.charCodeAt(0) % BOARD_GRADIENTS.length;
  return BOARD_GRADIENTS[index];
}

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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeFilter, setActiveFilter] = useState<"All" | "Recent" | "Active">("All");
  const { theme, setTheme } = useTheme();
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Debounced version to batch rapid Supabase change events (e.g. bulk card moves)
  const debouncedFetchBoards = useCallback(() => {
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    fetchTimeoutRef.current = setTimeout(() => { fetchBoards(); }, 400);
  }, [fetchBoards]);

  useEffect(() => {
    fetchBoards();

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Re-fetch (debounced) whenever boards, lists, or cards change so counts stay accurate.
    const channel = supabase
      .channel('dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, debouncedFetchBoards)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, debouncedFetchBoards)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, debouncedFetchBoards)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBoards, debouncedFetchBoards]);

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

  // ─── Derived / filtered data ──────────────────────────────────────────────
  const filteredBoards = useMemo(() => {
    if (activeFilter === "Recent") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      return [...boards]
        .filter((b) => {
          const d = typeof b.updatedAt === "string" ? parseISO(b.updatedAt) : b.updatedAt;
          return isValid(d) && (d as Date) > cutoff;
        })
        .sort((a, b) => {
          const da = typeof a.updatedAt === "string" ? parseISO(a.updatedAt) : (a.updatedAt as Date);
          const db = typeof b.updatedAt === "string" ? parseISO(b.updatedAt) : (b.updatedAt as Date);
          return db.getTime() - da.getTime();
        });
    }
    if (activeFilter === "Active") {
      return boards.filter((b) => b.cardCount > 0);
    }
    return boards;
  }, [boards, activeFilter]);

  const totalCards = boards.reduce((acc, b) => acc + b.cardCount, 0);
  const totalLists = boards.reduce((acc, b) => acc + b.listCount, 0);

  const recentBoards = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return boards.filter((b) => {
      const d = typeof b.updatedAt === "string" ? parseISO(b.updatedAt) : b.updatedAt;
      return isValid(d) && (d as Date) > cutoff;
    });
  }, [boards]);

  const healthScore = useMemo(() => {
    if (boards.length === 0) return 0;
    const avgCardsPerList = totalLists > 0 ? totalCards / totalLists : 0;
    const recencyScore = Math.round((recentBoards.length / boards.length) * 40);
    const densityScore = Math.min(40, Math.round(avgCardsPerList * 8));
    const volumeScore  = Math.min(20, Math.round((totalCards / 10) * 5));
    return Math.min(100, recencyScore + densityScore + volumeScore);
  }, [boards, totalCards, totalLists, recentBoards]);

  const healthGradient =
    healthScore >= 70
      ? "linear-gradient(135deg,#059669,#10B981)"
      : healthScore >= 40
      ? "linear-gradient(135deg,#D97706,#F59E0B)"
      : "linear-gradient(135deg,#C0392B,#F44369)";

  const maxBoardCards = Math.max(...boards.map((b) => b.cardCount), 1);

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
        <div className="mb-6">
          <h1 className="font-display font-bold text-[28px] tracking-tight text-foreground leading-tight">
            My Boards
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {boards.length > 0 ? (
              <>{boards.length} board{boards.length !== 1 ? "s" : ""} in <span className="text-foreground font-medium">your workspace</span></>
            ) : "No boards yet"}
          </p>
        </div>

        {/* ── Stats Bar ─────────────────────────────────────────────────── */}
        {boards.length > 0 && (
          <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Total Boards",  value: boards.length,                                    bg: "hsl(271 92% 95%)", fg: "#7B2FF7" },
              { label: "Total Cards",   value: totalCards,                                       bg: "hsl(213 90% 95%)", fg: "#1A73E8" },
              { label: "Total Lists",   value: totalLists,                                       bg: "hsl(161 80% 94%)", fg: "#059669" },
              { label: "Active (7d)",   value: `${recentBoards.length}/${boards.length}`,        bg: "hsl(43 90% 94%)",  fg: "#D97706" },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="animate-fade-up bg-card border border-border rounded-2xl p-4 flex items-center gap-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: stat.bg }}
                >
                  <span className="font-display font-bold text-xl leading-none" style={{ color: stat.fg }}>
                    {stat.value}
                  </span>
                </div>
                <p className="text-[12.5px] font-semibold text-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
          </>
        )}

        {/* ── Create Board Form ────────────────────────────────────────── */}
        <form onSubmit={handleCreateBoard} className="mb-6 mt-4">

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
              className="flex-1 h-10.5 px-4 rounded-xl text-[13.5px] bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all duration-200 shadow-sm"
              disabled={isPending}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={isPending}
              className="h-10.5 px-5 rounded-xl text-[13.5px] font-semibold text-white flex items-center gap-2 transition-all duration-200 bg-[linear-gradient(135deg,#7B2FF7,#C01CC4)] shadow-[0_4px_16px_rgba(123,47,247,0.28)] hover:shadow-[0_8px_28px_rgba(123,47,247,0.35)] hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:translate-y-0"
            >
              {isPending ? (
                <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              New Board
            </button>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-label="Toggle advanced options"
              className="h-10.5 w-10.5 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200 shadow-sm shrink-0"
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-180")} />
            </button>
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

        {/* ── Controls Row ─────────────────────────────────────────────── */}
        {boards.length > 0 && (
          <div className="flex items-center justify-between mb-4 gap-3">
            {/* Filter pills */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase mr-1">Filter</span>
              {(["All", "Recent", "Active"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setActiveFilter(f)}
                  className={cn(
                    "text-[12px] font-medium px-3 py-1 rounded-full transition-all duration-200",
                    activeFilter === f
                      ? "bg-accent text-accent-foreground border border-primary/20"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {f}
                  {f === "Recent" && (
                    <span className="ml-1 text-[10px] opacity-60">{recentBoards.length}</span>
                  )}
                  {f === "Active" && (
                    <span className="ml-1 text-[10px] opacity-60">{boards.filter(b => b.cardCount > 0).length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Right-side controls: view toggle + theme */}
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex items-center bg-card border border-border rounded-lg p-0.5 gap-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150",
                    viewMode === "grid"
                      ? "bg-accent text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150",
                    viewMode === "list"
                      ? "bg-accent text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="List view"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Theme toggle */}
              <div className="flex items-center bg-card border border-border rounded-lg p-0.5 gap-0.5">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150",
                    theme === "light"
                      ? "bg-amber-100 text-amber-600 shadow-sm dark:bg-amber-900/40 dark:text-amber-400"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="Light mode"
                >
                  <Sun className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150",
                    theme === "dark"
                      ? "bg-indigo-100 text-indigo-600 shadow-sm dark:bg-indigo-900/40 dark:text-indigo-400"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="Dark mode"
                >
                  <Moon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Boards Grid ──────────────────────────────────────────────── */}
        {boards.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 bg-[linear-gradient(135deg,rgba(123,47,247,0.12),rgba(193,28,196,0.12))]"
            >
              <LayoutGrid className="h-7 w-7 text-primary" />
            </div>
            <h2 className="font-display font-bold text-[22px] text-foreground tracking-tight">No boards yet</h2>
            <p className="text-[13.5px] text-muted-foreground mt-2 max-w-xs">
              Create your first board above to start organising your work visually.
            </p>
          </motion.div>
        ) : filteredBoards.length === 0 ? (
          /* ── No filter results ─────────────────────────────────────── */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-[linear-gradient(135deg,rgba(123,47,247,0.1),rgba(193,28,196,0.1))]"
            >
              <LayoutGrid className="h-5 w-5 text-primary/60" />
            </div>
            <p className="text-[14px] font-semibold text-foreground">
              No <span className="text-primary">{activeFilter}</span> boards found
            </p>
            <p className="text-[12.5px] text-muted-foreground mt-1 max-w-xs">
              {activeFilter === "Recent"
                ? "No boards were updated in the last 7 days."
                : "No boards have cards yet — add some cards to see them here."}
            </p>
            <button
              onClick={() => setActiveFilter("All")}
              className="mt-4 text-[12.5px] font-semibold text-primary hover:underline underline-offset-2"
            >
              Show all boards
            </button>
          </div>
        ) : viewMode === "list" ? (
          /* ── List View ─────────────────────────────────────────────── */
          <div className="flex flex-col gap-2">
            {filteredBoards.map((board, index) => (
              <Link
                key={board.id}
                href={`/board/${board.id}`}
                className="group animate-fade-up bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md hover:border-primary/30 transition-all duration-200 block"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex items-center gap-4 px-4 py-3">
                  {/* Colour swatch */}
                  <div
                    className="w-10 h-10 rounded-xl shrink-0"
                    style={{ backgroundImage: board.imageThumbUrl ? `url(${board.imageThumbUrl})` : getBoardGradient(board), backgroundSize: "cover", backgroundPosition: "center" }}
                  />

                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-[14.5px] tracking-tight text-foreground truncate group-hover:text-primary transition-colors">
                      {board.title}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3 text-muted-foreground/60" />
                      <span className="text-[11.5px] text-muted-foreground">
                        {formatRelativeDate(board.updatedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-5 shrink-0">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Layers className="w-3.5 h-3.5" />
                      <span className="text-[12px] font-medium">{board.listCount} {board.listCount === 1 ? "list" : "lists"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span className="text-[12px] font-medium">{board.cardCount} {board.cardCount === 1 ? "card" : "cards"}</span>
                    </div>
                  </div>

                  {/* Status dot */}
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[11px] text-muted-foreground font-medium">Active</span>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (confirm(`Delete "${board.title}"?`)) {
                        handleDeleteBoard(board.id, board.title);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive/60 hover:bg-destructive/20 hover:text-destructive transition-all duration-200 shrink-0"
                    disabled={isPending}
                    aria-label={`Delete board ${board.title}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredBoards.map((board, index) => (
              <Link
                key={board.id}
                href={`/board/${board.id}`}
                className={cn(
                  "group board-card-hover board-card-tile animate-fade-up",
                  "bg-card border border-border rounded-4xl overflow-hidden",
                  "shadow-sm hover:shadow-xl",
                  "transition-shadow duration-200 cursor-pointer block"
                )}
                style={{ animationDelay: `${index * 0.08 + 0.2}s` }}
              >
                {/* === Banner === */}
                <div
                  className="relative h-28 overflow-hidden"
                  style={{
                    backgroundImage: board.imageThumbUrl
                      ? `url(${board.imageThumbUrl})`
                      : getBoardGradient(board),
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  {/* Noise texture overlay – SVG data-URI kept in className to satisfy no-inline-style rule */}
                  <div className="board-noise-overlay absolute inset-0 mix-blend-overlay opacity-40" />
                  {/* Soft light blob */}
                  <div className="absolute -top-5 -right-5 w-24 h-24 rounded-full bg-white/15 blur-[28px]" />
                  {/* Board name tag */}
                  <div className="absolute bottom-3 left-3.5 text-[9px] font-bold tracking-[0.14em] uppercase text-white/85 px-2 py-1 rounded-md backdrop-blur-sm bg-black/[0.18] border border-white/[0.18]">
                    {board.title.substring(0, 14)}
                  </div>
                  {/* Status dot */}
                  <div className="absolute top-3 left-3.5 flex items-center gap-1.5">
                    <div className="w-1.75 h-1.75 rounded-full bg-emerald-400 animate-pulse-dot shadow-[0_0_6px_#4AE8A4]" />
                    <span className="text-[10px] text-white/80 font-medium">Active</span>
                  </div>
                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (confirm(`Delete "${board.title}"?`)) {
                        handleDeleteBoard(board.id, board.title);
                      }
                    }}
                    className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg bg-black/20 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-200"
                    disabled={isPending}
                    aria-label={`Delete board ${board.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* === Card Body === */}
                <div className="p-4 pb-4.5">
                  {/* Title + timestamp */}
                  <div className="mb-3.5">
                    <h3 className="font-display font-bold text-[16px] tracking-tight text-foreground leading-snug truncate">
                      {board.title}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Clock className="w-2.75 h-2.75 text-muted-foreground/60" />
                      <span className="text-[11.5px] text-muted-foreground">
                        Updated {formatRelativeDate(board.updatedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-border mb-3.5" />

                  {/* Stats + avatar row */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-4">
                      {[
                        { Icon: Layers,     val: board.listCount, label: board.listCount === 1 ? "list" : "lists" },
                        { Icon: LayoutGrid, val: board.cardCount, label: board.cardCount === 1 ? "card" : "cards" },
                      ].map(({ Icon, val, label }) => (
                        <div key={label} className="flex items-center gap-1.5 text-muted-foreground">
                          <Icon className="w-3.25 h-3.25" />
                          <span className="text-[12px] font-medium">{val} {label}</span>
                        </div>
                      ))}
                    </div>
                    {/* Avatar stack */}
                    <div className="flex -space-x-1.5">
                      {(["linear-gradient(135deg,#7B2FF7,#F107A3)", "linear-gradient(135deg,#1A73E8,#6C63FF)", "linear-gradient(135deg,#059669,#10B981)"] as const)
                        .slice(0, Math.min(3, Math.max(1, board.listCount)))
                        .map((g, i) => (
                          <div
                            key={i}
                            className="w-5.5 h-5.5 rounded-full border-2 border-card flex items-center justify-center text-white text-[8px] font-bold shadow-[0_1px_4px_rgba(0,0,0,0.12)]"
                            style={{ background: g }}
                          >
                            {["V","M","A"][i]}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </Link>
            ))}

            {/* Ghost "Create New Board" card */}
            <button
              type="button"
              onClick={() => document.querySelector<HTMLInputElement>("input[placeholder='Name your new board...']")?.focus()}
              className={cn(
                "border-[1.5px] border-dashed border-border rounded-4xl",
                "flex flex-col items-center justify-center gap-2.5 min-h-50 cursor-pointer w-full",
                "transition-all duration-200",
                "hover:border-primary/40 hover:bg-accent/30 hover:-translate-y-1",
                "hover:shadow-[0_8px_28px_rgba(123,47,247,0.08)]"
              )}
            >
              <div className="w-10 h-10 rounded-[13px] bg-accent flex items-center justify-center">
                <Plus className="w-4.5 h-4.5 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-[13.5px] font-semibold text-muted-foreground">Create New Board</p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">Start a fresh workspace</p>
              </div>
            </button>
          </div>
        )}

        {/* ── Project Health Panel ────────────────────────────────────── */}
        {boards.length > 0 && (
          <div
            className="bg-card border border-border rounded-2xl p-5 animate-fade-up mt-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            style={{ animationDelay: "0.22s" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display font-bold text-[15px] text-foreground tracking-tight">
                    Workspace Health
                  </h2>
                  <div className="flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
                    LIVE
                  </div>
                </div>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Real-time progress tracking across {boards.length} board{boards.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div
                  className="font-display font-bold text-[32px] leading-none tabular-nums bg-clip-text text-transparent"
                  style={{ background: healthGradient }}
                >
                  {healthScore}
                </div>
                <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                  {healthScore >= 70 ? "Excellent" : healthScore >= 40 ? "Good" : "Needs Work"}
                </div>
              </div>
            </div>

            {/* Per-board progress bars */}
            <div className="space-y-2.5 mb-4">
              {boards.slice(0, 5).map((board, _i) => {
                const pct = Math.max(4, Math.round((board.cardCount / maxBoardCards) * 100));
                const g   = getBoardGradient(board);
                return (
                  <div key={board.id} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: g }} />
                    <span className="text-[12px] font-medium text-foreground w-28 truncate shrink-0">{board.title}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: g }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums w-14 text-right shrink-0">
                      {board.cardCount} card{board.cardCount !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums w-12 text-right shrink-0">
                      {board.listCount} list{board.listCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Progress explanation */}
            <div className="bg-muted/60 rounded-xl p-3 mb-4">
              <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">How progress is tracked:</span>{" "}
                Each bar shows card volume relative to the busiest board. Move cards through lists
                (e.g. &#34;To Do → In Progress → Done&#34;) in the board view to reflect real work status.
                The health score weighs recency (40%), card density (40%), and volume (20%).
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
                <span className="text-[11px] text-muted-foreground">Syncing via Supabase Realtime</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {recentBoards.length} board{recentBoards.length !== 1 ? "s" : ""} updated this week
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
