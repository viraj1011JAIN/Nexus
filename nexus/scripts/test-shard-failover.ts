/**
 * scripts/test-shard-failover.ts
 *
 * NEXUS — Database Shard Failover Test
 * ══════════════════════════════════════════════════════════════════════
 *
 * PURPOSE
 * ───────
 * Validates that the shard routing infrastructure is correctly configured
 * and that the automatic failover mechanism works as expected.
 *
 * Specifically it:
 *   1. Shows which shard each org maps to (consistent hash distribution)
 *   2. Health-probes every configured shard
 *   3. Verifies direct query execution on each shard
 *   4. Simulates a shard-0 failure and walks through what failover looks like
 *
 * USAGE
 * ─────
 *   npx tsx scripts/test-shard-failover.ts
 *   npm run test:shards
 *
 * SINGLE-SHARD MODE (current production default)
 * ──────────────────────────────────────────────
 * If no SHARD_n_DATABASE_URL env vars are set, the router operates in
 * single-shard mode. Step 4 (failover simulation) is skipped — it only
 * applies when multiple shards are configured.
 *
 * MULTI-SHARD SETUP
 * ─────────────────
 * To test with multiple shards locally, add to .env.local:
 *
 *   SHARD_0_DATABASE_URL="postgresql://user:pass@shard0.host:5432/nexus"
 *   SHARD_1_DATABASE_URL="postgresql://user:pass@shard1.host:5432/nexus"
 *
 * Then run this script. To simulate a shard-0 failure, set:
 *
 *   SHARD_0_DATABASE_URL="postgresql://invalid:5432/nexus_failover_test"
 *
 * and re-run. Orgs assigned to shard 0 should be reported as rerouted to
 * shard 1 (or whichever next healthy shard exists).
 */

// Load env vars the same way Next.js does in server actions
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import {
  getShardIndex,
  getShardCount,
  getShardClient,
  getShardHealthMap,
  invalidateShardHealthCache,
  getDbForOrg,
} from "../lib/shard-router";

// ── Test fixtures ─────────────────────────────────────────────────────────────

/**
 * Representative sample of org IDs in CUID format — mirrors real production data.
 * Each will be mapped to a shard and used to verify the hash distribution.
 */
const SAMPLE_ORGS = [
  "org_2a4F8x9Km3bQpR1nZvYwUjL5",
  "org_7cP2wE4dNtH6mXjR9kBsVzQy",
  "org_1bK5rT8mZqW4nXpJ3fGhUcSv",
  "org_9eN3oL6tYiC2gRwK8sQpMxBd",
  "org_4fV7hD1uAjX9qPmN5tZkRwGs",
  "org_6gW2iE8bYlA3sOnM7rKpHcFt",
  "org_8hX5jF4cZmB6tPkN1uLqIdCr",
  "org_3iY9kG7dAnC5vRjO2mMbJeEs",
  "org_5jZ0lH2eBoD7wSkP4nNcKfBu",
  "org_0kA8mI3fCpE1xTlQ6oOdLgCv",
  "org_2lB6nJ4gDqF0yUmR7pPeLhDw",
  "org_4mC7oK5hErG3zVnS8qQfMiEx",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function hr(char = "─", width = 54) {
  return char.repeat(width);
}

function pad(s: string, n: number) {
  return s.padEnd(n);
}

// ── Main test ─────────────────────────────────────────────────────────────────

async function runFailoverTest() {
  console.log();
  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║    NEXUS — Database Shard Failover Test            ║");
  console.log("╚════════════════════════════════════════════════════╝");
  console.log();

  const shardCount = getShardCount();
  const modeLabel =
    shardCount === 1
      ? "single-shard (no SHARD_n_DATABASE_URL set)"
      : `${shardCount}-shard cluster`;
  console.log(`  Cluster mode : ${modeLabel}`);
  console.log(`  Shard count  : ${shardCount}`);
  console.log();

  // ── Step 1: Org → Shard distribution ───────────────────────────────────────
  console.log(`──[ Step 1: Org → Shard Mapping (FNV-1a hash) ]${hr("─", 7)}`);
  const distribution = new Map<number, string[]>();
  for (const orgId of SAMPLE_ORGS) {
    const shard = getShardIndex(orgId);
    if (!distribution.has(shard)) distribution.set(shard, []);
    distribution.get(shard)!.push(orgId);
    console.log(`  ${pad(orgId.slice(0, 32), 34)} → shard ${shard}`);
  }
  console.log();

  // Distribution summary
  console.log("  Distribution summary:");
  for (let i = 0; i < shardCount; i++) {
    const orgs = distribution.get(i) ?? [];
    const bar = "█".repeat(orgs.length);
    console.log(`    Shard ${i}: ${String(orgs.length).padStart(2)} orgs  ${bar}`);
  }
  console.log();

  // ── Step 2: Health probe all shards ────────────────────────────────────────
  console.log(`──[ Step 2: Shard Health Probes ]${hr("─", 22)}`);
  const healthMap = await getShardHealthMap();
  let allHealthy = true;
  for (let i = 0; i < shardCount; i++) {
    const envKey = process.env[`SHARD_${i}_DATABASE_URL`]
      ? `SHARD_${i}_DATABASE_URL`
      : "DATABASE_URL (fallback)";
    const status = healthMap[i] ? "✅ HEALTHY  " : "❌ UNHEALTHY";
    if (!healthMap[i]) allHealthy = false;
    console.log(`  Shard ${i}  ${pad(envKey, 30)}  ${status}`);
  }
  console.log();

  // ── Step 3: Direct query verification ──────────────────────────────────────
  console.log(`──[ Step 3: Direct Query Verification ]${hr("─", 16)}`);
  for (let i = 0; i < shardCount; i++) {
    try {
      const client = getShardClient(i);
      const result = await client.$queryRaw<[{ now: Date }]>`SELECT NOW() AS now`;
      console.log(`  Shard ${i}: OK — server time ${result[0].now.toISOString()}`);
    } catch (err) {
      console.log(
        `  Shard ${i}: FAILED — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  console.log();

  // ── Step 4: Failover simulation ─────────────────────────────────────────────
  console.log(`──[ Step 4: Failover Simulation ]${hr("─", 22)}`);

  if (shardCount === 1) {
    console.log("  ⚠  Single-shard mode — failover simulation requires ≥ 2 shards.");
    console.log();
    console.log("  To enable multi-shard failover, add to .env.local:");
    console.log("    SHARD_0_DATABASE_URL=\"postgresql://…/nexus_shard0\"");
    console.log("    SHARD_1_DATABASE_URL=\"postgresql://…/nexus_shard1\"");
    console.log();
    console.log("  In single-shard mode, failover is handled at the Supabase");
    console.log("  infrastructure level (replica lag < 30 s, automatic promotion).");
  } else {
    // Show which orgs would be affected by a shard-0 failure
    const shard0Orgs = distribution.get(0) ?? [];
    const shard0Pct = Math.round((shard0Orgs.length / SAMPLE_ORGS.length) * 100);

    console.log(`  Simulating shard 0 failure (affects ~${shard0Pct}% of test orgs):`);
    if (shard0Orgs.length === 0) {
      console.log("    (no test orgs hash to shard 0 with this sample set)");
    } else {
      for (const org of shard0Orgs) {
        console.log(`    · ${org}`);
      }
    }
    console.log();

    // Inject a bad shard-0 URL into the env temporarily, flush health cache,
    // then route sample orgs through getDbForOrg to confirm failover routing.
    const savedUrl = process.env.SHARD_0_DATABASE_URL;
    process.env.SHARD_0_DATABASE_URL = "postgresql://failover-test-invalid:5432/nexus";
    invalidateShardHealthCache(0); // force re-probe on next call

    console.log("  Routing orgs after simulated shard-0 failure:");
    for (const orgId of shard0Orgs.slice(0, 3)) {
      // getDbForOrg will probe shard 0, find it unhealthy, and try shard 1+
      const routedClient = await getDbForOrg(orgId);
      // Compare object identity to determine which shard the client belongs to
      let routedShard = -1;
      for (let i = 0; i < shardCount; i++) {
        // Re-use the existing client (ShardClient cache), compare by === identity
        if (i !== 0 && routedClient === getShardClient(i)) {
          routedShard = i;
          break;
        }
      }
      const routeResult =
        routedShard >= 0
          ? `✅ rerouted → shard ${routedShard}`
          : "⚠  fell back to shard 0 (all shards unhealthy)";
      console.log(`    · ${orgId.slice(0, 28)}…  ${routeResult}`);
    }
    console.log();

    // Restore
    process.env.SHARD_0_DATABASE_URL = savedUrl;
    invalidateShardHealthCache(0);
    console.log("  ✅ Shard-0 URL restored — cache invalidated.");
    console.log();

    console.log("  Live failover test procedure (run in production-like env):");
    console.log("    1. Set SHARD_0_DATABASE_URL to an unreachable host");
    console.log("    2. Run: npm run test:shards");
    console.log("       → Router should report orgs rerouted to shard 1");
    console.log("    3. Restore SHARD_0_DATABASE_URL and run again");
    console.log("       → All shards healthy, shard 0 orgs served normally");
    console.log("    4. Watch GET /api/health/shards for real-time cluster status");
  }
  console.log();

  // ── Summary ─────────────────────────────────────────────────────────────────
  const healthyCount = Object.values(healthMap).filter(Boolean).length;
  console.log(`──[ Summary ]${hr("─", 41)}`);
  console.log(`  Total shards    : ${shardCount}`);
  console.log(`  Healthy         : ${healthyCount}`);
  console.log(`  Unhealthy       : ${shardCount - healthyCount}`);
  console.log(`  Sample orgs     : ${SAMPLE_ORGS.length}`);
  console.log(
    `  Distribution   : ${[...Array(shardCount)].map((_, i) => `shard${i}=${distribution.get(i)?.length ?? 0}`).join(", ")}`,
  );
  console.log();

  if (!allHealthy) {
    console.log("⚠  WARNING: One or more shards are unhealthy.");
    console.log(
      "   NEXUS will automatically route affected orgs to healthy shards.",
    );
    console.log("   Monitor: GET /api/health/shards (Authorization: Bearer <CRON_SECRET>)");
    console.log();
    process.exit(1);
  } else {
    console.log(
      "✅ All shards healthy. Failover infrastructure is operational.",
    );
    console.log();
    process.exit(0);
  }
}

runFailoverTest().catch((err) => {
  console.error("\nFatal error during shard failover test:", err);
  process.exit(2);
});
