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

async function main() {
  const automations = await db.automation.findMany({
    select: { id: true, actions: true },
  });

  let updated = 0;

  for (const automation of automations) {
    // actions is stored as Json — cast and inspect
    const actions = automation.actions as Array<{ type: string; [key: string]: unknown }>;
    if (!Array.isArray(actions)) continue;

    const hasLegacy = actions.some((a) => a.type === "COMPLETE_CHECKLIST_ITEM");
    if (!hasLegacy) continue;

    const migrated = actions.map((a) =>
      a.type === "COMPLETE_CHECKLIST_ITEM" ? { ...a, type: "COMPLETE_CHECKLIST" } : a
    );

    await db.automation.update({
      where: { id: automation.id },
      data: { actions: migrated as object },
    });

    updated++;
    console.log(`[migrate] Updated automation ${automation.id}`);
  }

  console.log(`\nDone. ${updated} automation(s) updated out of ${automations.length} total.`);
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
