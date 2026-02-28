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
 * Creates a Supabase client that carries a Clerk JWT in the Authorization header.
 *
 * WHY: When Supabase Row-Level Security (RLS) policies use `auth.jwt()` or
 * `current_setting('app.current_user_id')`, the JWT must be present on the
 * connection for those policies to evaluate correctly. The anonymous key alone
 * only satisfies policies that run as `anon` role.
 *
 * USAGE: Call this in realtime hooks AFTER you have a Clerk session token.
 *
 * @example
 * ```typescript
 * const token = await getToken({ template: 'supabase' });
 * const supabase = getAuthenticatedSupabaseClient(token);
 * const channel = supabase.channel(boardChannel(orgId, boardId));
 * ```
 *
 * CLERK JWT TEMPLATE SETUP:
 * Clerk Dashboard → JWT Templates → New → Supabase
 * The template must include EXACTLY this claim (key name matters):
 *
 *   { "org_id": "{{org.id}}" }
 *
 * The Supabase RLS helper `requesting_org_id()` reads `->> 'org_id'` from the
 * JWT claims. If the key name in the template differs by even one character
 * (e.g. 'orgId', 'organization_id'), the function returns NULL and all
 * Realtime policies silently drop every event — no error is raised.
 *
 * FALLBACK: When clerkToken is null (template not yet configured), the
 * Authorization header is omitted and the anon key alone is used. Realtime
 * still works via channel-name isolation; JWT-gated RLS policies are inactive.
 */
export function getAuthenticatedSupabaseClient(clerkToken: string | null) {
  return createSupabaseClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    global: {
      headers: {
        "x-client-info": "nexus-realtime",
        // Passes Clerk JWT so Supabase RLS policies can evaluate auth.jwt().
        // When clerkToken is null (no JWT template configured in Clerk dashboard),
        // the header is omitted and the anon key alone is used — RLS falls back
        // to channel-name isolation only. Configure a 'supabase' JWT template in
        // the Clerk dashboard for full JWT-gated Realtime auth.
        ...(clerkToken ? { Authorization: `Bearer ${clerkToken}` } : {}),
      },
    },
  });
}
