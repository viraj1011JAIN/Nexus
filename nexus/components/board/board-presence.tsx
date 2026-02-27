"use client";

/**
 * BoardPresence
 * ─────────────
 * Thin client-only wrapper that owns the usePresence hook call.
 *
 * This component is intentionally loaded via `next/dynamic` with `ssr: false`
 * inside BoardHeader. That prevents it from being pre-rendered on the server,
 * which is where the Clerk `useUser()` call inside `usePresence` would throw
 * "useUser can only be used within <ClerkProvider />" — the Clerk auth context
 * isn't hydrated during Next.js App Router SSR pre-rendering of client
 * components.
 *
 * Splitting presence into its own file keeps the static parts of BoardHeader
 * (title, navigation, settings) server-renderable while allowing this Clerk-
 * and Supabase-dependent slice to run client-side only.
 */

import { usePresence } from "@/hooks/use-presence";
import { OnlineUsers } from "./online-users";

interface BoardPresenceProps {
  boardId: string;
  orgId: string;
}

export function BoardPresence({ boardId, orgId }: BoardPresenceProps) {
  const { onlineUsers, totalOnline, isTracking } = usePresence({
    boardId,
    orgId,
    enabled: true,
  });

  return (
    <OnlineUsers
      users={onlineUsers}
      totalOnline={totalOnline}
      isTracking={isTracking}
    />
  );
}
