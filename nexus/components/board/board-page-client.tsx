"use client";

/**
 * BoardPageClient
 * ───────────────
 * Client-side wrapper that owns the shared `filterBarOpen` state needed to
 * wire the header's Filter button to the filter bar rendered inside BoardTabs.
 *
 * Splitting this into its own "use client" component lets the parent page.tsx
 * remain a Server Component while still sharing ephemeral UI state between
 * BoardHeader and BoardTabsClient (which are otherwise independent siblings).
 */

import { useState } from "react";
import { BoardHeader } from "./board-header";
import { BoardTabsClient } from "./board-tabs-client";

interface BoardPageClientProps {
  boardId: string;
  boardTitle: string;
  orgId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lists: any[];
}

export function BoardPageClient({
  boardId,
  boardTitle,
  orgId,
  lists,
}: BoardPageClientProps) {
  const [filterBarOpen, setFilterBarOpen] = useState(false);

  return (
    <>
      <div className="relative z-10">
        <BoardHeader
          boardId={boardId}
          boardTitle={boardTitle}
          orgId={orgId}
        />
      </div>

      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        <BoardTabsClient
          boardId={boardId}
          boardTitle={boardTitle}
          orgId={orgId}
          lists={lists}
          filterBarOpen={filterBarOpen}
          onFilterBarChange={setFilterBarOpen}
        />
      </div>
    </>
  );
}
