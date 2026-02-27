"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
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

export function BoardHeader({
  boardId,
  boardTitle,
  orgId,
  currentImageId,
  onTitleChange,
}: BoardHeaderProps) {
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <>
      <header className="shrink-0 z-10 px-6 h-14 flex items-center justify-between bg-[rgba(255,253,249,0.92)] dark:bg-[rgba(13,12,20,0.85)] backdrop-blur-[16px] border-b border-b-black/[0.08] dark:border-b-white/[0.07] shadow-[0_1px_12px_rgba(0,0,0,0.06)] dark:shadow-none">

        {/* LEFT: back + divider + board identity */}
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-[5px] text-[12.5px] font-medium no-underline py-1 px-2 rounded-[7px] transition-colors duration-150 ease-in-out text-[#9A8F85] hover:text-[#1A1714] dark:text-white/35 dark:hover:text-white/70 font-[family-name:var(--font-dm-sans)]"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </Link>

          {/* vertical rule */}
          <div className="w-px h-[18px] bg-black/10 dark:bg-white/10" />

          {/* Board identity */}
          <div className="flex items-center gap-[10px]">
            {/* Logo mark */}
            <div className="w-[30px] h-[30px] rounded-[9px] bg-gradient-to-br from-[#7B2FF7] to-[#F107A3] flex items-center justify-center text-[13px] font-extrabold text-white font-[family-name:var(--font-playfair)] shadow-[0_4px_14px_rgba(123,47,247,0.35)] shrink-0">
              N
            </div>

            {/* Board title */}
            <h1 className="m-0 text-base font-bold tracking-[-0.02em] font-[family-name:var(--font-playfair)] whitespace-nowrap overflow-hidden text-ellipsis max-w-[240px] text-[#0F0D0B] dark:text-transparent dark:bg-gradient-to-br dark:from-[#C084FC] dark:via-[#F0ABFC] dark:to-[#818CF8] dark:bg-clip-text">
              {boardTitle}
            </h1>

            {/* PROJECT badge */}
            <span className="text-[10px] font-bold py-[2px] px-2 rounded-full tracking-[0.05em] whitespace-nowrap bg-[rgba(123,47,247,0.1)] text-[#7B2FF7] border border-[rgba(123,47,247,0.2)] dark:bg-[rgba(123,47,247,0.15)] dark:text-[#A78BFA] dark:border-[rgba(123,47,247,0.3)]">
              PROJECT
            </span>
          </div>
        </div>

        {/* RIGHT: live badge + presence + share + settings */}
        <div className="flex items-center gap-2">

          {/* Live badge */}
          <div className="flex items-center gap-[6px] py-[5px] px-[10px] rounded-full bg-[rgba(5,150,105,0.08)] border border-[rgba(5,150,105,0.2)] dark:bg-[rgba(79,255,176,0.08)] dark:border-[rgba(79,255,176,0.2)]">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse-dot bg-[#059669] shadow-[0_0_5px_rgba(5,150,105,0.4)] dark:bg-[#4FFFB0] dark:shadow-[0_0_5px_rgba(79,255,176,0.5)]" />
            <span className="text-[11px] font-semibold text-[#059669] dark:text-[#4FFFB0]">
              Live
            </span>
          </div>

          {/* Presence avatars — client-only, see dynamic import above */}
          <PresenceUsers boardId={boardId} orgId={orgId} />

          {/* Share */}
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-[6px] py-[6px] px-3 rounded-[9px] border cursor-pointer text-[12.5px] font-medium transition-all duration-[180ms] ease-in-out font-[family-name:var(--font-dm-sans)] border-black/[0.09] bg-[#FFFDF9] text-[#6B6560] shadow-[0_1px_4px_rgba(0,0,0,0.05)] hover:opacity-80 dark:border-white/[0.09] dark:bg-white/[0.04] dark:text-white/45 dark:shadow-none"
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
