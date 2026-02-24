import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
try {
  const r = await db.board.deleteMany({ where: { title: "Test Board" } });
  console.log("Cleaned up", r.count, "test boards");
} catch (e) {
  console.log("ERR:", e.message);
} finally {
  await db.$disconnect();
}
