/**
 * One-time migration: rename persisted ActionType values
 * "COMPLETE_CHECKLIST_ITEM" → "COMPLETE_CHECKLIST" in automation.actions JSON.
 *
 * Run once after deploying the code change, then remove the backward-compat
 * shim from actions/automation-actions.ts (the duplicate case block).
 *
 * Usage:
 *   npx tsx scripts/migrate-automation-actions.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const BATCH_SIZE = 100;

async function main() {
  let cursor: string | undefined;
  let totalProcessed = 0;
  let updated = 0;

  // Process in cursor-based batches to avoid loading the entire table into memory.
  do {
    const batch = await db.automation.findMany({
      take: BATCH_SIZE,
      // Cursor-based pagination: skip the cursor row itself on subsequent pages.
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, actions: true },
      orderBy: { id: "asc" },
    });

    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;
    totalProcessed += batch.length;

    for (const automation of batch) {
      // actions is stored as Json — cast and inspect.
      // Guard against null elements that can appear in malformed JSON arrays.
      const actions = automation.actions as Array<{ type: string; [key: string]: unknown } | null>;
      if (!Array.isArray(actions)) continue;

      const hasLegacy = actions.some((a) => a != null && a.type === "COMPLETE_CHECKLIST_ITEM");
      if (!hasLegacy) continue;

      const migrated = actions.map((a) =>
        a != null && a.type === "COMPLETE_CHECKLIST_ITEM" ? { ...a, type: "COMPLETE_CHECKLIST" } : a
      );

      await db.automation.update({
        where: { id: automation.id },
        data: { actions: migrated as object },
      });

      updated++;
      console.log(`[migrate] Updated automation ${automation.id}`);
    }
  } while (true);

  console.log(`\nDone. ${updated} automation(s) updated out of ${totalProcessed} total.`);
  if (updated > 0) {
    console.log("You can now remove the backward-compat shim from actions/automation-actions.ts.");
  }
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    // Use process.exitCode instead of process.exit(1) so the promise chain
    // can complete and db.$disconnect() in .finally() runs before exiting.
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
