"use client";

// This Client Component wrapper holds the ssr:false dynamic import.
// `ssr: false` is only allowed inside Client Components — not Server Components
// like app/board/[boardId]/page.tsx — so we isolate it here.
// This prevents Radix UI Tabs from generating mismatched aria-controls/id
// attributes between the server-render pass and client hydration (useId mismatch).
import dynamic from "next/dynamic";

const BoardTabsDynamic = dynamic(
  () => import("@/components/board/board-tabs").then((m) => m.BoardTabs),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  }
);

export function BoardTabsClient(props: React.ComponentProps<typeof BoardTabsDynamic>) {
  return <BoardTabsDynamic {...props} />;
}
