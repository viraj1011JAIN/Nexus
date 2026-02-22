"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase/client";
import { boardPresenceChannel } from "@/lib/realtime-channels";
import { RealtimeChannel } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export interface PresenceUser {
  userId: string;
  userName: string;
  userAvatar: string;
  joinedAt: string;
  color: string; // Unique color for cursor/presence indicator
}

interface UsePresenceOptions {
  boardId: string;
  /** orgId is required — presence channels without orgId allow cross-tenant user tracking */
  orgId: string;
  enabled?: boolean;
}

/**
 * Presence tracking hook - Shows who's online on the board
 * 
 * Uses Supabase Presence to track users viewing the same board in real-time.
 * Each user broadcasts their info, and the hook aggregates all online users.
 * 
 * Features:
 * - Real-time online user list
 * - Auto-join/leave on mount/unmount
 * - Unique colors for each user
 * - Connection status monitoring
 * 
 * @example
 * ```typescript
 * const { onlineUsers, isTracking } = usePresence({ 
 *   boardId: "board-123",
 *   enabled: true 
 * });
 * 
 * return (
 *   <div className="flex -space-x-2">
 *     {onlineUsers.map(user => (
 *       <img 
 *         key={user.userId}
 *         src={user.userAvatar}
 *         alt={user.userName}
 *         className="w-8 h-8 rounded-full border-2"
 *         style={{ borderColor: user.color }}
 *       />
 *     ))}
 *     <span className="ml-2 text-sm text-gray-600">
 *       {onlineUsers.length} online
 *     </span>
 *   </div>
 * );
 * ```
 */
export function usePresence({ boardId, orgId, enabled = true }: UsePresenceOptions) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    // Channel name includes orgId — prevents cross-tenant presence tracking
    const channelName = boardPresenceChannel(orgId, boardId);
    let channel: RealtimeChannel;
    let supabase: ReturnType<typeof getAuthenticatedSupabaseClient> | undefined;

    const setupPresence = async () => {
      try {
        // Attempt to get a Supabase-scoped JWT from Clerk.
        // Falls back to null if no 'supabase' JWT template is configured in the
        // Clerk dashboard — Presence will still work via channel-name isolation.
        let token: string | null = null;
        try {
          token = await getToken({ template: "supabase" });
        } catch {
          // Template not configured — degrade gracefully to anon key
        }
        supabase = getAuthenticatedSupabaseClient(token);
        channel = supabase.channel(channelName, {
          config: {
            presence: {
              key: user.id, // Use Clerk user ID as unique key
            },
          },
        });

        // Handle presence sync (initial state + updates)
        channel.on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          const users: PresenceUser[] = [];

          // Aggregate all users from presence state
          Object.keys(state).forEach((key) => {
            const presences = state[key];
            presences.forEach((presence: any) => {
              users.push({
                userId: presence.userId,
                userName: presence.userName,
                userAvatar: presence.userAvatar,
                joinedAt: presence.joinedAt,
                color: presence.color,
              });
            });
          });

          setOnlineUsers(users);
        });

        // Handle user joining
        channel.on("presence", { event: "join" }, ({ key, newPresences }) => {
          // User joined - state updated via sync event
        });

        // Handle user leaving
        channel.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
          // User left - state updated via sync event
        });

        // Subscribe to channel
        channel.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            // Track current user
            const currentUserPresence = {
              userId: user.id,
              userName: user.fullName || user.firstName || "Anonymous",
              userAvatar: user.imageUrl,
              joinedAt: new Date().toISOString(),
              color: getUserColor(user.id),
            };

            await channel.track(currentUserPresence);
            setIsTracking(true);
            setError(null);
          } else if (status === "CHANNEL_ERROR") {
            setIsTracking(false);
            setError("Failed to start presence tracking");
            // Error state set - no console output needed
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        // Error state set - no console output needed
      }
    };

    setupPresence();

    // Cleanup: untrack and unsubscribe
    return () => {
      if (channel && supabase) {
        channel.untrack();
        supabase.removeChannel(channel);
        setIsTracking(false);
        setOnlineUsers([]);
      }
    };
  }, [boardId, enabled, user, getUserColor]);

  // Filter out current user from online users list
  const otherUsers = onlineUsers.filter((u) => u.userId !== user?.id);

  return {
    onlineUsers: otherUsers,
    currentUser: onlineUsers.find((u) => u.userId === user?.id),
    totalOnline: onlineUsers.length,
    isTracking,
    error,
  };
}
