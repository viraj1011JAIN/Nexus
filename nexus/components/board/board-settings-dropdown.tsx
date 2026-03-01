"use client";

/**
 * BoardSettingsDropdown
 * ─────────────────────
 * Full-featured board settings panel triggered by the ⚙ button in BoardHeader.
 *
 * Sections:
 *   1. Rename board          — inline edit with optimistic update
 *   2. Change background     — Unsplash picker (preserves current art on cancel)
 *   3. Copy board link       — clipboard API with toast feedback
 *   4. Custom fields         — navigates to /board/[boardId]/settings
 *   5. Export                — JSON snapshot or flat CSV download
 *   6. Danger zone           — Delete board (two-step confirmation)
 */

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Settings, ChevronRight, Pencil, Check, X, Image as ImageIcon,
  Link2, Copy, FileJson, FileSpreadsheet, Trash2, Settings2,
  AlertTriangle, Loader2, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { updateBoard } from "@/actions/update-board";
import { deleteBoard } from "@/actions/delete-board";
import { exportBoardAsJSON, exportBoardAsCSV } from "@/actions/import-export-actions";
import { UnsplashPicker, type UnsplashPhoto } from "./unsplash-picker";
import { useTheme } from "@/components/theme-provider";

/**
 * Sanitize a board title for use as a download filename.
 * Replaces any character outside [A-Za-z0-9._-] with a hyphen,
 * collapses consecutive hyphens, trims leading/trailing hyphens,
 * and falls back to "untitled" if the result would be empty.
 */
function sanitizeFilename(title: string): string {
  const sanitized = title
    .replace(/[^A-Za-z0-9._-]/g, "-")  // replace unsafe chars
    .replace(/-{2,}/g, "-")             // collapse consecutive hyphens
    .replace(/^-+|-+$/g, "")            // trim leading/trailing hyphens
    .toLowerCase();
  return sanitized.length > 0 ? sanitized : "untitled";
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface BoardSettingsDropdownProps {
  boardId: string;
  boardTitle: string;
  /** Current Unsplash image id (for picker "selected" highlight) */
  currentImageId?: string | null;
  onTitleChange?: (newTitle: string) => void;
}

type Panel = "main" | "rename" | "background" | "export" | "delete";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BoardSettingsDropdown({
  boardId,
  boardTitle,
  currentImageId,
  onTitleChange,
}: BoardSettingsDropdownProps) {
  const { resolvedTheme } = useTheme();
  // Avoid hydration mismatch: on SSR/hydration isDark is always false (light).
  // After mount the correct theme kicks in without a React mismatch warning.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted && resolvedTheme === "dark";
  const router  = useRouter();

  // Dropdown open state
  const [open, setOpen]   = useState(false);
  const [panel, setPanel] = useState<Panel>("main");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Rename state
  const [renameValue, setRenameValue] = useState(boardTitle);
  const [renameError, setRenameError] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Transitions
  const [isPending, startTransition] = useTransition();
  const [exportPending, setExportPending] = useState<"json" | "csv" | null>(null);

  // ── Close on outside click ──────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Close on Escape ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") closeDropdown();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // ── Focus rename input when panel mounts ────────────────────────────────
  useEffect(() => {
    if (panel === "rename") {
      setRenameValue(boardTitle);
      setRenameError("");
      setTimeout(() => renameInputRef.current?.select(), 60);
    }
  }, [panel, boardTitle]);

  // ── Helpers ─────────────────────────────────────────────────────────────
  function closeDropdown() {
    setOpen(false);
    setPanel("main");
    setDeleteConfirmText("");
  }

  function openDropdown() {
    setPanel("main");
    setDeleteConfirmText("");
    setOpen(true);
  }

  // ── Rename ──────────────────────────────────────────────────────────────
  const handleRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameError("Board name cannot be empty.");
      return;
    }
    if (trimmed.length > 100) {
      setRenameError("Board name must be 100 characters or fewer.");
      return;
    }
    if (trimmed === boardTitle) {
      setPanel("main");
      return;
    }
    startTransition(async () => {
      const res = await updateBoard({ boardId, title: trimmed });
      if (res.error) {
        setRenameError(res.error);
        return;
      }
      toast.success("Board renamed.");
      onTitleChange?.(trimmed);
      setPanel("main");
      router.refresh();
    });
  }, [renameValue, boardTitle, boardId, onTitleChange, router]);

  // ── Background ──────────────────────────────────────────────────────────
  const handleBackgroundSelect = useCallback((photo: UnsplashPhoto) => {
    startTransition(async () => {
      const res = await updateBoard({
        boardId,
        imageId:       photo.id,
        imageThumbUrl: photo.thumbUrl,
        imageFullUrl:  photo.fullUrl,
        imageUserName: photo.userName,
        imageLinkHTML: photo.linkHtml,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Background updated.");
      closeDropdown();
      router.refresh();
    });
  }, [boardId, router]);

  const handleBackgroundClear = useCallback(() => {
    startTransition(async () => {
      const res = await updateBoard({
        boardId,
        imageId:       null,
        imageThumbUrl: null,
        imageFullUrl:  null,
        imageUserName: null,
        imageLinkHTML: null,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Background removed.");
      closeDropdown();
      router.refresh();
    });
  }, [boardId, router]);

  // ── Copy link ───────────────────────────────────────────────────────────
  const handleCopyLink = useCallback(async () => {
    const url = `${window.location.origin}/board/${boardId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Board link copied to clipboard.");
    } catch {
      toast.error("Failed to copy link.");
    }
    closeDropdown();
  }, [boardId]);

  // ── Export ──────────────────────────────────────────────────────────────
  const handleExportJSON = useCallback(async () => {
    setExportPending("json");
    try {
      const res = await exportBoardAsJSON(boardId);
      if (res.error || !res.data) {
        toast.error(res.error ?? "Export failed.");
        return;
      }
      const filename = `${sanitizeFilename(boardTitle)}-export.json`;
      downloadBlob(JSON.stringify(res.data, null, 2), filename, "application/json");
      toast.success("Board exported as JSON.");
      closeDropdown();
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setExportPending(null);
    }
  }, [boardId, boardTitle]);

  const handleExportCSV = useCallback(async () => {
    setExportPending("csv");
    try {
      const res = await exportBoardAsCSV(boardId);
      if (res.error || !res.data) {
        toast.error(res.error ?? "Export failed.");
        return;
      }
      const filename = `${sanitizeFilename(boardTitle)}-export.csv`;
      downloadBlob(res.data as string, filename, "text/csv");
      toast.success("Board exported as CSV.");
      closeDropdown();
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setExportPending(null);
    }
  }, [boardId, boardTitle]);

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    if (deleteConfirmText !== boardTitle) {
      toast.error("Board name doesn't match.");
      return;
    }
    startTransition(async () => {
      const res = await deleteBoard({ id: boardId });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Board deleted.");
      closeDropdown();
      router.push("/");
    });
  }, [deleteConfirmText, boardTitle, boardId, router]);

  // ── Styles ───────────────────────────────────────────────────────────────
  const surface = isDark
    ? { background: "#16131F", border: "1px solid rgba(255,255,255,0.09)", color: "#E8E3DE" }
    : { background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.10)", color: "#1A1714" };

  const itemCls = [
    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium",
    "cursor-pointer transition-colors duration-100 select-none",
    isDark
      ? "hover:bg-white/6 text-white/75 hover:text-white"
      : "hover:bg-black/4 text-[#3D3733] hover:text-[#1A1714]",
  ].join(" ");

  const sectionLabelCls = "block text-[10px] font-bold tracking-[0.08em] uppercase px-3 pt-1.5 pb-0.5 text-[#B5AFA9] dark:text-white/28 m-0";
  const dividerCls = "h-px my-1 bg-black/6 dark:bg-white/6";

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger */}
      {/* suppressHydrationWarning: this button has theme-dependent inline styles.
          The mounted pattern ensures isDark=false on both server and first client
          render, but suppressHydrationWarning guards against any residual React 19
          strict-hydration warnings from numeric→string unit coercion (e.g. 34 → "34px"). */}
      <button
        onClick={() => (open ? closeDropdown() : openDropdown())}
        aria-label="Board settings"
        title="Board settings"
        suppressHydrationWarning
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "9px",
          background: open
            ? isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.07)"
            : isDark ? "rgba(255,255,255,0.04)" : "#FFFDF9",
          border: isDark ? "1px solid rgba(255,255,255,0.09)" : "1px solid rgba(0,0,0,0.09)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: open
            ? isDark ? "rgba(255,255,255,0.85)" : "#1A1714"
            : isDark ? "rgba(255,255,255,0.35)" : "#9A8F85",
          cursor: "pointer",
          boxShadow: isDark ? "none" : "0 1px 4px rgba(0,0,0,0.05)",
          transition: "all 0.15s ease",
        }}
      >
        <Settings className={`w-3.5 h-3.5 transition-transform duration-300 ease-in-out${open ? " rotate-45" : ""}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 9999,
            width: "248px",
            borderRadius: "14px",
            boxShadow: isDark
              ? "0 24px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.07)"
              : "0 12px 40px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)",
            overflow: "hidden",
            ...surface,
          }}
        >
          {/* ── MAIN PANEL ── */}
          {panel === "main" && (
            <>
              {/* Header */}
              <div
                className="pt-3 px-3.5 pb-2"
                style={{ borderBottom: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.05)" }}
              >
                <p className="m-0 text-[13px] font-bold font-['Playfair_Display',serif]" style={{ color: isDark ? "#E8E3DE" : "#1A1714" }}>
                  Board Settings
                </p>
                <p className="mt-[2px] text-[11px]" style={{ color: isDark ? "rgba(255,255,255,0.35)" : "#B5AFA9" }}>
                  {boardTitle}
                </p>
              </div>

              <div className="p-1.5">
                {/* General section */}
                <p className={sectionLabelCls}>General</p>

                <button className={itemCls} onClick={() => setPanel("rename")}>
                  <Pencil className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  <span className="flex-1 text-left">Rename board</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-30" />
                </button>

                <button className={itemCls} onClick={() => setPanel("background")}>
                  <ImageIcon className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  <span className="flex-1 text-left">Change background</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-30" />
                </button>

                <button className={itemCls} onClick={handleCopyLink}>
                  <Link2 className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  <span className="flex-1 text-left">Copy board link</span>
                  <Copy className="w-3 h-3 opacity-30" />
                </button>

                <div className={dividerCls} />

                {/* Data section */}
                <p className={sectionLabelCls}>Data</p>

                <button
                  className={itemCls}
                  onClick={() => {
                    closeDropdown();
                    router.push(`/board/${boardId}/settings`);
                  }}
                >
                  <Settings2 className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  <span className="flex-1 text-left">Custom fields</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-30" />
                </button>

                <button className={itemCls} onClick={() => setPanel("export")}>
                  <FileJson className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  <span className="flex-1 text-left">Export board</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-30" />
                </button>

                <div className={dividerCls} />

                {/* Danger section */}
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors duration-100 select-none text-[#F43F5E] hover:bg-rose-500/10"
                  onClick={() => setPanel("delete")}
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1 text-left">Delete board</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                </button>
              </div>
            </>
          )}

          {/* ── RENAME PANEL ── */}
          {panel === "rename" && (
            <>
              <PanelHeader title="Rename Board" onBack={() => setPanel("main")} isDark={isDark} />
              <div className="px-3.5 py-3">
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => { setRenameValue(e.target.value); setRenameError(""); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename();
                    if (e.key === "Escape") setPanel("main");
                  }}
                  placeholder="Board name"
                  maxLength={100}
                  className="w-full py-2 px-2.5 rounded-lg text-[13px] outline-none box-border"
                  style={{
                    border: renameError
                      ? "1.5px solid #F43F5E"
                      : isDark ? "1.5px solid rgba(255,255,255,0.12)" : "1.5px solid rgba(0,0,0,0.13)",
                    background: isDark ? "rgba(255,255,255,0.05)" : "#F7F5F2",
                    color: isDark ? "#E8E3DE" : "#1A1714",
                  }}
                />
                {renameError && (
                  <p className="mt-[5px] text-[11px] text-[#F43F5E]">
                    {renameError}
                  </p>
                )}
                <p className="mt-1 mb-2.5 text-[11px] text-right" style={{ color: isDark ? "rgba(255,255,255,0.28)" : "#B5AFA9" }}>
                  {renameValue.length}/100
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPanel("main")}
                    className="flex-1 py-1.75 rounded-lg text-[13px] font-semibold cursor-pointer"
                    style={{
                      border: isDark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(0,0,0,0.10)",
                      background: isDark ? "rgba(255,255,255,0.05)" : "#F0EDE9",
                      color: isDark ? "rgba(255,255,255,0.55)" : "#6B6560",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRename}
                    disabled={isPending || !renameValue.trim()}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.75 rounded-lg text-[13px] font-semibold text-white border-0 bg-[linear-gradient(135deg,#7B2FF7,#F107A3)] ${isPending || !renameValue.trim() ? "opacity-55 cursor-not-allowed" : "opacity-100 cursor-pointer"}`}
                  >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Save
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── BACKGROUND PANEL ── */}
          {panel === "background" && (
            <>
              <PanelHeader title="Change Background" onBack={() => setPanel("main")} isDark={isDark} />
              <div className="px-3.5 py-3">
                <p className="mb-2.5 text-xs" style={{ color: isDark ? "rgba(255,255,255,0.45)" : "#9A8F85" }}>
                  Pick a photo from Unsplash or remove the current background.
                </p>
                <UnsplashPicker
                  selectedId={currentImageId ?? undefined}
                  onSelect={handleBackgroundSelect}
                  onClear={currentImageId ? handleBackgroundClear : undefined}
                />
                {isPending && (
                  <div className="flex items-center gap-2 mt-2.5 text-xs" style={{ color: isDark ? "rgba(255,255,255,0.4)" : "#9A8F85" }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── EXPORT PANEL ── */}
          {panel === "export" && (
            <>
              <PanelHeader title="Export Board" onBack={() => setPanel("main")} isDark={isDark} />
              <div className="p-2.5">
                <p className="mx-1 mb-2.5 text-xs" style={{ color: isDark ? "rgba(255,255,255,0.40)" : "#9A8F85" }}>
                  Download all lists and cards from this board.
                </p>

                {/* JSON export */}
                <button
                  onClick={handleExportJSON}
                  disabled={exportPending !== null}
                  className={`${itemCls} mb-1.5`}
                  style={{ border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.06)" }}
                >
                  {exportPending === "json"
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin opacity-70 shrink-0" />
                    : <FileJson className="w-3.5 h-3.5 shrink-0 text-[#6366F1]" />}
                  <div className="flex-1 text-left">
                    <p className="m-0 text-xs font-semibold">JSON — Full snapshot</p>
                    <p className="m-0 text-[10px] opacity-50">Cards, labels, checklists, assignees</p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 opacity-30 -rotate-90" />
                </button>

                {/* CSV export */}
                <button
                  onClick={handleExportCSV}
                  disabled={exportPending !== null}
                  className={itemCls}
                  style={{ border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.06)" }}
                >
                  {exportPending === "csv"
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin opacity-70 shrink-0" />
                    : <FileSpreadsheet className="w-3.5 h-3.5 shrink-0 text-[#059669]" />}
                  <div className="flex-1 text-left">
                    <p className="m-0 text-xs font-semibold">CSV — Flat table</p>
                    <p className="m-0 text-[10px] opacity-50">Spreadsheet-compatible, one row per card</p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 opacity-30 -rotate-90" />
                </button>
              </div>
            </>
          )}

          {/* ── DELETE PANEL ── */}
          {panel === "delete" && (
            <>
              <PanelHeader title="Delete Board" onBack={() => setPanel("main")} isDark={isDark} danger />
              <div className="px-3.5 py-3">
                {/* Warning banner */}
                <div className="flex gap-2 items-start px-3 py-2.5 rounded-[10px] mb-3.5 bg-[rgba(244,63,94,0.09)] border border-[rgba(244,63,94,0.22)]">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#F43F5E]" />
                  <p className="m-0 text-xs leading-[1.5]" style={{ color: isDark ? "#FCA5A5" : "#BE123C" }}>
                    This will <strong>permanently delete</strong> all lists, cards, checklists, and attachments. This action cannot be undone.
                  </p>
                </div>

                <p className="mb-1.5 text-xs font-semibold" style={{ color: isDark ? "rgba(255,255,255,0.6)" : "#6B6560" }}>
                  Type <span
                    className="font-mono py-px px-[5px] rounded-[4px]"
                    style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", color: isDark ? "#E8E3DE" : "#1A1714" }}
                  >{boardTitle}</span> to confirm
                </p>

                <input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && deleteConfirmText === boardTitle) handleDelete(); }}
                  placeholder={boardTitle}
                  autoComplete="off"
                  className="w-full py-2 px-2.5 rounded-lg text-[13px] outline-none box-border mb-3 [border:1.5px_solid_rgba(244,63,94,0.35)]"
                  style={{
                    background: isDark ? "rgba(244,63,94,0.06)" : "#FFF5F5",
                    color: isDark ? "#E8E3DE" : "#1A1714",
                  }}
                />

                <button
                  onClick={handleDelete}
                  disabled={isPending || deleteConfirmText !== boardTitle}
                  className="w-full flex items-center justify-center gap-[7px] py-2 rounded-[9px] border-0 text-[13px] font-bold transition-all duration-150 ease-in-out disabled:cursor-not-allowed cursor-pointer"
                  style={{
                    background: deleteConfirmText === boardTitle ? "#F43F5E" : isDark ? "rgba(244,63,94,0.20)" : "rgba(244,63,94,0.12)",
                    color: deleteConfirmText === boardTitle ? "#fff" : "rgba(244,63,94,0.5)",
                    boxShadow: deleteConfirmText === boardTitle ? "0 4px 14px rgba(244,63,94,0.35)" : "none",
                  }}
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {isPending ? "Deleting…" : "Delete board permanently"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-component: Panel back-header ────────────────────────────────────────

function PanelHeader({
  title,
  onBack,
  isDark,
  danger = false,
}: {
  title: string;
  onBack: () => void;
  isDark: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3.5 py-2.5"
      style={{ borderBottom: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.05)" }}
    >
      <button
        onClick={onBack}
        title="Back"
        className="w-6 h-6 rounded-[6px] bg-transparent cursor-pointer flex items-center justify-center shrink-0"
        style={{
          border: isDark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(0,0,0,0.08)",
          color: isDark ? "rgba(255,255,255,0.40)" : "#9A8F85",
        }}
        aria-label="Back"
      >
        <X className="w-3 h-3" />
      </button>
      <p
        className="m-0 text-[13px] font-bold"
        style={{ color: danger ? "#F43F5E" : isDark ? "#E8E3DE" : "#1A1714" }}
      >
        {title}
      </p>
    </div>
  );
}
