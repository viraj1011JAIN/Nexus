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
 * Displays a compact avatar stack for users currently viewing the board.
 *
 * Intentionally does NOT render its own "Live" badge — the board header
 * owns that indicator to avoid duplicates. This component is purely the
 * avatar overlay: up to MAX_VISIBLE faces, plus a +N overflow pill.
 *
 * Performance notes:
 * - A single TooltipProvider wraps all avatars — one context, not N contexts.
 * - We cap visible avatars at 4. With 100+ users only 4 DOM nodes are created
 *   here; the rest are a single text pill.
 * - No CSS animations live here; the pinging dot lives in the header only.
 */
export function OnlineUsers({ users, totalOnline, isTracking }: OnlineUsersProps) {
  const MAX_VISIBLE = 4;
  const displayUsers = users.slice(0, MAX_VISIBLE);
  const remainingCount = Math.max(0, totalOnline - MAX_VISIBLE);

  if (!isTracking || totalOnline === 0) return null;

  return (
    <TooltipProvider>
      {/* -space-x-2 creates the overlapping stack; relative + z on hover lifts the target */}
      <div className="flex -space-x-1.5">
        {displayUsers.map((user) => (
          <Tooltip key={user.userId}>
            <TooltipTrigger asChild>
              <Avatar
                className="w-7 h-7 border-2 border-[rgba(255,253,249,0.9)] dark:border-[rgba(13,12,20,0.85)] relative transition-transform duration-100 hover:scale-110 hover:z-10 cursor-default"
                style={{ borderColor: user.color }}
              >
                <AvatarImage src={user.userAvatar} alt={user.userName} />
                <AvatarFallback
                  style={{ backgroundColor: user.color + "33", color: user.color }}
                  className="text-[11px] font-semibold"
                >
                  {user.userName?.[0]?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p className="font-medium">{user.userName ?? "Anonymous"}</p>
              <p className="text-[10px] text-gray-400">Viewing now</p>
            </TooltipContent>
          </Tooltip>
        ))}

        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-7 h-7 rounded-full bg-black/10 dark:bg-white/10 border-2 border-[rgba(255,253,249,0.9)] dark:border-[rgba(13,12,20,0.85)] flex items-center justify-center cursor-default">
                <span className="text-[10px] font-bold text-[#9A8F85] dark:text-white/60">
                  +{remainingCount}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p>{remainingCount} more viewer{remainingCount === 1 ? "" : "s"}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
