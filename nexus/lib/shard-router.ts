/**
 * lib/shard-router.ts — Database Shard Routing Layer
 *
 * ARCHITECTURE OVERVIEW
 * ─────────────────────
 * NEXUS supports a horizontally-sharded PostgreSQL setup where each shard
 * holds the data for a distinct subset of organizations. Shards are identified
 * by environment variables `SHARD_0_DATABASE_URL`, `SHARD_1_DATABASE_URL`, …
 * up to SHARD_7_DATABASE_URL (8 shards maximum).
 *
 * When no SHARD_n_DATABASE_URL vars are set, the router operates in
 * single-shard mode and all traffic is routed to DATABASE_URL — this is
 * fully backwards compatible with the existing single-Supabase setup.
 *
 * SHARD KEY → SHARD INDEX MAPPING
 * ────────────────────────────────
 * org IDs are CUID strings. We use the FNV-1a 32-bit hash of the orgId,
 * reduced modulo the shard count, to assign each org to a shard deterministically.
 *
 *   getShardIndex("org_abc123") → 0   (stays on shard 0 forever)
 *   getShardIndex("org_xyz789") → 1   (stays on shard 1 forever)
 *
 * IMPORTANT: Changing the shard count remaps ~50 % of orgs to different shards.
 * When scaling out: (a) provision the new shard, (b) migrate data for reassigned
 * orgs with a zero-downtime dual-write window, (c) increment shard count.
 *
 * FAILOVER
 * ────────
 * If the assigned shard fails its health probe, the router tries the remaining
 * shards in index order and routes to the first healthy one, logging a WARN.
 * If ALL shards are unhealthy the router falls back to shard 0 and logs ERROR —
 * this is fail-open by design. At that point the DB is likely unreachable for
 * everyone and an ops alert is more useful than an additional application crash.
 * RLS policies remain enforced regardless of which shard client is returned.
 *
 * HEALTH CACHE
 * ────────────
 * Each shard is probed with `SELECT 1`. Results are cached for
 * HEALTH_CACHE_TTL_MS (30 s) to avoid a probe on every request. A failed shard
 * is re-probed after the TTL expires — if it has recovered the router routes
 * normally again with no manual intervention required.
 *
 * GLOBAL TABLES (User, Organization directory)
 * ─────────────────────────────────────────────
 * User rows are identified by Clerk userId, not by orgId, so they cannot be
 * sharded on orgId. They live on a "catalog" database — currently the primary
 * DATABASE_URL (shard 0). All OrganizationUser and Board data is org-scoped
 * and goes to the org's assigned shard via getDbForOrg().
 *
 * SINGLE-SHARD MODE (current production setup)
 * ─────────────────────────────────────────────
 * With one Supabase instance, all SHARD_n vars are unset and getShardCount()
 * returns 1. getDbForOrg() always returns getShardClient(0) which points to
 * DATABASE_URL — identical to importing { db } from "@/lib/db" directly.
 * This layer adds zero overhead when there is only one shard.
 */

import "server-only";
import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum number of shard slots. Add SHARD_{n}_DATABASE_URL for each. */
const MAX_SHARDS = 8;

/**
 * Health probe result TTL in milliseconds.
 * 30 seconds: fast enough to detect a recovery within one SLA window,
 * low enough overhead that every request is not a round-trip to the DB.
 */
const HEALTH_CACHE_TTL_MS = 30_000;

// ── Internal state (module-level singletons) ──────────────────────────────────

/** One PrismaClient per shard, lazily initialized on first access. */
const shardClients = new Map<number, PrismaClient>();

/**
 * Health probe cache: shardIndex → { healthy, checkedAt }
 * Map (not object) so integer keys stay ordered for iteration.
 */
const healthCache = new Map<number, { healthy: boolean; checkedAt: number }>();

// ── Shard count ───────────────────────────────────────────────────────────────

/**
 * Returns the number of active shards.
 * Counts SHARD_{n}_DATABASE_URL env vars that are present; minimum 1
 * (single-shard / single-Supabase mode, pointing at DATABASE_URL).
 */
export function getShardCount(): number {
  let count = 0;
  for (let i = 0; i < MAX_SHARDS; i++) {
    if (process.env[`SHARD_${i}_DATABASE_URL`]) count++;
  }
  return count > 0 ? count : 1;
}

// ── Consistent hashing ────────────────────────────────────────────────────────

/**
 * Maps an orgId string to a shard index using FNV-1a 32-bit hashing.
 *
 * Why FNV-1a over e.g. a numeric modulo of a timestamp-based CUID component:
 *  - CUIDs are opaque strings — no reliable numeric extraction.
 *  - FNV-1a is O(key length), deterministic, collision-resistant for short keys.
 *  - Produces a uniform distribution across the shard count modulo space.
 *
 * Do NOT change the hash algorithm without planning a full data migration.
 * The mapping is load-bearing: org data must live on the shard this function
 * returns for any given orgId.
 */
export function getShardIndex(orgId: string): number {
  // FNV-1a 32-bit: initialise with the FNV offset basis, then for each byte:
  //   hash = (hash XOR byte) * FNV 32-bit prime, keeping unsigned 32-bit.
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < orgId.length; i++) {
    hash ^= orgId.charCodeAt(i);
    // Math.imul gives the low 32 bits of a 32×32 multiplication — same result
    // as C's `(uint32_t)(hash * 0x01000193)` without BigInt.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % getShardCount();
}

// ── Client factory ────────────────────────────────────────────────────────────

/** Builds a new PrismaClient pointed at the given shard's connection string. */
function buildShardClient(shardIndex: number): PrismaClient {
  const url =
    process.env[`SHARD_${shardIndex}_DATABASE_URL`] ?? process.env.DATABASE_URL!;

  return new PrismaClient({
    datasources: { db: { url } },
    log:
      process.env.NODE_ENV === "development"
        ? [
            { emit: "stdout", level: "warn" },
            { emit: "stdout", level: "error" },
          ]
        : [{ emit: "stdout", level: "error" }],
  });
}

/**
 * Returns the PrismaClient for the given shard index, creating it if needed.
 * Clients are module-level singletons — safe to call repeatedly.
 */
export function getShardClient(shardIndex: number): PrismaClient {
  if (!shardClients.has(shardIndex)) {
    shardClients.set(shardIndex, buildShardClient(shardIndex));
  }
  return shardClients.get(shardIndex)!;
}

// ── Health probing ────────────────────────────────────────────────────────────

/**
 * Probes a single shard with `SELECT 1`.
 * Result is cached for HEALTH_CACHE_TTL_MS to cap overhead at one probe per
 * 30-second window per shard — not on every individual request.
 */
async function probeShardHealth(shardIndex: number): Promise<boolean> {
  const cached = healthCache.get(shardIndex);
  if (cached && Date.now() - cached.checkedAt < HEALTH_CACHE_TTL_MS) {
    return cached.healthy;
  }

  try {
    await getShardClient(shardIndex).$queryRaw`SELECT 1`;
    healthCache.set(shardIndex, { healthy: true, checkedAt: Date.now() });
    return true;
  } catch (err) {
    logger.error(`[SHARD_ROUTER] Shard ${shardIndex} health probe failed`, { error: err });
    healthCache.set(shardIndex, { healthy: false, checkedAt: Date.now() });
    return false;
  }
}

/**
 * Returns a health map for all configured shards.
 * Probes run in parallel; each result is independently cached.
 *
 * Used by:
 *   - GET /api/health/shards (ops dashboard)
 *   - scripts/test-shard-failover.ts
 */
export async function getShardHealthMap(): Promise<Record<number, boolean>> {
  const count = getShardCount();
  const entries = await Promise.all(
    Array.from({ length: count }, async (_, i) => [i, await probeShardHealth(i)] as const),
  );
  return Object.fromEntries(entries);
}

// ── Public routing API ────────────────────────────────────────────────────────

/**
 * Returns the Prisma client for the shard that owns this organization's data.
 *
 * This is the primary public API of the shard router. Call it instead of
 * importing `db` directly in any code that has access to an `orgId`.
 *
 * ```typescript
 * import { getDbForOrg } from "@/lib/db";
 *
 * const client = await getDbForOrg(orgId);
 * const boards = await client.board.findMany({ where: { orgId } });
 * ```
 *
 * Routing algorithm:
 *   1. Compute shard = FNV-1a(orgId) % shardCount
 *   2. Probe that shard (cached 30 s)
 *   3. On miss: iterate other shards, return first healthy — log WARN
 *   4. All shards dead: return shard 0 — log ERROR (fail-open)
 */
export async function getDbForOrg(orgId: string): Promise<PrismaClient> {
  const assigned = getShardIndex(orgId);
  const count = getShardCount();

  // Fast path — assigned shard is healthy (covers virtually all requests)
  if (await probeShardHealth(assigned)) {
    return getShardClient(assigned);
  }

  // Failover path — search for a healthy shard
  for (let i = 0; i < count; i++) {
    if (i === assigned) continue;
    if (await probeShardHealth(i)) {
      logger.warn(
        `[SHARD_ROUTER] Failover: org "${orgId}" routed shard ${assigned} → shard ${i}`,
      );
      return getShardClient(i);
    }
  }

  // Last resort: all probes failed — fail-open to shard 0
  // (network issue is more likely than all DBs simultaneously down)
  logger.error("[SHARD_ROUTER] All shards unhealthy — fail-open to shard 0");
  return getShardClient(0);
}

/**
 * Force-invalidates the health cache for a given shard (or all shards).
 * Primarily useful in tests to simulate a shard going down/recovering mid-run.
 */
export function invalidateShardHealthCache(shardIndex?: number): void {
  if (shardIndex !== undefined) {
    healthCache.delete(shardIndex);
  } else {
    healthCache.clear();
  }
}
