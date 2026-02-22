"use server";

import { createDAL } from "@/lib/dal";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { revalidatePath } from "next/cache";
import { checkRateLimit, RATE_LIMITS } from "@/lib/action-protection";

export async function deleteCard(id: string, boardId: string) {
  const ctx = await getTenantContext();
  // Deleting cards requires ADMIN role
  await requireRole("ADMIN", ctx);

  const rl = checkRateLimit(ctx.userId, "delete-card", RATE_LIMITS["delete-card"]);
  if (!rl.allowed) {
    throw new Error(`Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.`);
  }

  const dal = await createDAL(ctx);

  if (isDemoContext(ctx)) {
    throw new Error("Cannot modify demo data");
  }

  // dal.cards.delete verifies Card→List→Board→orgId === ctx.orgId before deleting
  await dal.cards.delete(id);

  await dal.auditLogs.create({
    entityId: id,
    entityType: "CARD",
    entityTitle: id, // title already gone after delete — use id as fallback
    action: "DELETE",
  });

  revalidatePath(`/board/${boardId}`);
}