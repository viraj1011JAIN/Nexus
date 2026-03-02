/**
 * Sliding-window rate limiter — hybrid in-memory / Upstash Redis.
 *
 * When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, limits are
 * enforced via Upstash Ratelimit which uses a shared Redis store visible to
 * every Vercel serverless instance simultaneously — preventing a user from
 * bursting across parallel lambda cold-starts.
 *
 * When those env vars are absent (local dev, CI, or unconfigured prod) the
 * implementation falls back to an in-memory sliding-window Map.  This catches
 * rapid single-user bursts within the same warm lambda but will not aggregate
 * across instances.
 *
 * The exported `rateLimit()` function is async in both modes so callers only
 * need one code path.
 *
 * Environment variables required for Redis mode:
 *   UPSTASH_REDIS_REST_URL    — Upstash REST endpoint (https://…upstash.io)
 *   UPSTASH_REDIS_REST_TOKEN  — Upstash REST bearer token
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis }     from "@upstash/redis";

// ─── Upstash Redis path ───────────────────────────────────────────────────────

const useRedis =
  typeof process.env.UPSTASH_REDIS_REST_URL === "string" &&
  process.env.UPSTASH_REDIS_REST_URL.length > 0 &&
  typeof process.env.UPSTASH_REDIS_REST_TOKEN === "string" &&
  process.env.UPSTASH_REDIS_REST_TOKEN.length > 0;

/**
 * Cache of Ratelimit instances keyed by `"${limit}:${windowMs}"`.
 * Creating a new Ratelimit per call is harmless but wastes a small amount of
 * memory; reusing instances is more efficient.
 */
const redisLimiters = new Map<string, Ratelimit>();

function getRedisLimiter(limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`;
  let limiter = redisLimiters.get(cacheKey);
  if (!limiter) {
    const redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    limiter = new Ratelimit({
      redis,
      limiter:   Ratelimit.slidingWindow(limit, `${Math.ceil(windowMs / 1000)} s`),
      analytics: false,
      prefix:    "nexus:rl",
    });
    redisLimiters.set(cacheKey, limiter);
  }
  return limiter;
}

// ─── In-memory fallback ───────────────────────────────────────────────────────

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
const GC_INTERVAL = 200;

function rateLimitInMemory(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const cutoff = now - windowMs;

  if (++gcCounter >= GC_INTERVAL) {
    gcCounter = 0;
    gc(now, windowMs);
  }

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  entry.timestamps = entry.timestamps.filter(t => t > cutoff);

  if (entry.timestamps.length >= limit) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    return { ok: false, retryAfterMs: Math.max(retryAfterMs, 1) };
  }

  entry.timestamps.push(now);
  return { ok: true };
}

// ─── Unified public API ───────────────────────────────────────────────────────

/**
 * Check (and record) a rate-limit hit for `key`.
 *
 * Uses Upstash Redis when credentials are configured (distributed, shared
 * across all Vercel instances), otherwise falls back to an in-memory window
 * (single-instance only).
 *
 * @param key        Unique identifier, e.g. `"ai:user_abc123"`
 * @param limit      Maximum number of requests allowed in `windowMs`
 * @param windowMs   Rolling window duration in milliseconds
 * @returns `{ ok: true }` when the request is allowed, or
 *          `{ ok: false, retryAfterMs: number }` when the limit is exceeded.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: true } | { ok: false; retryAfterMs: number }> {
  if (useRedis) {
    try {
      const limiter = getRedisLimiter(limit, windowMs);
      const { success, reset } = await limiter.limit(key);
      if (success) return { ok: true };
      const retryAfterMs = Math.max(reset - Date.now(), 1);
      return { ok: false, retryAfterMs };
    } catch (err) {
      // Redis unavailable — fail open using in-memory so the app stays live.
      // This is a conscious trade-off: brief Redis downtime should not block users.
      console.warn("[rate-limit] Upstash Redis error — falling back to in-memory:", err);
      return rateLimitInMemory(key, limit, windowMs);
    }
  }

  return rateLimitInMemory(key, limit, windowMs);
}
