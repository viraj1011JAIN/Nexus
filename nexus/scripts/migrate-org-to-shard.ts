/**
 * scripts/migrate-org-to-shard.ts — Dual-Write Window Org Migration
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * PURPOSE
 * ──────────────────────────────────────────────────────────────────────────────
 * When you add a new shard (SHARD_1_DATABASE_URL), the FNV-1a hash remaps
 * ~50% of existing organizations from shard 0 to shard 1. Those orgs will see
 * empty boards on the new shard until their data is physically moved.
 *
 * This script migrates ONE org's complete dataset from its current shard to a
 * target shard BEFORE you update the SHARD_n var that triggers the remap.
 * Running it first is the "dual-write window": old shard still handles live
 * traffic; new shard is pre-populated; flip the env var = zero-data-loss cutover.
 *
 * USAGE
 * ──────────────────────────────────────────────────────────────────────────────
 *   # Dry run — prints row counts per table, makes no writes
 *   npx tsx scripts/migrate-org-to-shard.ts --org-id=org_abc123 --target-shard=1
 *
 *   # Execute — copies all data, then prints cutover instructions
 *   npx tsx scripts/migrate-org-to-shard.ts --org-id=org_abc123 --target-shard=1 --execute
 *
 * HOW TO SCALE OUT TO SHARD 1 (complete playbook)
 * ──────────────────────────────────────────────────────────────────────────────
 *   Step 1 — Provision the new Supabase project and run schema migrations.
 *   Step 2 — Set SHARD_1_DATABASE_URL in your environment (Vercel / .env.local),
 *             but NOT yet in production. Compute the new distribution:
 *               npx tsx scripts/test-shard-failover.ts
 *             to see which orgs will be remapped to shard 1.
 *   Step 3 — For each org that will remap, run:
 *               npx tsx scripts/migrate-org-to-shard.ts \
 *                 --org-id=<org_id> --target-shard=1 --execute
 *   Step 4 — Verify: all row counts match (script prints a diff table).
 *   Step 5 — Deploy with SHARD_1_DATABASE_URL set in production env vars.
 *             The router immediately routes remapped orgs to the new shard.
 *   Step 6 — Run: npm run test:shards   &   GET /api/health/shards to confirm.
 *   Step 7 — (Optional cleanup) After 24 hours, drop old org rows from shard 0.
 *             The ON CONFLICT DO NOTHING inserts mean data is duplicated briefly —
 *             this is intentional for the dual-write window safety net.
 *
 * DATA INTEGRITY NOTES
 * ──────────────────────────────────────────────────────────────────────────────
 * - All tables are copied in FK-dependency order (parents before children).
 * - Users who are members of this org are copied to the target shard because
 *   every shard needs user rows to satisfy FK constraints from org-scoped tables.
 *   The users table is the only global-catalog table replicated per-migration.
 * - `ON CONFLICT DO NOTHING` makes the migration re-runnable (idempotent).
 *   Running it twice is safe — duplicates are silently skipped.
 * - The migration does NOT delete source rows. The org runs on both shards
 *   during the dual-write window. Live writes continue to the source shard until
 *   you flip the SHARD_n env var. Any writes that land after this script runs
 *   will be missing on the target — run this script as close to the cutover as
 *   possible (preferably during a maintenance window of < 30 seconds).
 * - JSONB columns are serialized/deserialized transparently by pg's wire format.
 * - BATCH_SIZE controls memory usage. Decrease if RAM is constrained.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { getShardClient, getShardIndex, getShardCount, invalidateShardHealthCache } from "../lib/shard-router";

// ── CLI arg parsing ───────────────────────────────────────────────────────────

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

const TARGET_ORG_ID = getArg("org-id");
const TARGET_SHARD  = parseInt(getArg("target-shard") ?? "-1", 10);
const DRY_RUN       = !process.argv.includes("--execute");

if (!TARGET_ORG_ID || isNaN(TARGET_SHARD) || TARGET_SHARD < 0) {
  console.error(`
  USAGE:
    npx tsx scripts/migrate-org-to-shard.ts --org-id=<ORG_ID> --target-shard=<N> [--execute]

  FLAGS:
    --org-id=<id>        Clerk org ID to migrate (required)
    --target-shard=<N>   Shard index to migrate data onto (required, 0-based)
    --execute            Actually write data. Omit for a dry-run preview.
  `);
  process.exit(1);
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Rows per INSERT batch — keeps memory and statement size manageable. */
const BATCH_SIZE = 100;

// ── Table specification ───────────────────────────────────────────────────────

/**
 * Each entry is a Postgres table name plus a SQL fragment that returns all rows
 * belonging to the target org. Parameters are supplied by the migration runner.
 *
 * ORDER MATTERS: tables must be listed before any table that has a FK pointing
 * to them (topological sort of the FK dependency graph).
 */
interface TableSpec {
  table: string;
  /** SQL that selects all rows for this org. Must be a complete SELECT statement. */
  buildQuery: (ids: ResolvedIds) => { sql: string; params: unknown[] };
}

type ResolvedIds = {
  orgId: string;
  userIds:       string[];   // users who are org members
  boardIds:      string[];
  listIds:       string[];
  cardIds:       string[];
  labelIds:      string[];
  commentIds:    string[];
  checklistIds:  string[];
  automationIds: string[];
  webhookIds:    string[];
  sprintIds:     string[];
  customFieldIds:string[];
  savedViewIds:  string[];
  initiativeIds: string[];
  epicIds:       string[];
};

function inList(ids: string[]): string {
  if (ids.length === 0) return "''"; // empty IN() would be invalid SQL
  return ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(",");
}

const TABLE_SPECS: TableSpec[] = [
  // ── Global catalog (user rows for org members) ────────────────────────────
  {
    table: "users",
    buildQuery: ({ userIds }) => ({
      sql: `SELECT * FROM "users" WHERE id IN (${inList(userIds)})`,
      params: [],
    }),
  },
  // ── Org root ──────────────────────────────────────────────────────────────
  {
    table: "organizations",
    buildQuery: ({ orgId }) => ({
      sql: `SELECT * FROM "organizations" WHERE id = '${orgId}'`,
      params: [],
    }),
  },
  {
    table: "organization_users",
    buildQuery: ({ orgId }) => ({
      sql: `SELECT * FROM "organization_users" WHERE organization_id = '${orgId}'`,
      params: [],
    }),
  },
  {
    table: "permission_schemes",
    buildQuery: ({ orgId }) => ({
      sql: `SELECT * FROM "permission_schemes" WHERE org_id = '${orgId}'`,
      params: [],
    }),
  },
  {
    table: "permission_scheme_entries",
    buildQuery: ({ orgId }) => ({
      sql: `SELECT pse.* FROM "permission_scheme_entries" pse
            JOIN "permission_schemes" ps ON pse.scheme_id = ps.id
            WHERE ps.org_id = '${orgId}'`,
      params: [],
    }),
  },
  {
    table: "membership_requests",
    buildQuery: ({ orgId }) => ({
      sql: `SELECT * FROM "membership_requests" WHERE org_id = '${orgId}'`,
      params: [],
    }),
  },
  {
    table: "api_keys",
    buildQuery: ({ orgId }) => ({
      sql: `SELECT * FROM "api_keys" WHERE org_id = '${orgId}'`,
      params: [],
    }),
  },
  {
    table: "webhooks",
    buildQuery: ({ orgId }) => ({
      sql: `SELECT * FROM "webhooks" WHERE org_id = '${orgId}'`,
      params: [],
    }),
  },
  {
    table: "webhook_deliveries",
    buildQuery: ({ webhookIds }) => ({
      sql: webhookIds.length > 0
        ? `SELECT * FROM "webhook_deliveries" WHERE webhook_id IN (${inList(webhookIds)})`
        : `SELECT * FROM "webhook_deliveries" WHERE false`,
      params: [],
    }),
  },
  {
    table: "initiatives",
    buildQuery: ({ orgId }) => ({
      sql: `SELECT * FROM "initiatives" WHERE org_id = '${orgId}'`,
      params: [],
    }),
  },
  {
    table: "epics",
    buildQuery: ({ initiativeIds }) => ({
      sql: initiativeIds.length > 0
        ? `SELECT * FROM "epics" WHERE initiative_id IN (${inList(initiativeIds)})`
        : `SELECT * FROM "epics" WHERE false`,
      params: [],
    }),
  },
  // ── Boards ────────────────────────────────────────────────────────────────
  {
    table: "board_templates",
    buildQuery: ({ orgId }) => ({
      sql: `SELECT * FROM "board_templates" WHERE org_id = '${orgId}'`,
      params: [],
    }),
  },
  {
    table: "template_lists",
    buildQuery: ({ orgId }) => ({
      sql: `SELECT tl.* FROM "template_lists" tl
            JOIN "board_templates" bt ON tl.template_id = bt.id
            WHERE bt.org_id = '${orgId}'`,
      params: [],
    }),
  },
  {
    table: "template_cards",
    buildQuery: ({ orgId }) => ({
      sql: `SELECT tc.* FROM "template_cards" tc
            JOIN "template_lists" tl ON tc.template_list_id = tl.id
            JOIN "board_templates" bt ON tl.template_id = bt.id
            WHERE bt.org_id = '${orgId}'`,
      params: [],
    }),
  },
  {
    table: "boards",
    buildQuery: ({ orgId }) => ({
      sql: `SELECT * FROM "boards" WHERE org_id = '${orgId}'`,
      params: [],
    }),
  },
  {
    table: "board_members",
    buildQuery: ({ orgId }) => ({
      sql: `SELECT * FROM "board_members" WHERE org_id = '${orgId}'`,
      params: [],
    }),
  },
  {
    table: "board_analytics",
    buildQuery: ({ boardIds }) => ({
      sql: boardIds.length > 0
        ? `SELECT * FROM "board_analytics" WHERE board_id IN (${inList(boardIds)})`
        : `SELECT * FROM "board_analytics" WHERE false`,
      params: [],
    }),
  },
  {
    table: "board_shares",
    buildQuery: ({ boardIds }) => ({
      sql: boardIds.length > 0
        ? `SELECT * FROM "board_shares" WHERE board_id IN (${inList(boardIds)})`
        : `SELECT * FROM "board_shares" WHERE false`,
      params: [],
    }),
  },
  {
    table: "saved_views",
    buildQuery: ({ orgId }) => ({
      sql: `SELECT * FROM "saved_views" WHERE org_id = '${orgId}'`,
      params: [],
    }),
  },
  {
    table: "custom_fields",
    buildQuery: ({ orgId }) => ({
      sql: `SELECT * FROM "custom_fields" WHERE org_id = '${orgId}'`,
      params: [],
    }),
  },
  {
    table: "automations",
    buildQuery: ({ boardIds, orgId }) => ({
      sql: boardIds.length > 0
        ? `SELECT * FROM "automations" WHERE org_id = '${orgId}' OR board_id IN (${inList(boardIds)})`
        : `SELECT * FROM "automations" WHERE org_id = '${orgId}'`,
      params: [],
    }),
  },
  {
    table: "automation_logs",
    buildQuery: ({ automationIds }) => ({
      sql: automationIds.length > 0
        ? `SELECT * FROM "automation_logs" WHERE automation_id IN (${inList(automationIds)})`
        : `SELECT * FROM "automation_logs" WHERE false`,
      params: [],
    }),
  },
  {
    table: "labels",
    buildQuery: ({ boardIds, orgId }) => ({
      sql: `SELECT * FROM "labels" WHERE org_id = '${orgId}'` +
        (boardIds.length > 0 ? ` OR board_id IN (${inList(boardIds)})` : ""),
      params: [],
    }),
  },
  {
    table: "sprints",
    buildQuery: ({ boardIds }) => ({
      sql: boardIds.length > 0
        ? `SELECT * FROM "sprints" WHERE board_id IN (${inList(boardIds)})`
        : `SELECT * FROM "sprints" WHERE false`,
      params: [],
    }),
  },
  // ── Lists + Cards (largest tables) ───────────────────────────────────────
  {
    table: "lists",
    buildQuery: ({ boardIds }) => ({
      sql: boardIds.length > 0
        ? `SELECT * FROM "lists" WHERE board_id IN (${inList(boardIds)})`
        : `SELECT * FROM "lists" WHERE false`,
      params: [],
    }),
  },
  {
    table: "cards",
    buildQuery: ({ listIds }) => ({
      sql: listIds.length > 0
        ? `SELECT * FROM "cards" WHERE list_id IN (${inList(listIds)})`
        : `SELECT * FROM "cards" WHERE false`,
      params: [],
    }),
  },
  {
    table: "card_label_assignments",
    buildQuery: ({ cardIds }) => ({
      sql: cardIds.length > 0
        ? `SELECT * FROM "card_label_assignments" WHERE card_id IN (${inList(cardIds)})`
        : `SELECT * FROM "card_label_assignments" WHERE false`,
      params: [],
    }),
  },
  {
    table: "custom_field_values",
    buildQuery: ({ cardIds }) => ({
      sql: cardIds.length > 0
        ? `SELECT * FROM "custom_field_values" WHERE card_id IN (${inList(cardIds)})`
        : `SELECT * FROM "custom_field_values" WHERE false`,
      params: [],
    }),
  },
  {
    table: "checklists",
    buildQuery: ({ cardIds }) => ({
      sql: cardIds.length > 0
        ? `SELECT * FROM "checklists" WHERE card_id IN (${inList(cardIds)})`
        : `SELECT * FROM "checklists" WHERE false`,
      params: [],
    }),
  },
  {
    table: "checklist_items",
    buildQuery: ({ checklistIds }) => ({
      sql: checklistIds.length > 0
        ? `SELECT * FROM "checklist_items" WHERE checklist_id IN (${inList(checklistIds)})`
        : `SELECT * FROM "checklist_items" WHERE false`,
      params: [],
    }),
  },
  {
    table: "card_dependencies",
    buildQuery: ({ cardIds }) => ({
      sql: cardIds.length > 0
        ? `SELECT * FROM "card_dependencies" WHERE source_card_id IN (${inList(cardIds)})`
        : `SELECT * FROM "card_dependencies" WHERE false`,
      params: [],
    }),
  },
  {
    table: "attachments",
    buildQuery: ({ cardIds }) => ({
      sql: cardIds.length > 0
        ? `SELECT * FROM "attachments" WHERE card_id IN (${inList(cardIds)})`
        : `SELECT * FROM "attachments" WHERE false`,
      params: [],
    }),
  },
  {
    table: "time_logs",
    buildQuery: ({ cardIds }) => ({
      sql: cardIds.length > 0
        ? `SELECT * FROM "time_logs" WHERE card_id IN (${inList(cardIds)})`
        : `SELECT * FROM "time_logs" WHERE false`,
      params: [],
    }),
  },
  {
    table: "comments",
    buildQuery: ({ cardIds }) => ({
      sql: cardIds.length > 0
        ? `SELECT * FROM "comments" WHERE card_id IN (${inList(cardIds)})`
        : `SELECT * FROM "comments" WHERE false`,
      params: [],
    }),
  },
  {
    table: "comment_reactions",
    buildQuery: ({ commentIds }) => ({
      sql: commentIds.length > 0
        ? `SELECT * FROM "comment_reactions" WHERE comment_id IN (${inList(commentIds)})`
        : `SELECT * FROM "comment_reactions" WHERE false`,
      params: [],
    }),
  },
  // ── Notifications + Analytics (append-only, bulk) ─────────────────────────
  {
    table: "notifications",
    buildQuery: ({ orgId }) => ({
      sql: `SELECT * FROM "notifications" WHERE org_id = '${orgId}'`,
      params: [],
    }),
  },
  {
    table: "activity_snapshots",
    buildQuery: ({ orgId }) => ({
      sql: `SELECT * FROM "activity_snapshots" WHERE org_id = '${orgId}'`,
      params: [],
    }),
  },
  {
    table: "user_analytics",
    buildQuery: ({ orgId }) => ({
      sql: `SELECT * FROM "user_analytics" WHERE org_id = '${orgId}'`,
      params: [],
    }),
  },
  {
    table: "audit_logs",
    buildQuery: ({ orgId }) => ({
      sql: `SELECT * FROM "audit_logs" WHERE org_id = '${orgId}'`,
      params: [],
    }),
  },
];

// ── Row batch copy ────────────────────────────────────────────────────────────

type RawRow = Record<string, unknown>;

/**
 * Reads all rows matching `query` from `src` in batches of BATCH_SIZE and
 * inserts them into the matching table on `dst` using ON CONFLICT DO NOTHING.
 * Returns [rowsRead, rowsInserted].
 */
async function copyTable(
  src: PrismaClient,
  dst: PrismaClient,
  spec: TableSpec,
  ids: ResolvedIds,
  dryRun: boolean,
): Promise<[number, number]> {
  const { sql } = spec.buildQuery(ids);
  const rows = await src.$queryRawUnsafe<RawRow[]>(sql);

  if (rows.length === 0) return [0, 0];
  if (dryRun) return [rows.length, 0];

  // Build column list from first row (all rows have the same shape)
  const cols = Object.keys(rows[0]);
  const quotedCols = cols.map((c) => `"${c}"`).join(", ");

  let inserted = 0;
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);

    // Build: ($1,$2,...), ($n+1,...) positional param placeholders
    const valuePlaceholders = batch
      .map(
        (_, ri) =>
          "(" + cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(",") + ")",
      )
      .join(", ");

    const values = batch.flatMap((row) =>
      cols.map((col) => {
        const v = row[col];
        // JSONB columns — Prisma returns them as objects; pg expects JSON string
        if (v !== null && typeof v === "object" && !(v instanceof Date) && !Buffer.isBuffer(v)) {
          return JSON.stringify(v);
        }
        return v;
      }),
    );

    const insertSql =
      `INSERT INTO "${spec.table}" (${quotedCols}) VALUES ${valuePlaceholders} ON CONFLICT DO NOTHING`;

    await dst.$executeRawUnsafe(insertSql, ...values);
    inserted += batch.length;
  }

  return [rows.length, inserted];
}

// ── ID resolution ─────────────────────────────────────────────────────────────

async function resolveIds(src: PrismaClient, orgId: string): Promise<ResolvedIds> {
  const q = <T>(sql: string) => src.$queryRawUnsafe<T[]>(sql);

  const memberRows   = await q<{ user_id: string }>(`SELECT user_id FROM "organization_users" WHERE organization_id = '${orgId}'`);
  const boardRows    = await q<{ id: string }>(`SELECT id FROM "boards" WHERE org_id = '${orgId}'`);
  const boardIds     = boardRows.map((r) => r.id);

  const [listRows, labelRows, automationRows, webhookRows, sprintRows, cfRows, savedViewRows, initiativeRows] =
    await Promise.all([
      boardIds.length > 0 ? q<{ id: string }>(`SELECT id FROM "lists" WHERE board_id IN (${inList(boardIds)})`) : Promise.resolve([]),
      q<{ id: string }>(`SELECT id FROM "labels" WHERE org_id = '${orgId}'`),
      q<{ id: string }>(`SELECT id FROM "automations" WHERE org_id = '${orgId}'`),
      q<{ id: string }>(`SELECT id FROM "webhooks" WHERE org_id = '${orgId}'`),
      boardIds.length > 0 ? q<{ id: string }>(`SELECT id FROM "sprints" WHERE board_id IN (${inList(boardIds)})`) : Promise.resolve([]),
      q<{ id: string }>(`SELECT id FROM "custom_fields" WHERE org_id = '${orgId}'`),
      q<{ id: string }>(`SELECT id FROM "saved_views" WHERE org_id = '${orgId}'`),
      q<{ id: string }>(`SELECT id FROM "initiatives" WHERE org_id = '${orgId}'`),
    ]);

  const listIds = listRows.map((r) => r.id);
  const [cardRows] = await Promise.all([
    listIds.length > 0 ? q<{ id: string }>(`SELECT id FROM "cards" WHERE list_id IN (${inList(listIds)})`) : Promise.resolve([]),
  ]);
  const cardIds = cardRows.map((r) => r.id);

  const [commentRows, checklistRows] = await Promise.all([
    cardIds.length > 0 ? q<{ id: string }>(`SELECT id FROM "comments" WHERE card_id IN (${inList(cardIds)})`) : Promise.resolve([]),
    cardIds.length > 0 ? q<{ id: string }>(`SELECT id FROM "checklists" WHERE card_id IN (${inList(cardIds)})`) : Promise.resolve([]),
  ]);

  const initiativeIds = initiativeRows.map((r) => r.id);
  const epicRows = initiativeIds.length > 0
    ? await q<{ id: string }>(`SELECT id FROM "epics" WHERE initiative_id IN (${inList(initiativeIds)})`)
    : [];

  return {
    orgId,
    userIds:        memberRows.map((r) => r.user_id),
    boardIds,
    listIds,
    cardIds,
    labelIds:       labelRows.map((r) => r.id),
    commentIds:     commentRows.map((r) => r.id),
    checklistIds:   checklistRows.map((r) => r.id),
    automationIds:  automationRows.map((r) => r.id),
    webhookIds:     webhookRows.map((r) => r.id),
    sprintIds:      sprintRows.map((r) => r.id),
    customFieldIds: cfRows.map((r) => r.id),
    savedViewIds:   savedViewRows.map((r) => r.id),
    initiativeIds,
    epicIds:        epicRows.map((r) => r.id),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log();
  console.log("╔═══════════════════════════════════════════════════════╗");
  console.log("║    NEXUS — Org Shard Migration (Dual-Write Window)    ║");
  console.log("╚═══════════════════════════════════════════════════════╝");
  console.log();
  console.log(`  Org ID       : ${TARGET_ORG_ID}`);
  console.log(`  Target shard : ${TARGET_SHARD}`);
  console.log(`  Mode         : ${DRY_RUN ? "DRY RUN (pass --execute to write)" : "⚡ EXECUTE — WRITING DATA"}`);
  console.log();

  const shardCount = getShardCount();
  if (TARGET_SHARD >= shardCount) {
    console.error(`  ❌ Target shard ${TARGET_SHARD} does not exist (configured shards: 0–${shardCount - 1})`);
    console.error(`  Set SHARD_${TARGET_SHARD}_DATABASE_URL first.`);
    process.exit(1);
  }

  const sourceShardIdx = getShardIndex(TARGET_ORG_ID!);
  if (sourceShardIdx === TARGET_SHARD) {
    console.error(`  ⚠  Org "${TARGET_ORG_ID}" already hashes to shard ${TARGET_SHARD} with the current`);
    console.error(`  shard count (${shardCount}). Nothing to migrate.`);
    process.exit(0);
  }

  console.log(`  Source shard : ${sourceShardIdx}`);
  console.log();

  const src = getShardClient(sourceShardIdx);
  const dst = getShardClient(TARGET_SHARD);

  // ── Verify org exists on source ────────────────────────────────────────────
  const orgCheck = await src.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "organizations" WHERE id = '${TARGET_ORG_ID}'`,
  );
  if (orgCheck.length === 0) {
    console.error(`  ❌ Organization "${TARGET_ORG_ID}" not found on source shard ${sourceShardIdx}.`);
    process.exit(1);
  }

  // ── Resolve all FK ID sets ─────────────────────────────────────────────────
  console.log("  Resolving FK ID sets from source…");
  const ids = await resolveIds(src, TARGET_ORG_ID!);
  console.log(`  · ${ids.userIds.length} users   · ${ids.boardIds.length} boards   · ${ids.listIds.length} lists`);
  console.log(`  · ${ids.cardIds.length} cards   · ${ids.commentIds.length} comments   · ${ids.checklistIds.length} checklists`);
  console.log(`  · ${ids.automationIds.length} automations   · ${ids.webhookIds.length} webhooks   · ${ids.sprintIds.length} sprints`);
  console.log();

  // ── Copy tables ────────────────────────────────────────────────────────────
  const header = `  ${"Table".padEnd(30)} ${"Read".padStart(7)} ${"Written".padStart(9)}`;
  console.log(header);
  console.log("  " + "─".repeat(50));

  let totalRead = 0;
  let totalWritten = 0;

  for (const spec of TABLE_SPECS) {
    let read = 0, written = 0;
    try {
      [read, written] = await copyTable(src, dst, spec, ids, DRY_RUN);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Some tables may not exist in all schema versions — skip gracefully
      if (msg.includes("does not exist") || msg.includes("relation") ) {
        console.log(`  ${spec.table.padEnd(30)} ${"SKIP".padStart(7)} (table absent)`);
        continue;
      }
      throw err;
    }
    const writtenLabel = DRY_RUN ? "(dry)" : String(written);
    console.log(`  ${spec.table.padEnd(30)} ${String(read).padStart(7)} ${writtenLabel.padStart(9)}`);
    totalRead += read;
    totalWritten += written;
  }

  console.log("  " + "─".repeat(50));
  console.log(`  ${"TOTAL".padEnd(30)} ${String(totalRead).padStart(7)} ${DRY_RUN ? "(dry)" : String(totalWritten).padStart(9)}`);
  console.log();

  if (DRY_RUN) {
    console.log("  ✅ Dry run complete — no data was written.");
    console.log("     Add --execute to perform the migration.");
    console.log();
    process.exit(0);
  }

  // ── Verification: compare source vs target row counts ─────────────────────
  console.log("  Verifying row counts (source vs target)…");
  let allMatch = true;
  for (const spec of TABLE_SPECS) {
    const { sql } = spec.buildQuery(ids);
    const countSql = `SELECT COUNT(*)::int AS n FROM (${sql}) sub`;
    const [srcCount] = await src.$queryRawUnsafe<{ n: number }[]>(countSql).catch(() => [{ n: 0 }]);
    const [dstCount] = await dst.$queryRawUnsafe<{ n: number }[]>(countSql).catch(() => [{ n: 0 }]);
    if (srcCount.n !== dstCount.n) {
      console.log(`  ⚠  ${spec.table.padEnd(28)} src=${srcCount.n} ≠ dst=${dstCount.n}`);
      allMatch = false;
    }
  }
  if (allMatch) {
    console.log("  ✅ All row counts match — migration verified.");
  } else {
    console.log();
    console.log("  ⚠  Some counts differ. Re-run --execute to backfill deltas.");
    console.log("     (ON CONFLICT DO NOTHING makes re-runs safe.)");
  }

  console.log();
  console.log("──[ Cutover Instructions ]".padEnd(58, "─"));
  console.log();
  console.log("  Data for this org now exists on BOTH shards.");
  console.log("  Live traffic is still routed to the SOURCE shard.");
  console.log();
  console.log("  To cut over (during low-traffic window, ~30 s):");
  console.log(`    1. Ensure SHARD_${TARGET_SHARD}_DATABASE_URL is set in Vercel env vars`);
  console.log(`    2. Deploy / redeploy the Next.js app`);
  console.log(`       The FNV-1a hash will now route this org to shard ${TARGET_SHARD}`);
  console.log(`    3. Verify: GET /api/health/shards  (Authorization: Bearer <CRON_SECRET>)`);
  console.log(`    4. Run: npm run test:shards`);
  console.log(`    5. (Optional) After 24 h, clean up org rows from shard ${sourceShardIdx}:`);
  console.log(`       DELETE FROM "organizations" WHERE id = '${TARGET_ORG_ID}' -- + cascade`);
  console.log();

  // Invalidate health cache so next request probes fresh
  invalidateShardHealthCache();

  process.exit(allMatch ? 0 : 1);
}

main().catch((err) => {
  console.error("\n❌ Migration failed:", err);
  process.exit(2);
});
