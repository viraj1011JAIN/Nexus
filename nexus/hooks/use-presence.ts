"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase/client";
import { boardPresenceChannel } from "@/lib/realtime-channels";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface PresenceUser {
  userId: string;
  userName: string;
  userAvatar: string;
  joinedAt: string;
  color: string; // Unique color for cursor/presence indicator
}

interface UsePresenceOptions {
  boardId: string;
  /** orgId is required â€” presence channels without orgId allow cross-tenant user tracking */
  orgId: string;
  enabled?: boolean;
}

/**
 * Presence tracking hook â€” Shows who's online on the board.
 *
 * Uses Supabase Presence to track users viewing the same board in real-time.
 * Each user broadcasts their info, and the hook aggregates all online users.
 *
 * Bandwidth optimisations:
 * - Presence sync updates are throttled to at most one React re-render per 500 ms
 *   to prevent the NÂ² event storm that occurs when many users are on the same board.
 * - The Visibility API is used to automatically unsubscribe from the Supabase channel
 *   the moment the user switches away from the browser tab, and to re-subscribe when
 *   they return. This eliminates "ghost" presence entries and reduces quota usage.
 *
 * @example
 * ```typescript
 * const { onlineUsers, isTracking } = usePresence({
 *   boardId: "board-123",
 *   orgId: "org-456",
 *   enabled: true
 * });
 * ```
 */
export function usePresence({ boardId, orgId, enabled = true }: UsePresenceOptions) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable refs so the visibilitychange listener can call cleanup/setup without
  // capturing stale closure values from the initial render.
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef<ReturnType<typeof getAuthenticatedSupabaseClient> | null>(null);
  /**
   * Timer ref for trailing debounce on presence "sync" events.
   *
   * Why trailing debounce instead of the old leading throttle:
   * - With N users on one board, Supabase fires a "sync" event for every
   *   individual join/leave. During a burst (e.g. 50 users arriving within
   *   200 ms) the old leading throttle captured the FIRST snapshot (mostly
   *   empty) then silently dropped all subsequent events — the UI showed 1
   *   user instead of 50 until the next event fired naturally.
   * - A trailing debounce waits for the storm to settle, then reads the
   *   channel's accumulated presence state exactly once. 300 ms covers any
   *   realistic server-side fan-out delay while still feeling instant to humans.
   */
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Debounce window in ms — presence state is computed once after events stop. */
  const SYNC_DEBOUNCE_MS = 300;

  // Generate a consistent color for the current user
  const getUserColor = useCallback((userId: string) => {
    const colors = [
      "#EF4444", // red
      "#F59E0B", // amber
      "#10B981", // green
      "#3B82F6", // blue
      "#8B5CF6", // purple
      "#EC4899", // pink
      "#14B8A6", // teal
      "#F97316", // orange
    ];
    const hash = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }, []);

  useEffect(() => {
    // Skip if disabled, no boardId, no orgId, or no user
    if (!enabled || !boardId || !orgId || !user) {
      return;
    }

    // Channel name includes orgId â€” prevents cross-tenant presence tracking
    const channelName = boardPresenceChannel(orgId, boardId);

    // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /** Untrack, remove channel, and reset state. */
    const cleanup = () => {
      // Cancel any pending debounced sync before tearing down the channel so
      // a stale setTimeout callback can't attempt to read a removed channel.
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      if (channelRef.current && supabaseRef.current) {
        channelRef.current.untrack();
        supabaseRef.current.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsTracking(false);
      setOnlineUsers([]);
    };

    /** Subscribe to the Supabase presence channel and start tracking. */
    const setupPresence = async () => {
      try {
        // â”€â”€ Board membership pre-flight â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Verify the caller still has an active BoardMember row for this board
        // before opening a Supabase channel. The Clerk JWT only encodes org-level
        // membership; this check adds the board-level gate. Fail closed.
        try {
          const preflight = await fetch(
            `/api/realtime-auth?boardId=${encodeURIComponent(boardId)}`,
            { cache: "no-store" },
          );
          if (!preflight.ok) {
            setError("Board access denied â€” you may have been removed from this board");
            return;
          }
        } catch {
          // Network error during preflight â€” fail open so the app stays usable
          // on transient connectivity issues; org-scoped channel name still
          // provides defence-in-depth isolation.
        }

        let token: string | null = null;
        try {
          token = await getToken({ template: "supabase" });
        } catch {
          // Template not configured â€” degrade gracefully to anon key
        }

        const supabase = getAuthenticatedSupabaseClient(token);
        supabaseRef.current = supabase;

        const channel = supabase.channel(channelName, {
          config: { presence: { key: user.id } },
        });
        channelRef.current = channel;

        // ── Presence sync — trailing debounce ─────────────────────────────────
        // Each join/leave fires a "sync" event, so N user bursts produce O(N)
        // rapid callbacks. We reschedule a single timer on each arrival and only
        // compute + commit state once the storm settles — exactly one re-render
        // per burst regardless of how many users join simultaneously.
        const computePresenceState = () => {
          if (!channelRef.current) return;
          const state = channelRef.current.presenceState();
          const seen = new Set<string>();
          const users: PresenceUser[] = [];

          Object.keys(state).forEach((key) => {
            const presence = state[key][0] as unknown as {
              userId?: string;
              userName?: string;
              userAvatar?: string;
              joinedAt?: string;
              color?: string;
            };
            if (!presence) return;
            const uid: string = presence.userId ?? key;
            if (seen.has(uid)) return;
            seen.add(uid);
            users.push({
              userId: uid,
              userName: presence.userName ?? "Anonymous",
              userAvatar: presence.userAvatar ?? "",
              joinedAt: presence.joinedAt ?? new Date().toISOString(),
              color: presence.color ?? getUserColor(uid),
            });
          });

          setOnlineUsers(users);
        };

        channel.on("presence", { event: "sync" }, () => {
          if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
          syncTimerRef.current = setTimeout(computePresenceState, SYNC_DEBOUNCE_MS);
        });

        channel.on("presence", { event: "join" }, () => {
          // Handled via debounced sync event above
        });

        channel.on("presence", { event: "leave" }, () => {
          // Handled via debounced sync event above
        });

        channel.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({
              userId: user.id,
              userName: user.fullName || user.firstName || "Anonymous",
              userAvatar: user.imageUrl,
              joinedAt: new Date().toISOString(),
              color: getUserColor(user.id),
            });
            setIsTracking(true);
            setError(null);
          } else if (status === "CHANNEL_ERROR") {
            setIsTracking(false);
            setError("Failed to start presence tracking");
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    };

    // â”€â”€ Visibility API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // When the user navigates away from the browser tab the board is in:
    //   - Immediately unsubscribe so the user doesn't appear "online" to others.
    //   - Re-subscribe when the tab becomes visible again.
    //
    // This eliminates "ghost" presence entries and dramatically reduces Supabase
    // quota consumption during multi-user spikes (each hidden tab previously
    // continued broadcasting heartbeats indefinitely).
    const handleVisibilityChange = () => {
      if (document.hidden) {
        cleanup();
      } else {
        // Re-subscribe when user returns to the tab
        setupPresence();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Initial subscribe â€” only if the tab is already visible
    if (!document.hidden) {
      setupPresence();
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      cleanup();
    };
  // getToken is intentionally excluded from the dependency array.
  // Clerk guarantees that getToken's function reference is identity-stable across
  // renders â€” adding it would cause unnecessary channel teardowns.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, orgId, enabled, user, getUserColor]);

  return {
    onlineUsers,
    currentUser: onlineUsers.find((u) => u.userId === user?.id),
    totalOnline: onlineUsers.length,
    isTracking,
    error,
  };
}

