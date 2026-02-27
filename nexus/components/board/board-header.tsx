"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useTheme } from "@/components/theme-provider";
import { useState } from "react";
import { ChevronLeft, Share2 } from "lucide-react";
import { ShareBoardDialog } from "./share-board-dialog";
import { BoardSettingsDropdown } from "./board-settings-dropdown";

// Loaded client-side only — usePresence calls useUser()/useAuth() from Clerk,
// which throws during Next.js App Router SSR pre-render of client components
// before the Clerk auth context has hydrated. ssr: false ensures these Clerk
// hooks only run in the browser where ClerkProvider is fully initialized.
const PresenceUsers = dynamic(
  () => import("./board-presence").then((mod) => ({ default: mod.BoardPresence })),
  { ssr: false }
);

interface BoardHeaderProps {
  boardId: string;
  boardTitle: string;
  /** orgId required for tenant-isolated presence channel */
  orgId: string;
  currentImageId?: string | null;
  onTitleChange?: (title: string) => void;
}

export function BoardHeader({ boardId, boardTitle, orgId, currentImageId, onTitleChange }: BoardHeaderProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <>
    <header
      style={{
        flexShrink: 0,
        zIndex: 10,
        padding: "0 24px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: isDark ? "rgba(13,12,20,0.85)" : "rgba(255,253,249,0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.08)",
        boxShadow: isDark ? "none" : "0 1px 12px rgba(0,0,0,0.06)",
      }}
    >
      {/* LEFT: back + divider + board identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12.5,
            color: isDark ? "rgba(255,255,255,0.35)" : "#9A8F85",
            fontWeight: 500,
            textDecoration: "none",
            padding: "4px 8px",
            borderRadius: 7,
            transition: "color 0.15s ease",
            fontFamily: "'DM Sans', sans-serif",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = isDark ? "rgba(255,255,255,0.7)" : "#1A1714";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = isDark ? "rgba(255,255,255,0.35)" : "#9A8F85";
          }}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back
        </Link>

        <div
          style={{
            width: 1,
            height: 18,
            background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
          }}
        />

        {/* Board identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Logo mark */}
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: "linear-gradient(135deg,#7B2FF7,#F107A3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 800,
              color: "#fff",
              fontFamily: "'Playfair Display', serif",
              boxShadow: "0 4px 14px rgba(123,47,247,0.35)",
              flexShrink: 0,
            }}
          >
            N
          </div>

          {/* Board title */}
          <h1
            style={{
              fontSize: 16,
              fontWeight: 700,
              fontFamily: "'Playfair Display', serif",
              letterSpacing: "-0.02em",
              color: isDark ? undefined : "#0F0D0B",
              background: isDark
                ? "linear-gradient(135deg, #C084FC, #F0ABFC, #818CF8)"
                : undefined,
              WebkitBackgroundClip: isDark ? "text" : undefined,
              WebkitTextFillColor: isDark ? "transparent" : undefined,
              margin: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 240,
            }}
          >
            {boardTitle}
          </h1>

          {/* PROJECT tag */}
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 20,
              background: isDark ? "rgba(123,47,247,0.15)" : "rgba(123,47,247,0.1)",
              color: isDark ? "#A78BFA" : "#7B2FF7",
              border: isDark ? "1px solid rgba(123,47,247,0.3)" : "1px solid rgba(123,47,247,0.2)",
              letterSpacing: "0.05em",
              whiteSpace: "nowrap",
            }}
          >
            PROJECT
          </span>
        </div>
      </div>

      {/* RIGHT: live badge + presence + filter + share + settings */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Live badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            borderRadius: 20,
            background: isDark ? "rgba(79,255,176,0.08)" : "rgba(5,150,105,0.08)",
            border: isDark ? "1px solid rgba(79,255,176,0.2)" : "1px solid rgba(5,150,105,0.2)",
          }}
        >
          <div
            className="animate-pulse-dot"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: isDark ? "#4FFFB0" : "#059669",
              boxShadow: isDark ? "0 0 5px rgba(79,255,176,0.5)" : "0 0 5px rgba(5,150,105,0.4)",
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: isDark ? "#4FFFB0" : "#059669",
            }}
          >
            Live
          </span>
        </div>

        {/* Presence avatars — client-only, see dynamic import above */}
        <PresenceUsers boardId={boardId} orgId={orgId} />

        {/* Share */}
        <button
          onClick={() => setShareOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 9,
            border: isDark ? "1px solid rgba(255,255,255,0.09)" : "1px solid rgba(0,0,0,0.09)",
            background: isDark ? "rgba(255,255,255,0.04)" : "#FFFDF9",
            color: isDark ? "rgba(255,255,255,0.45)" : "#6B6560",
            fontSize: 12.5,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: isDark ? "none" : "0 1px 4px rgba(0,0,0,0.05)",
            transition: "all 0.18s ease",
          }}
        >
          <Share2 className="w-3 h-3" />
          Share
        </button>

        {/* Settings */}
        <BoardSettingsDropdown
          boardId={boardId}
          boardTitle={boardTitle}
          currentImageId={currentImageId}
          onTitleChange={onTitleChange}
        />
      </div>
    </header>

    <ShareBoardDialog
      boardId={boardId}
      boardTitle={boardTitle}
      open={shareOpen}
      onClose={() => setShareOpen(false)}
    />
    </>
  );
}
