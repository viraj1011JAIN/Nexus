"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, List, Comment, CommentReaction } from "@prisma/client";
import { getSupabaseClient, getBoardChannelName } from "@/lib/supabase/client";
import { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

type CardPayload = RealtimePostgresChangesPayload<Database["public"]["Tables"]["Card"]["Row"]>;
type ListPayload = RealtimePostgresChangesPayload<Database["public"]["Tables"]["List"]["Row"]>;
// Phase 3: Using Prisma types since Supabase types may not be generated yet
type CommentPayload = RealtimePostgresChangesPayload<Comment>;
type ReactionPayload = RealtimePostgresChangesPayload<CommentReaction>;

interface UseRealtimeBoardOptions {
  boardId: string;
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
}: UseRealtimeBoardOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable callback refs to prevent re-subscriptions
  const handleCardChange = useCallback(
    (payload: CardPayload) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      switch (eventType) {
        case "INSERT":
          if (newRecord && onCardCreated) {
            onCardCreated(newRecord as Card);
          }
          break;
        case "UPDATE":
          if (newRecord && onCardUpdated) {
            onCardUpdated(newRecord as Card);
          }
          break;
        case "DELETE":
          if (oldRecord?.id && onCardDeleted) {
            onCardDeleted(oldRecord.id);
          }
          break;
      }
    },
    [onCardCreated, onCardUpdated, onCardDeleted]
  );

  const handleListChange = useCallback(
    (payload: ListPayload) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      switch (eventType) {
        case "INSERT":
          if (newRecord && onListCreated) {
            onListCreated(newRecord as List);
          }
          break;
        case "UPDATE":
          if (newRecord && onListUpdated) {
            onListUpdated(newRecord as List);
          }
          break;
        case "DELETE":
          if (oldRecord?.id && onListDeleted) {
            onListDeleted(oldRecord.id);
          }
          break;
      }
    },
    [onListCreated, onListUpdated, onListDeleted]
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
    // Skip if no boardId
    if (!boardId) {
      return;
    }

    const supabase = getSupabaseClient();
    const channelName = getBoardChannelName(boardId);
    let channel: RealtimeChannel;

    // Connect to real-time channel
    const setupRealtimeSubscription = async () => {
      try {
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

        // Subscribe and handle connection status
        channel
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              setIsConnected(true);
              setError(null);
              console.log(`✅ Real-time connected to board: ${boardId} (Phase 3 enabled)`);
            } else if (status === "CHANNEL_ERROR") {
              setIsConnected(false);
              setError("Failed to connect to real-time channel");
              console.error(`❌ Real-time connection failed for board: ${boardId}`);
            } else if (status === "TIMED_OUT") {
              setIsConnected(false);
              setError("Connection timed out");
              console.error(`⏱️ Real-time connection timed out for board: ${boardId}`);
            }
          });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        console.error("Real-time setup error:", err);
      }
    };

    setupRealtimeSubscription();

    // Cleanup: unsubscribe when component unmounts or boardId changes
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
        setIsConnected(false);
        console.log(`🔌 Disconnected from board: ${boardId}`);
      }
    };
  }, [
    boardId,
    handleCardChange,
    handleListChange,
    handleCommentChange,
    handleReactionChange,
    onCommentCreated,
    onCommentUpdated,
    onCommentDeleted,
    onReactionAdded,
    onReactionRemoved,
  ]);

  return {
    isConnected,
    error,
  };
}
