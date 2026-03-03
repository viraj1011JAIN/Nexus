"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useCallback, startTransition } from "react";
import { ChevronLeft, Share2 } from "lucide-react";
// Dynamic — both components import server actions; static import would create
// a stale Turbopack stub reference after any HMR update.
const ShareBoardDialog = dynamic(() =>
  import("./share-board-dialog").then((m) => ({ default: m.ShareBoardDialog }))
);
const BoardSettingsDropdown = dynamic(() =>
  import("./board-settings-dropdown").then((m) => ({ default: m.BoardSettingsDropdown }))
);

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
  const router = useRouter();
  const [shareOpen, setShareOpen] = useState(false);

  /**
   * Navigate back using the View Transitions API when the browser supports it.
   * Falls back to a plain router.push() wrapped in startTransition so React
   * keeps rendering the current page during the async navigation — preventing
   * the blank-flash that occurs with a synchronous href change.
   */
  const handleBack = useCallback(() => {
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      (document as Document & { startViewTransition: (cb: () => void) => void })
        .startViewTransition(() => {
          startTransition(() => router.push("/"));
        });
    } else {
      startTransition(() => router.push("/"));
    }
  }, [router]);

  return (
    <>
      {/* px-3 sm:px-6 compresses on small screens; min-w-0 + flex-1 for proper truncation */}
      <header className="shrink-0 z-10 px-3 sm:px-6 h-14 flex items-center justify-between gap-2 bg-[rgba(255,253,249,0.92)] dark:bg-[rgba(13,12,20,0.85)] backdrop-blur-lg border-b border-b-black/8 dark:border-b-white/7 shadow-[0_1px_12px_rgba(0,0,0,0.06)] dark:shadow-none">

        {/* LEFT: back + divider + board identity */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back to home"
            className="flex items-center gap-1.25 text-[12.5px] font-medium py-1 px-2 rounded-[7px] transition-colors duration-150 ease-in-out text-[#9A8F85] hover:text-[#1A1714] dark:text-white/35 dark:hover:text-white/70 font-(family-name:--font-dm-sans) shrink-0 cursor-pointer bg-transparent border-0 outline-none"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* vertical rule — hidden on mobile to save space */}
          <div className="hidden sm:block w-px h-4.5 bg-black/10 dark:bg-white/10 shrink-0" />

          {/* Board identity */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Logo mark — decorative, board title is in h1 */}
            <div aria-hidden="true" className="w-7.5 h-7.5 rounded-[9px] bg-linear-to-br from-[#7B2FF7] to-[#F107A3] flex items-center justify-center text-[13px] font-extrabold text-white font-(family-name:--font-playfair) shadow-[0_4px_14px_rgba(123,47,247,0.35)] shrink-0">
              N
            </div>

            {/* Board title — shorter max-w on mobile */}
            <h1 className="m-0 text-base font-bold tracking-[-0.02em] font-(family-name:--font-playfair) whitespace-nowrap overflow-hidden text-ellipsis max-w-27.5 sm:max-w-60 text-[#0F0D0B] dark:text-transparent dark:bg-linear-to-br dark:from-[#C084FC] dark:via-[#F0ABFC] dark:to-[#818CF8] dark:bg-clip-text">
              {boardTitle}
            </h1>

            {/* PROJECT badge — hidden on mobile */}
            <span className="hidden sm:inline-block text-[10px] font-bold py-0.5 px-2 rounded-full tracking-[0.05em] whitespace-nowrap bg-[rgba(123,47,247,0.1)] text-[#7B2FF7] border border-[rgba(123,47,247,0.2)] dark:bg-[rgba(123,47,247,0.15)] dark:text-[#A78BFA] dark:border-[rgba(123,47,247,0.3)]">
              PROJECT
            </span>
          </div>
        </div>

        {/* RIGHT: live badge + presence + share + settings */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

          {/* Live badge — announces real-time sync status */}
          <div
            role="status"
            aria-label="Board is live and syncing in real time"
            className="flex items-center gap-1.5 py-1.25 px-2.5 rounded-full bg-[rgba(5,150,105,0.08)] border border-[rgba(5,150,105,0.2)] dark:bg-[rgba(79,255,176,0.08)] dark:border-[rgba(79,255,176,0.2)]"
          >
            <div aria-hidden="true" className="w-1.5 h-1.5 rounded-full animate-pulse-dot bg-[#059669] shadow-[0_0_5px_rgba(5,150,105,0.4)] dark:bg-[#4FFFB0] dark:shadow-[0_0_5px_rgba(79,255,176,0.5)]" />
            <span aria-hidden="true" className="hidden sm:inline text-[11px] font-semibold text-[#059669] dark:text-[#4FFFB0]">
              Live
            </span>
          </div>

          {/* Presence avatars — hidden on mobile, visible sm+ */}
          <div className="hidden sm:block">
            <PresenceUsers boardId={boardId} orgId={orgId} />
          </div>

          {/* Share — icon only on mobile, icon + label on sm+ */}
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            aria-label="Share board"
            aria-haspopup="dialog"
            className="flex items-center gap-1.25 py-1.5 px-2 sm:px-3 rounded-[9px] cursor-pointer text-[12.5px] font-semibold transition-all duration-150 ease-in-out font-(family-name:--font-dm-sans) bg-linear-to-br from-[#7B2FF7] to-[#F107A3] text-white border border-white/20 shadow-[0_0_14px_rgba(241,7,163,0.4),0_2px_8px_rgba(123,47,247,0.3)] hover:shadow-[0_0_22px_rgba(241,7,163,0.6),0_4px_14px_rgba(123,47,247,0.45)] hover:scale-[1.03] active:scale-[0.97]"
          >
            <Share2 className="w-3 h-3" />
            <span className="hidden sm:inline">Share</span>
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
