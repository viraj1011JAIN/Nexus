/**
 * GET /api/health/shards
 *
 * Returns the real-time health status of every configured database shard.
 *
 * Protected by the CRON_SECRET bearer token — this endpoint exposes
 * infrastructure topology (shard count, which shards are alive) and must
 * not be publicly queryable.
 *
 * Response shape:
 * ```json
 * {
 *   "shards":   2,
 *   "healthy":  2,
 *   "degraded": 0,
 *   "status":   "ok",          // "ok" | "degraded" | "down"
 *   "detail":   { "0": true, "1": true },
 *   "timestamp": "2026-03-02T12:00:00.000Z"
 * }
 * ```
 *
 * HTTP status codes:
 *   200 — all shards healthy
 *   207 — some shards healthy (degraded — traffic is being rerouted)
 *   503 — all shards unhealthy (outage)
 *   401 — missing or invalid CRON_SECRET
 */

import { type NextRequest, NextResponse } from "next/server";
import { getShardHealthMap, getShardCount } from "@/lib/shard-router";
import { verifyCronSecret } from "@/lib/verify-cron-secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // ── Auth (timing-safe) ────────────────────────────────────────────────────────
  if (!verifyCronSecret(req.headers.get("authorization"))) {
    return NextResponse.json(
      { error: "Unauthorized — Bearer <CRON_SECRET> required" },
      { status: 401 },
    );
  }

  // ── Probe all shards in parallel ────────────────────────────────────────────
  const [healthMap] = await Promise.all([getShardHealthMap()]);
  const totalShards = getShardCount();
  const healthyCount = Object.values(healthMap).filter(Boolean).length;
  const degradedCount = totalShards - healthyCount;

  const status =
    degradedCount === 0 ? "ok" : healthyCount > 0 ? "degraded" : "down";

  const httpStatus =
    status === "ok" ? 200 : status === "degraded" ? 207 : 503;

  return NextResponse.json(
    {
      shards: totalShards,
      healthy: healthyCount,
      degraded: degradedCount,
      status,
      /** Per-shard health detail: record<shardIndex, isHealthy> */
      detail: healthMap,
      timestamp: new Date().toISOString(),
    },
    { status: httpStatus },
  );
}
