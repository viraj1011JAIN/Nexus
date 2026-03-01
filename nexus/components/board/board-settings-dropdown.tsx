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
      ? "hover:bg-white/[0.06] text-white/75 hover:text-white"
      : "hover:bg-black/[0.04] text-[#3D3733] hover:text-[#1A1714]",
  ].join(" ");

  const sectionLabel = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    padding: "6px 12px 2px",
    color: isDark ? "rgba(255,255,255,0.28)" : "#B5AFA9",
  };

  const divider = {
    height: 1,
    margin: "4px 0",
    background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
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
        <Settings className="w-3.5 h-3.5" style={{ transition: "transform 0.3s ease", transform: open ? "rotate(45deg)" : "none" }} />
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
              <div style={{
                padding: "12px 14px 8px",
                borderBottom: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.05)",
              }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: isDark ? "#E8E3DE" : "#1A1714", fontFamily: "'Playfair Display', serif" }}>
                  Board Settings
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: isDark ? "rgba(255,255,255,0.35)" : "#B5AFA9", fontFamily: "'DM Sans', sans-serif" }}>
                  {boardTitle}
                </p>
              </div>

              <div style={{ padding: "6px 6px" }}>
                {/* General section */}
                <p style={sectionLabel}>General</p>

                <button className={itemCls} onClick={() => setPanel("rename")}>
                  <Pencil className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  <span style={{ flex: 1, textAlign: "left" }}>Rename board</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-30" />
                </button>

                <button className={itemCls} onClick={() => setPanel("background")}>
                  <ImageIcon className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  <span style={{ flex: 1, textAlign: "left" }}>Change background</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-30" />
                </button>

                <button className={itemCls} onClick={handleCopyLink}>
                  <Link2 className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  <span style={{ flex: 1, textAlign: "left" }}>Copy board link</span>
                  <Copy className="w-3 h-3 opacity-30" />
                </button>

                <div style={divider} />

                {/* Data section */}
                <p style={sectionLabel}>Data</p>

                <button
                  className={itemCls}
                  onClick={() => {
                    closeDropdown();
                    router.push(`/board/${boardId}/settings`);
                  }}
                >
                  <Settings2 className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  <span style={{ flex: 1, textAlign: "left" }}>Custom fields</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-30" />
                </button>

                <button className={itemCls} onClick={() => setPanel("export")}>
                  <FileJson className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  <span style={{ flex: 1, textAlign: "left" }}>Export board</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-30" />
                </button>

                <div style={divider} />

                {/* Danger section */}
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors duration-100 select-none"
                  style={{ color: "#F43F5E" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.10)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  onClick={() => setPanel("delete")}
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span style={{ flex: 1, textAlign: "left" }}>Delete board</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                </button>
              </div>
            </>
          )}

          {/* ── RENAME PANEL ── */}
          {panel === "rename" && (
            <>
              <PanelHeader title="Rename Board" onBack={() => setPanel("main")} isDark={isDark} />
              <div style={{ padding: "12px 14px" }}>
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
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: renameError
                      ? "1.5px solid #F43F5E"
                      : isDark ? "1.5px solid rgba(255,255,255,0.12)" : "1.5px solid rgba(0,0,0,0.13)",
                    background: isDark ? "rgba(255,255,255,0.05)" : "#F7F5F2",
                    color: isDark ? "#E8E3DE" : "#1A1714",
                    fontSize: 13,
                    fontFamily: "'DM Sans', sans-serif",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                {renameError && (
                  <p style={{ margin: "5px 0 0", fontSize: 11, color: "#F43F5E", fontFamily: "'DM Sans', sans-serif" }}>
                    {renameError}
                  </p>
                )}
                <p style={{ margin: "4px 0 10px", fontSize: 11, color: isDark ? "rgba(255,255,255,0.28)" : "#B5AFA9", fontFamily: "'DM Sans', sans-serif", textAlign: "right" }}>
                  {renameValue.length}/100
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setPanel("main")}
                    style={{
                      flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: "pointer", border: isDark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(0,0,0,0.10)",
                      background: isDark ? "rgba(255,255,255,0.05)" : "#F0EDE9", color: isDark ? "rgba(255,255,255,0.55)" : "#6B6560",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRename}
                    disabled={isPending || !renameValue.trim()}
                    style={{
                      flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: isPending ? "not-allowed" : "pointer",
                      border: "none", background: "linear-gradient(135deg,#7B2FF7,#F107A3)",
                      color: "#fff", opacity: isPending || !renameValue.trim() ? 0.55 : 1,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
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
              <div style={{ padding: "12px 14px" }}>
                <p style={{ margin: "0 0 10px", fontSize: 12, color: isDark ? "rgba(255,255,255,0.45)" : "#9A8F85", fontFamily: "'DM Sans', sans-serif" }}>
                  Pick a photo from Unsplash or remove the current background.
                </p>
                <UnsplashPicker
                  selectedId={currentImageId ?? undefined}
                  onSelect={handleBackgroundSelect}
                  onClear={currentImageId ? handleBackgroundClear : undefined}
                />
                {isPending && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12, color: isDark ? "rgba(255,255,255,0.4)" : "#9A8F85", fontFamily: "'DM Sans', sans-serif" }}>
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
              <div style={{ padding: "10px 10px" }}>
                <p style={{ margin: "0 4px 10px", fontSize: 12, color: isDark ? "rgba(255,255,255,0.40)" : "#9A8F85", fontFamily: "'DM Sans', sans-serif" }}>
                  Download all lists and cards from this board.
                </p>

                {/* JSON export */}
                <button
                  onClick={handleExportJSON}
                  disabled={exportPending !== null}
                  className={itemCls}
                  style={{ border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.06)", marginBottom: 6 }}
                >
                  {exportPending === "json"
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin opacity-70 shrink-0" />
                    : <FileJson className="w-3.5 h-3.5 shrink-0" style={{ color: "#6366F1" }} />}
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>JSON — Full snapshot</p>
                    <p style={{ margin: 0, fontSize: 10, opacity: 0.5 }}>Cards, labels, checklists, assignees</p>
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
                    : <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" style={{ color: "#059669" }} />}
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>CSV — Flat table</p>
                    <p style={{ margin: 0, fontSize: 10, opacity: 0.5 }}>Spreadsheet-compatible, one row per card</p>
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
              <div style={{ padding: "12px 14px" }}>
                {/* Warning banner */}
                <div style={{
                  display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px",
                  borderRadius: 10, marginBottom: 14,
                  background: "rgba(244,63,94,0.09)", border: "1px solid rgba(244,63,94,0.22)",
                }}>
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#F43F5E" }} />
                  <p style={{ margin: 0, fontSize: 12, color: isDark ? "#FCA5A5" : "#BE123C", lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>
                    This will <strong>permanently delete</strong> all lists, cards, checklists, and attachments. This action cannot be undone.
                  </p>
                </div>

                <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: isDark ? "rgba(255,255,255,0.6)" : "#6B6560", fontFamily: "'DM Sans', sans-serif" }}>
                  Type <span style={{ fontFamily: "monospace", background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", padding: "1px 5px", borderRadius: 4, color: isDark ? "#E8E3DE" : "#1A1714" }}>{boardTitle}</span> to confirm
                </p>

                <input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && deleteConfirmText === boardTitle) handleDelete(); }}
                  placeholder={boardTitle}
                  autoComplete="off"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1.5px solid rgba(244,63,94,0.35)",
                    background: isDark ? "rgba(244,63,94,0.06)" : "#FFF5F5",
                    color: isDark ? "#E8E3DE" : "#1A1714",
                    fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                    outline: "none", boxSizing: "border-box", marginBottom: 12,
                  }}
                />

                <button
                  onClick={handleDelete}
                  disabled={isPending || deleteConfirmText !== boardTitle}
                  style={{
                    width: "100%", padding: "8px 0", borderRadius: 9, border: "none",
                    background: deleteConfirmText === boardTitle ? "#F43F5E" : isDark ? "rgba(244,63,94,0.20)" : "rgba(244,63,94,0.12)",
                    color: deleteConfirmText === boardTitle ? "#fff" : "rgba(244,63,94,0.5)",
                    fontSize: 13, fontWeight: 700, cursor: deleteConfirmText === boardTitle ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    fontFamily: "'DM Sans', sans-serif",
                    transition: "all 0.15s ease",
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
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        borderBottom: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.05)",
      }}
    >
      <button
        onClick={onBack}
        title="Back"
        style={{
          width: 24, height: 24, borderRadius: 6,
          border: isDark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(0,0,0,0.08)",
          background: "transparent", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: isDark ? "rgba(255,255,255,0.40)" : "#9A8F85",
          flexShrink: 0,
        }}
        aria-label="Back"
      >
        <X className="w-3 h-3" />
      </button>
      <p
        style={{
          margin: 0, fontSize: 13, fontWeight: 700,
          fontFamily: "'DM Sans', sans-serif",
          color: danger ? "#F43F5E" : isDark ? "#E8E3DE" : "#1A1714",
        }}
      >
        {title}
      </p>
    </div>
  );
}
