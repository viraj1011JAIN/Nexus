"use client";

import { PresenceUser } from "@/hooks/use-presence";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface OnlineUsersProps {
  users: PresenceUser[];
  totalOnline: number;
  isTracking: boolean;
}

/**
 * Displays avatars of online users on the board
 * 
 * Shows up to 5 user avatars with a count for additional users.
 * Each avatar has a colored border matching their presence color.
 */
export function OnlineUsers({ users, totalOnline, isTracking }: OnlineUsersProps) {
  const displayUsers = users.slice(0, 5);
  const remainingCount = Math.max(0, totalOnline - 5);

  if (!isTracking) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 glass-effect rounded-xl px-4 py-2 shadow-md">
        {/* Connection indicator */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping" />
          </div>
          <span className="text-xs font-medium text-slate-600">Live</span>
        </div>

        {/* Divider */}
        {totalOnline > 0 && (
          <div className="w-px h-6 bg-slate-300" />
        )}

        {/* User avatars */}
        {totalOnline > 0 && (
          <div className="flex -space-x-2">
            {displayUsers.map((user) => (
              <Tooltip key={user.userId}>
                <TooltipTrigger>
                  <Avatar
                    className="w-8 h-8 border-2 transition-transform hover:scale-110 hover:z-10"
                    style={{ borderColor: user.color }}
                  >
                    <AvatarImage src={user.userAvatar} alt={user.userName} />
                    <AvatarFallback style={{ backgroundColor: user.color + "20" }}>
                      {user.userName[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{user.userName}</p>
                  <p className="text-xs text-gray-500">Viewing now</p>
                </TooltipContent>
              </Tooltip>
            ))}
            
            {/* Remaining count */}
            {remainingCount > 0 && (
              <div 
                className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center"
              >
                <span className="text-xs font-bold text-slate-600">
                  +{remainingCount}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Online count text */}
        {totalOnline > 0 && (
          <span className="text-xs font-medium text-slate-600">
            {totalOnline} {totalOnline === 1 ? "viewer" : "viewers"}
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}
