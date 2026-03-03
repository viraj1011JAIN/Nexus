"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { Card, List, Comment, CommentReaction } from "@prisma/client";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase/client";
import { boardChannel } from "@/lib/realtime-channels";
import { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";
import { announce } from "@/components/accessibility/aria-live-region";

type CardPayload = RealtimePostgresChangesPayload<Database["public"]["Tables"]["Card"]["Row"]>;
type ListPayload = RealtimePostgresChangesPayload<Database["public"]["Tables"]["List"]["Row"]>;
// Phase 3: Using Prisma types since Supabase types may not be generated yet
type CommentPayload = RealtimePostgresChangesPayload<Comment>;
type ReactionPayload = RealtimePostgresChangesPayload<CommentReaction>;

interface UseRealtimeBoardOptions {
  boardId: string;
  /** orgId is required — channels without orgId allow cross-tenant subscriptions */
  orgId: string;
  onCardCreated?: (card: Card) => void;
  onCardUpdated?: (card: Card) => void;
  onCardDeleted?: (cardId: string) => void;
  onListCreated?: (list: List) => void;
  onListUpdated?: (list: List) => void;
  onListDeleted?: (listId: string) => void;
  // Phase 3: Comment and Reaction callbacks
  onCommentCreated?: (comment: Comment) => void;
  onCommentUpdated?: (comment: Comment) => void;
  onCommentDeleted?: (commentId: string) => void;
  onReactionAdded?: (reaction: CommentReaction) => void;
  onReactionRemoved?: (reactionId: string) => void;
  /**
   * When `true` (default), broadcasts human-readable announcements to the
   * global ARIA Live Region for every remote collaborative event so screen
   * reader users are kept aware of changes made by other collaborators.
   *
   * Set to `false` if the consumer already handles its own announcements.
   */
  announceRemoteChanges?: boolean;
}

/**
 * Real-time board synchronization hook (Phase 3 Enhanced)
 * 
 * Subscribes to postgres_changes events for:
 * - Cards: title, description, priority, due date changes
 * - Lists: title, order changes
 * - Comments: creation, updates, deletions
 * - Reactions: emoji additions, removals
 * 
 * Updates are received instantly when other users make changes.
 * 
 * **Phase 3 Enhancements:**
 * - Real-time priority updates
 * - Real-time due date changes
 * - Real-time comments with threading
 * - Real-time emoji reactions
 * 
 * @example
 * ```typescript
 * const { isConnected, error } = useRealtimeBoard({
 *   boardId: "board-123",
 *   onCardUpdated: (card) => {
 *     // Update card with new priority/dueDate
 *     setCards(prev => prev.map(c => c.id === card.id ? card : c));
 *     if (card.priority === "URGENT") {
 *       toast.warning(`${card.title} marked as URGENT!`);
 *     }
 *   },
 *   onCommentCreated: (comment) => {
 *     // Add comment to thread
 *     setComments(prev => [...prev, comment]);
 *     toast.info(`New comment from ${comment.userName}`);
 *   },
 *   onReactionAdded: (reaction) => {
 *     // Update reaction count
 *     setReactions(prev => [...prev, reaction]);
 *   }
 * });
 * ```
 */
export function useRealtimeBoard({
  boardId,
  orgId,
  onCardCreated,
  onCardUpdated,
  onCardDeleted,
  onListCreated,
  onListUpdated,
  onListDeleted,
  onCommentCreated,
  onCommentUpdated,
  onCommentDeleted,
  onReactionAdded,
  onReactionRemoved,
  announceRemoteChanges = true,
}: UseRealtimeBoardOptions) {
  const { getToken } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Use refs so retry bookkeeping never triggers re-renders (avoiding
  // the infinite loop: CHANNEL_ERROR → setState → effect re-runs → new sub → error)
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── Version gate — race condition prevention ──────────────────────────────
  // When multiple users move cards simultaneously, a remote broadcast from
  // Supabase can arrive AFTER the local user has already committed a newer
  // drag. Without a guard, the stale broadcast would snap the card back to
  // its old position ("state flickering").
  //
  // Strategy: when a local drag operation starts, record `Date.now()` for
  // that card. Remote UPDATE events are suppressed for that card until 2 s
  // after the most recent local operation — enough time for any in-flight
  // Supabase broadcasts from the same card to arrive and be dropped.
  //
  // 2 s is chosen because:
  //   - Supabase postgres_changes latency is typically < 200 ms
  //   - 2 s covers the 95th-percentile latency spike under load
  //   - Cards that are NOT being dragged locally are never suppressed (Map miss)
  const localOpTimestampRef = useRef(new Map<string, number>());
  const LOCAL_OP_SUPPRESS_MS = 2_000;

  // Stable callback refs to prevent re-subscriptions
  const handleCardChange = useCallback(
    (payload: CardPayload) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      switch (eventType) {
        case "INSERT":
          if (newRecord && onCardCreated) {
            onCardCreated(newRecord as unknown as Card);
          }
          // Observer announcement — a collaborator added a card
          if (announceRemoteChanges && newRecord) {
            announce(`New card "${(newRecord as { title?: string }).title ?? "Untitled"}" was added to the board by a collaborator.`);
          }
          break;
        case "UPDATE": {
          if (!newRecord) break;

          // ── Version gate ────────────────────────────────────────────────
          // If this card has had a local drag operation in the last
          // LOCAL_OP_SUPPRESS_MS, drop the remote broadcast — it is stale
          // relative to the user's current local state.
          const suppressedUntil = localOpTimestampRef.current.get(newRecord.id as string);
          if (suppressedUntil && Date.now() < suppressedUntil) break;

          if (onCardUpdated) onCardUpdated(newRecord as unknown as Card);

          // Observer announcement — derive what changed from old vs new record
          if (announceRemoteChanges) {
            const oldRec = oldRecord as Record<string, unknown> | null | undefined;
            const newRec = newRecord as Record<string, unknown>;
            const title  = (newRec.title as string | undefined) ?? "A card";

            if (oldRec && oldRec.listId !== newRec.listId) {
              announce(`"${title}" was moved to another list by a collaborator.`);
            } else if (oldRec && oldRec.priority !== newRec.priority) {
              const priority = String(newRec.priority ?? "unknown").toLowerCase();
              announce(`"${title}" priority changed to ${priority} by a collaborator.`);
            } else if (oldRec && oldRec.dueDate !== newRec.dueDate) {
              announce(`"${title}" due date was updated by a collaborator.`);
            } else if (oldRec && oldRec.title !== newRec.title) {
              announce(`A card was renamed to "${title}" by a collaborator.`);
            }
            // Silent for order-only reshuffles (too noisy for screen readers)
          }
          break;
        }
        case "DELETE":
          if (oldRecord?.id && onCardDeleted) {
            onCardDeleted(oldRecord.id);
          }
          if (announceRemoteChanges) {
            const deletedTitle = (oldRecord as Record<string, unknown> | null)?.title as string | undefined;
            announce(
              deletedTitle
                ? `Card "${deletedTitle}" was removed by a collaborator.`
                : "A card was removed by a collaborator.",
            );
          }
          break;
      }
    },
    [onCardCreated, onCardUpdated, onCardDeleted, announceRemoteChanges]
  );

  const handleListChange = useCallback(
    (payload: ListPayload) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      switch (eventType) {
        case "INSERT":
          if (newRecord && onListCreated) {
            onListCreated(newRecord as List);
          }
          if (announceRemoteChanges && newRecord) {
            announce(`New list "${(newRecord as { title?: string }).title ?? "Untitled"}" was added by a collaborator.`);
          }
          break;
        case "UPDATE":
          if (newRecord && onListUpdated) {
            onListUpdated(newRecord as List);
          }
          // No announcement for list updates — they are typically reorders
          // which are too frequent and low-value for screen reader output.
          break;
        case "DELETE":
          if (oldRecord?.id && onListDeleted) {
            onListDeleted(oldRecord.id);
          }
          if (announceRemoteChanges) {
            const deletedTitle = (oldRecord as Record<string, unknown> | null)?.title as string | undefined;
            announce(
              deletedTitle
                ? `List "${deletedTitle}" was removed by a collaborator.`
                : "A list was removed by a collaborator.",
            );
          }
          break;
      }
    },
    [onListCreated, onListUpdated, onListDeleted, announceRemoteChanges]
  );

  // Phase 3: Comment change handler
  const handleCommentChange = useCallback(
    (payload: CommentPayload) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      switch (eventType) {
        case "INSERT":
          if (newRecord && onCommentCreated) {
            onCommentCreated(newRecord as Comment);
          }
          break;
        case "UPDATE":
          if (newRecord && onCommentUpdated) {
            onCommentUpdated(newRecord as Comment);
          }
          break;
        case "DELETE":
          if (oldRecord?.id && onCommentDeleted) {
            onCommentDeleted(oldRecord.id);
          }
          break;
      }
    },
    [onCommentCreated, onCommentUpdated, onCommentDeleted]
  );

  // Phase 3: Reaction change handler
  const handleReactionChange = useCallback(
    (payload: ReactionPayload) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      switch (eventType) {
        case "INSERT":
          if (newRecord && onReactionAdded) {
            onReactionAdded(newRecord as CommentReaction);
          }
          break;
        case "DELETE":
          if (oldRecord?.id && onReactionRemoved) {
            onReactionRemoved(oldRecord.id);
          }
          break;
      }
    },
    [onReactionAdded, onReactionRemoved]
  );

  useEffect(() => {
    // Skip if no boardId or orgId — orgId is required for tenant-isolated channels
    if (!boardId || !orgId) {
      return;
    }

    // Channel name includes orgId — prevents cross-tenant subscriptions
    const channelName = boardChannel(orgId, boardId);
    let channel: RealtimeChannel;
    let supabase: ReturnType<typeof getAuthenticatedSupabaseClient> | undefined;
    // Cancellation flag — prevents retry loop from firing after cleanup (sign-out)
    let cancelled = false;

    // Connect to real-time channel
    const setupRealtimeSubscription = async () => {
      if (cancelled) return;
      // Guard: boardId must be a valid UUID to prevent filter injection
      if (!/^[0-9a-f-]{36}$/i.test(boardId)) {
        console.error(`[useRealtimeBoard] Invalid boardId format: ${boardId}`);
        return;
      }
      try {
        // Attempt to get a Supabase-scoped JWT from Clerk.
        // Falls back to null if no 'supabase' JWT template is configured in the
        // Clerk dashboard — Realtime will still work via channel-name isolation.
        let token: string | null = null;
        try {
          token = await getToken({ template: "supabase" });
        } catch {
          // Template not configured — degrade gracefully to anon key
        }
        if (cancelled) return;
        supabase = getAuthenticatedSupabaseClient(token);
        channel = supabase.channel(channelName);

        // Subscribe to card changes (Phase 1 + Phase 3: priority, dueDate)
        channel.on<Database["public"]["Tables"]["Card"]["Row"]>(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "Card",
            filter: `listId=in.(select id from "List" where "boardId"='${boardId}')`,
          },
          handleCardChange
        );

        // Subscribe to list changes
        channel.on<Database["public"]["Tables"]["List"]["Row"]>(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "List",
            filter: `boardId=eq.${boardId}`,
          },
          handleListChange
        );

        // Phase 3: Subscribe to comment changes
        if (onCommentCreated || onCommentUpdated || onCommentDeleted) {
          channel.on(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            "postgres_changes" as any,
            {
              event: "*",
              schema: "public",
              table: "Comment",
              filter: `cardId=in.(select id from "Card" where "listId" in (select id from "List" where "boardId"='${boardId}'))`,
            },
            handleCommentChange
          );
        }

        // Phase 3: Subscribe to reaction changes
        if (onReactionAdded || onReactionRemoved) {
          channel.on(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            "postgres_changes" as any,
            {
              event: "*",
              schema: "public",
              table: "CommentReaction",
              filter: `commentId=in.(select id from "Comment" where "cardId" in (select id from "Card" where "listId" in (select id from "List" where "boardId"='${boardId}')))`,
            },
            handleReactionChange
          );
        }

        // Subscribe and handle connection status with auto-retry
        channel
          .subscribe((status) => {
            if (cancelled) return;
            if (status === "SUBSCRIBED") {
              setIsConnected(true);
              setError(null);
              retryCountRef.current = 0; // Reset retry count on success
              if (process.env.NODE_ENV === "development") console.log(`✅ Real-time connected to board: ${boardId} (Phase 3 enabled)`);
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              setIsConnected(false);

              // Implement exponential backoff retry (max 5 attempts)
              // Do NOT retry if the effect has been cleaned up (sign-out, unmount)
              if (!cancelled && retryCountRef.current < 5) {
                const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000); // Max 30s

                // Only log on first retry to reduce noise
                if (retryCountRef.current === 0 && process.env.NODE_ENV === "development") {
                  console.log(`🔄 Real-time connection ${status === "TIMED_OUT" ? "timed out" : "failed"}, retrying...`);
                }

                retryTimeoutRef.current = setTimeout(() => {
                  retryCountRef.current += 1;
                  setupRealtimeSubscription();
                }, delay);
              } else if (!cancelled) {
                // Only show error after all retries exhausted
                setError("Connection failed after multiple attempts");
                if (process.env.NODE_ENV === "development") console.warn(`⚠️ Real-time connection failed for board: ${boardId} after ${retryCountRef.current} retries`);
              }
            }
          });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    };

    setupRealtimeSubscription();

    // Cleanup: unsubscribe when component unmounts or boardId changes
    return () => {
      cancelled = true;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (channel && supabase) {
        supabase.removeChannel(channel);
        setIsConnected(false);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    boardId,
    orgId,
    handleCardChange,
    handleListChange,
    handleCommentChange,
    handleReactionChange,
    onCommentCreated,
    onCommentUpdated,
    onCommentDeleted,
    onReactionAdded,
    onReactionRemoved,
    announceRemoteChanges,
  ]);

  return {
    isConnected,
    error,
    /**
     * Call this BEFORE applying an optimistic local card update (e.g. drag start).
     * Remote Supabase broadcasts for this card will be suppressed for 2 seconds,
     * preventing stale events from snapping the card back to an old position.
     *
     * @param cardId - The Prisma Card id being locally updated.
     */
    markLocalCardUpdate(cardId: string) {
      localOpTimestampRef.current.set(
        cardId,
        Date.now() + LOCAL_OP_SUPPRESS_MS,
      );
    },
  };
}
