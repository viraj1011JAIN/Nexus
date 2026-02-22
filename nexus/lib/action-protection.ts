/**
 * Server Action Protection Utilities
 *
 * Provides two categories of protection for Server Actions:
 *   1. Demo mode guard — blocks mutations in the read-only demo workspace
 *   2. Rate limiting   — sliding window per-user-per-action throttle
 *
 * Rate limit defaults (per 60-second window):
 *   create-card   → 60 req / min
 *   create-list   → 20 req / min
 *   create-board  → 10 req / min
 *   default       → 30 req / min
 *
 * Implementation: in-memory sliding window using a Map<string, number[]>.
 * Timestamps older than WINDOW_MS are dropped on each check — no stale entries.
 * A background cleanup removes fully-expired keys every 5 minutes to cap memory use.
 *
 * Production note: replace the Map with Upstash Redis / Vercel KV if you need
 * rate limiting across multiple server instances (e.g. multiple Vercel regions).
 * The function signature is identical — swap the implementation without touching callers.
 */

import { ActionState } from "@/lib/create-safe-action";

// ─── Demo mode ───────────────────────────────────────────────────────────────

const DEMO_ORG_ID = process.env.DEMO_ORG_ID ?? "demo-org-id";

/**
 * Demo Mode Protection
 * 
 * Prevents mutations in demo organization.
 * Use this at the start of any Server Action that modifies data.
 * 
 * @example
 * ```ts
 * const handler = async (data: InputType): Promise<ReturnType> => {
 *   const { orgId } = await auth();
 *   
 *   // Protect demo mode
 *   const demoCheck = await protectDemoMode(orgId);
 *   if (demoCheck) return demoCheck;
 *   
 *   // Continue with mutation...
 * };
 * ```
 */
export async function protectDemoMode<T = any>(
  orgId: string | null | undefined
): Promise<ActionState<any, T> | null> {
  if (orgId === DEMO_ORG_ID) {
    return {
      error:
        "Demo mode is read-only. Sign up to create your own workspace with full access.",
    };
  }
  return null;
}

/**
 * Check if organization is demo
 */
export function isDemoOrganization(orgId: string | null | undefined): boolean {
  return orgId === DEMO_ORG_ID;
}


// ─── Sliding-window rate limiter ─────────────────────────────────────────────

const WINDOW_MS = 60_000;
const store = new Map<string, number[]>();

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS;
    for (const [key, ts] of store) {
      const fresh = ts.filter((t) => t > cutoff);
      if (fresh.length === 0) store.delete(key);
      else store.set(key, fresh);
    }
  }, 5 * 60_000);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

export function checkRateLimit(
  userId: string,
  action: string,
  limit = 30
): RateLimitResult {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const timestamps = (store.get(key) ?? []).filter((t) => t > windowStart);
  if (timestamps.length >= limit) {
    return { allowed: false, remaining: 0, resetInMs: WINDOW_MS - (now - timestamps[0]) };
  }
  timestamps.push(now);
  store.set(key, timestamps);
  return { allowed: true, remaining: limit - timestamps.length, resetInMs: WINDOW_MS };
}

export const RATE_LIMITS = {
  // Board mutations
  "create-board": 10,
  "delete-board": 10,
  // List mutations
  "create-list": 20,
  "delete-list": 20,
  "update-list-order": 30,
  // Card mutations
  "create-card": 60,
  "delete-card": 40,
  "update-card": 120,
  "update-card-order": 120, // high-frequency drag-and-drop
  // Phase 3 — priority & due date
  "update-priority": 60,
  "set-due-date": 60,
  // Phase 3 — comments
  "create-comment": 60,
  "update-comment": 60,
  "delete-comment": 40,
  // Phase 3 — reactions
  "add-reaction": 120,
  "remove-reaction": 120,
  // Labels & assignees
  "create-label": 10,
  "assign-label": 120,
  "assign-user": 120,
  default: 30,
} as const;

export type RateLimitedAction = keyof typeof RATE_LIMITS;
