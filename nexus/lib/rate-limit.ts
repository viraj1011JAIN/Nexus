/**
 * In-memory sliding-window rate limiter.
 *
 * Works by keying a Map on a unique identifier (e.g. `ai:${userId}`) and
 * tracking a list of request timestamps within the current window.
 *
 * ⚠️  SERVERLESS NOTE: Because each Vercel lambda instance is a separate
 *    process, this counter resets when a new instance cold-starts.  For
 *    high-traffic production workloads, replace this with a distributed
 *    store (e.g. @upstash/ratelimit + Upstash Redis) so limits are shared
 *    across all instances.  For now the in-memory approach still catches
 *    rapid single-user bursts within the same warm lambda context.
 */

interface WindowEntry {
  /** Sorted list of request timestamps (ms) in the current window. */
  timestamps: number[];
}

const store = new Map<string, WindowEntry>();

/** Prune all keys whose window has fully expired — avoids memory leaks. */
function gc(now: number, windowMs: number) {
  for (const [key, entry] of store) {
    const cutoff = now - windowMs;
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

let gcCounter = 0;
const GC_INTERVAL = 200; // run GC every 200 requests

/**
 * Check (and record) a rate-limit hit for `key`.
 *
 * @param key        Unique identifier, e.g. `"ai:user_abc123"`
 * @param limit      Maximum number of requests allowed in `windowMs`
 * @param windowMs   Rolling window duration in milliseconds
 * @returns `{ ok: true }` when the request is allowed, or
 *          `{ ok: false, retryAfterMs: number }` when the limit is exceeded.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const cutoff = now - windowMs;

  // Periodic GC to purge stale entries
  if (++gcCounter >= GC_INTERVAL) {
    gcCounter = 0;
    gc(now, windowMs);
  }

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Slide the window: discard timestamps older than `windowMs`
  entry.timestamps = entry.timestamps.filter(t => t > cutoff);

  if (entry.timestamps.length >= limit) {
    // Oldest timestamp in the window tells us when a slot opens up
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    return { ok: false, retryAfterMs: Math.max(retryAfterMs, 1) };
  }

  entry.timestamps.push(now);
  return { ok: true };
}
