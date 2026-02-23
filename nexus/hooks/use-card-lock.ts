"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { getSupabaseClient } from "@/lib/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface CardLockState {
  cardId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  lockedAt: string;
}

interface UseCardLockOptions {
  boardId: string;
  cardId: string | null;
  enabled?: boolean;
}

/**
 * Card-level edit locking hook - Prevents simultaneous edits
 * 
 * When a user opens a card modal, this hook broadcasts a "lock" via Supabase Presence.
 * Other users see a warning: "John Doe is editing this card" with a pulsing indicator.
 * 
 * **Architecture:**
 * - Uses Supabase Presence (in-memory, zero database writes)
 * - Locks automatically release when modal closes (component unmounts)
 * - Visual feedback prevents data loss from race conditions
 * 
 * **Why this prevents conflicts:**
 * With auto-save enabled (500ms debounce), two users could overwrite each other's changes.
 * This lock creates "social awareness" - users wait their turn instead of fighting.
 * 
 * @example
 * ```typescript
 * // In CardModal component
 * const { isLocked, lockedBy, lockCard, unlockCard } = useCardLock({
 *   boardId: "board-123",
 *   cardId: card.id,
 *   enabled: isOpen, // Only lock when modal is open
 * });
 * 
 * useEffect(() => {
 *   if (isOpen) {
 *     lockCard(); // Broadcast: "I'm editing this"
 *   }
 *   return () => unlockCard(); // Cleanup on close
 * }, [isOpen]);
 * 
 * if (isLocked && lockedBy) {
 *   return (
 *     <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
 *       <p>⚠️ {lockedBy.userName} is currently editing this card</p>
 *       <p className="text-sm text-gray-600">
 *         Please wait or open in read-only mode
 *       </p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCardLock({ boardId, cardId, enabled = true }: UseCardLockOptions) {
  const { user } = useUser();
  const [cardLocks, setCardLocks] = useState<Map<string, CardLockState>>(new Map());
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [isLocking, setIsLocking] = useState(false);

  // Check if current card is locked by someone else
  const isLocked = cardId ? cardLocks.has(cardId) && cardLocks.get(cardId)?.userId !== user?.id : false;
  const lockedBy = cardId ? cardLocks.get(cardId) : undefined;

  // Lock card (broadcast edit state)
  const lockCard = useCallback(async () => {
    if (!channel || !user || !cardId || isLocking) return;

    try {
      setIsLocking(true);
      await channel.track({
        editingCardId: cardId,
        userId: user.id,
        userName: user.fullName || user.firstName || "Anonymous",
        userAvatar: user.imageUrl,
        lockedAt: new Date().toISOString(),
      });
    } catch {
      // track failed — ignore silently
    } finally {
      setIsLocking(false);
    }
  }, [channel, user, cardId, isLocking]);

  // Unlock card (clear edit state)
  const unlockCard = useCallback(async () => {
    if (!channel || !cardId) return;

    try {
      await channel.untrack();
    } catch {
      // untrack failed — ignore silently
    }
  }, [channel, cardId]);

  useEffect(() => {
    if (!enabled || !boardId || !user) {
      return;
    }

    const supabase = getSupabaseClient();
    const channelName = `card-locks:${boardId}`;
    let newChannel: RealtimeChannel;

  const setupLockTracking = async () => {
      try {
        newChannel = supabase.channel(channelName, {
          config: {
            presence: {
              key: user.id,
            },
          },
        });

        // Handle presence sync
        newChannel.on("presence", { event: "sync" }, () => {
          const state = newChannel.presenceState();
          const locks = new Map<string, CardLockState>();

          // Take only presences[0] per key (= one entry per user, deduplicates multi-tab)
          Object.keys(state).forEach((key) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const presence = state[key][0] as any;
            if (presence?.editingCardId) {
              locks.set(presence.editingCardId, {
                cardId: presence.editingCardId,
                userId: presence.userId,
                userName: presence.userName,
                userAvatar: presence.userAvatar,
                lockedAt: presence.lockedAt,
              });
            }
          });

          setCardLocks(locks);
        });

        // Subscribe to channel
        await newChannel.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            setChannel(newChannel);
          } else if (status === "CHANNEL_ERROR") {
            // error stored in hook state if needed
          }
        });
      } catch {
        // setup failed — channel unavailable
      }
    };

    setupLockTracking();

    // Cleanup
    return () => {
      if (newChannel) {
        newChannel.untrack();
        supabase.removeChannel(newChannel);
        setChannel(null);
        setCardLocks(new Map());
      }
    };
  }, [boardId, enabled, user]);

  // Auto-lock when cardId becomes available
  useEffect(() => {
    if (cardId && channel && !isLocking) {
      lockCard();
    }
  }, [cardId, channel, lockCard, isLocking]);

  return {
    isLocked,
    lockedBy,
    lockCard,
    unlockCard,
    allLocks: cardLocks,
  };
}
