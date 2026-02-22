"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { boardAnalyticsChannel } from "@/lib/realtime-channels";

interface AnalyticsUpdate {
  type: "card_created" | "card_completed" | "card_deleted" | "card_updated";
  boardId: string;
  timestamp: string;
}

export function useRealtimeAnalytics(boardId: string, orgId: string) {
  const [updates, setUpdates] = useState<AnalyticsUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Bail early if orgId is not available — cannot create isolated channel without it
    if (!boardId || !orgId) return;

    const supabase = getSupabaseClient();
    // Channel includes orgId prefix — prevents cross-tenant analytics subscriptions
    const channel = supabase.channel(boardAnalyticsChannel(orgId, boardId));

    channel
      .on("broadcast", { event: "analytics_update" }, ({ payload }) => {
        const update = payload as AnalyticsUpdate;
        setUpdates((prev) => [update, ...prev].slice(0, 10)); // Keep last 10
        
        // Trigger chart refresh
        window.dispatchEvent(new CustomEvent("refresh-analytics"));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);

        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setIsConnected(false);
        }
      });

    return () => {
      channel.unsubscribe();
      setIsConnected(false);
    };
  }, [boardId, orgId]);

  return { updates, isConnected };
}
