"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, List } from "@prisma/client";
import { getSupabaseClient, getBoardChannelName } from "@/lib/supabase/client";
import { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

type CardPayload = RealtimePostgresChangesPayload<Database["public"]["Tables"]["Card"]["Row"]>;
type ListPayload = RealtimePostgresChangesPayload<Database["public"]["Tables"]["List"]["Row"]>;

interface UseRealtimeBoardOptions {
  boardId: string;
  onCardCreated?: (card: Card) => void;
  onCardUpdated?: (card: Card) => void;
  onCardDeleted?: (cardId: string) => void;
  onListCreated?: (list: List) => void;
  onListUpdated?: (list: List) => void;
  onListDeleted?: (listId: string) => void;
}

/**
 * Real-time board synchronization hook
 * 
 * Subscribes to postgres_changes events for cards and lists in a specific board.
 * Updates are received instantly when other users make changes.
 * 
 * @example
 * ```typescript
 * const { isConnected, error } = useRealtimeBoard({
 *   boardId: "board-123",
 *   onCardCreated: (card) => {
 *     // Add card to local state
 *     setCards(prev => [...prev, card]);
 *     toast.success(`${card.title} created by another user`);
 *   },
 *   onCardUpdated: (card) => {
 *     // Update card in local state
 *     setCards(prev => prev.map(c => c.id === card.id ? card : c));
 *   },
 *   onCardDeleted: (cardId) => {
 *     // Remove card from local state
 *     setCards(prev => prev.filter(c => c.id !== cardId));
 *   }
 * });
 * 
 * if (error) {
 *   console.error("Realtime connection failed:", error);
 * }
 * 
 * return (
 *   <div>
 *     {isConnected ? "🟢 Live" : "🔴 Offline"}
 *   </div>
 * );
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

        // Subscribe to card changes
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

        // Subscribe and handle connection status
        channel
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              setIsConnected(true);
              setError(null);
              console.log(`✅ Real-time connected to board: ${boardId}`);
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
  }, [boardId, handleCardChange, handleListChange]);

  return {
    isConnected,
    error,
  };
}
