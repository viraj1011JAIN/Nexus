"use client";

import Link from "next/link";
import { OnlineUsers } from "./online-users";
import { usePresence } from "@/hooks/use-presence";

interface BoardHeaderProps {
  boardId: string;
  boardTitle: string;
  /** orgId required for tenant-isolated presence channel */
  orgId: string;
}

export function BoardHeader({ boardId, boardTitle, orgId }: BoardHeaderProps) {
  const { onlineUsers, totalOnline, isTracking } = usePresence({ 
    boardId,
    orgId,
    enabled: true 
  });

  return (
    <div className="relative z-10 flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <Link 
          href="/" 
          className="text-sm px-4 py-2 glass-effect rounded-xl shadow-md hover:shadow-lg transition-all duration-300 font-medium text-slate-700 hover:text-indigo-600 hover:scale-105 active:scale-95"
        >
          ← Back
        </Link>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          {boardTitle}
        </h1>
      </div>
      
      {/* Real-time presence indicators */}
      <OnlineUsers 
        users={onlineUsers} 
        totalOnline={totalOnline}
        isTracking={isTracking}
      />
    </div>
  );
}
