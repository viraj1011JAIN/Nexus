"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { getAuthenticatedSupabaseClient } from "@/lib/supabase/client";
import { boardAnalyticsChannel } from "@/lib/realtime-channels";
import { RealtimeChannel } from "@supabase/supabase-js";

interface AnalyticsUpdate {
  type: "card_created" | "card_completed" | "card_deleted" | "card_updated";
  boardId: string;
  timestamp: string;
}

export function useRealtimeAnalytics(boardId: string, orgId: string) {
  const [updates, setUpdates] = useState<AnalyticsUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const { getToken } = useAuth();

  useEffect(() => {
    // Bail early if orgId is not available — cannot create isolated channel without it
    if (!boardId || !orgId) return;

    let channel: RealtimeChannel | undefined;
    let supabase: ReturnType<typeof getAuthenticatedSupabaseClient> | undefined;

    const setup = async () => {
      // Obtain a Clerk JWT scoped for Supabase so RLS policies evaluate the org_id claim.
      // This prevents an attacker from subscribing to another org's analytics channel by
      // guessing its orgId — the Supabase Realtime publication policy verifies the JWT.
      // Falls back to null (anon key only) if the 'supabase' JWT template is not yet
      // configured in the Clerk dashboard; channel-name isolation is still active.
      let token: string | null = null;
      try {
        token = await getToken({ template: "supabase" });
      } catch {
        // JWT template not configured — degrade gracefully to channel-name-only isolation
      }

      supabase = getAuthenticatedSupabaseClient(token);
      // Channel includes orgId prefix — application-layer tenant isolation
      channel = supabase.channel(boardAnalyticsChannel(orgId, boardId));

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
    };

    setup();

    return () => {
      channel?.unsubscribe();
      setIsConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getToken is identity-stable per Clerk design (same pattern as use-presence.ts)
  }, [boardId, orgId]);

  return { updates, isConnected };
}
