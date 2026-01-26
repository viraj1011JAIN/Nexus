"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { getSupabaseClient, getPresenceChannelName } from "@/lib/supabase/client";
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
export function usePresence({ boardId, enabled = true }: UsePresenceOptions) {
  const { user } = useUser();
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
    // Skip if disabled, no boardId, or no user
    if (!enabled || !boardId || !user) {
      return;
    }

    const supabase = getSupabaseClient();
    const channelName = getPresenceChannelName(boardId);
    let channel: RealtimeChannel;

    const setupPresence = async () => {
      try {
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
          console.log(`👋 User joined board: ${newPresences[0]?.userName}`);
        });

        // Handle user leaving
        channel.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
          console.log(`👋 User left board: ${leftPresences[0]?.userName}`);
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
            console.log(`✅ Presence tracking started for board: ${boardId}`);
          } else if (status === "CHANNEL_ERROR") {
            setIsTracking(false);
            setError("Failed to start presence tracking");
            console.error(`❌ Presence tracking failed for board: ${boardId}`);
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        console.error("Presence setup error:", err);
      }
    };

    setupPresence();

    // Cleanup: untrack and unsubscribe
    return () => {
      if (channel) {
        channel.untrack();
        supabase.removeChannel(channel);
        setIsTracking(false);
        setOnlineUsers([]);
        console.log(`🔌 Presence tracking stopped for board: ${boardId}`);
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
