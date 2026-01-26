import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

// Supabase connection details from your Prisma DATABASE_URL
// Extract from: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing Supabase environment variables. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env file."
  );
}

/**
 * Creates a Supabase client for real-time subscriptions
 * 
 * Features:
 * - Real-time postgres_changes subscriptions
 * - Presence tracking (online users)
 * - Broadcast channels (cursor positions, typing indicators)
 * 
 * @example
 * ```typescript
 * const supabase = createClient();
 * 
 * // Subscribe to card changes
 * const channel = supabase
 *   .channel('board:123')
 *   .on('postgres_changes', { 
 *     event: '*', 
 *     schema: 'public', 
 *     table: 'Card' 
 *   }, (payload) => {
 *     console.log('Card changed:', payload);
 *   })
 *   .subscribe();
 * ```
 */
export function createClient() {
  return createSupabaseClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false, // We use Clerk for auth, Supabase only for realtime
    },
    realtime: {
      params: {
        eventsPerSecond: 10, // Throttle events to prevent spam
      },
    },
    global: {
      headers: {
        "x-client-info": "nexus-realtime",
      },
    },
  });
}

/**
 * Singleton Supabase client for client-side usage
 * Reuses the same connection across the app
 */
let supabaseClient: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient();
  }
  return supabaseClient;
}

/**
 * Channel name generator for board-specific subscriptions
 */
export function getBoardChannelName(boardId: string): string {
  return `board:${boardId}`;
}

/**
 * Channel name generator for presence tracking
 */
export function getPresenceChannelName(boardId: string): string {
  return `presence:board:${boardId}`;
}
