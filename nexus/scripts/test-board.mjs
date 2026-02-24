import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

if (process.env.NODE_ENV === "production") {
  console.warn("⚠️  Refusing to run test-board cleanup in production. Exiting.");
  await db.$disconnect();
  process.exit(0);
}

const isDryRun = process.env.CONFIRM_DELETE !== "yes";
try {
  if (isDryRun) {
    const count = await db.board.count({ where: { title: "Test Board" } });
    console.log(`[dry-run] Would delete ${count} test board(s). Set CONFIRM_DELETE=yes to proceed.`);
  } else {
    const r = await db.board.deleteMany({ where: { title: "Test Board" } });
    console.log("Cleaned up", r.count, "test boards");
  }
} catch (e) {
  console.error("ERR:", e);
  process.exit(1);
} finally {
  await db.$disconnect();
}
