"use client";

// This Client Component wrapper holds the ssr:false dynamic import.
// `ssr: false` is only allowed inside Client Components — not Server Components
// like app/board/[boardId]/page.tsx — so we isolate it here.
// This prevents Radix UI Tabs from generating mismatched aria-controls/id
// attributes between the server-render pass and client hydration (useId mismatch).
import dynamic from "next/dynamic";

/**
 * Skeleton rendered while the board JS chunk loads.
 *
 * Mirrors the tab bar + 3 kanban columns so the layout stays stable.
 * aria-hidden keeps the skeleton invisible to screen readers.
 */
function BoardLoadingSkeleton() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden" aria-hidden="true">
      {/* Tab bar skeleton */}
      <div className="h-11 shrink-0 flex items-center gap-1.5 px-4 border-b border-black/6 dark:border-white/6">
        {["w-13", "w-11", "w-16", "w-16", "w-13", "w-16", "w-20"].map((w, i) => (
          <div key={i} className={`${w} h-6.5 rounded-full bg-black/5 dark:bg-white/6 animate-pulse`} />
        ))}
      </div>

      {/* Column skeletons — 3 columns with varying card heights */}
      <div className="flex-1 flex gap-3 p-4 overflow-hidden">
        {/* Column 1 */}
        <div className="shrink-0 w-68 flex flex-col gap-2">
          <div className="h-9 rounded-[10px] bg-black/5 dark:bg-white/6 animate-pulse" />
          <div className="h-20 rounded-2xl bg-black/4 dark:bg-white/5 animate-pulse" />
          <div className="h-14 rounded-2xl bg-black/4 dark:bg-white/5 animate-pulse" />
          <div className="h-16 rounded-2xl bg-black/4 dark:bg-white/5 animate-pulse" />
        </div>
        {/* Column 2 */}
        <div className="shrink-0 w-68 flex flex-col gap-2">
          <div className="h-9 rounded-[10px] bg-black/5 dark:bg-white/6 animate-pulse" />
          <div className="h-14 rounded-2xl bg-black/4 dark:bg-white/5 animate-pulse" />
          <div className="h-20 rounded-2xl bg-black/4 dark:bg-white/5 animate-pulse" />
          <div className="h-14 rounded-2xl bg-black/4 dark:bg-white/5 animate-pulse" />
        </div>
        {/* Column 3 */}
        <div className="shrink-0 w-68 flex flex-col gap-2">
          <div className="h-9 rounded-[10px] bg-black/5 dark:bg-white/6 animate-pulse" />
          <div className="h-16 rounded-2xl bg-black/4 dark:bg-white/5 animate-pulse" />
          <div className="h-14 rounded-2xl bg-black/4 dark:bg-white/5 animate-pulse" />
          <div className="h-20 rounded-2xl bg-black/4 dark:bg-white/5 animate-pulse" />
          <div className="h-14 rounded-2xl bg-black/4 dark:bg-white/5 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

const BoardTabsDynamic = dynamic(
  () => import("@/components/board/board-tabs").then((m) => m.BoardTabs),
  {
    ssr: false,
    loading: () => <BoardLoadingSkeleton />,
  }
);

export function BoardTabsClient(props: React.ComponentProps<typeof BoardTabsDynamic>) {
  return <BoardTabsDynamic {...props} />;
}
