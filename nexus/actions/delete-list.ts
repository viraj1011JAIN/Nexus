"use server";
import "server-only";

import { createDAL } from "@/lib/dal";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { revalidatePath } from "next/cache";
import { checkRateLimit, RATE_LIMITS } from "@/lib/action-protection";

export async function deleteList(id: string, boardId: string) {
  const ctx = await getTenantContext();
  await requireRole("ADMIN", ctx);

  const rl = checkRateLimit(ctx.userId, "delete-list", RATE_LIMITS["delete-list"]);
  if (!rl.allowed) {
    throw new Error(`Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.`);
  }

  const dal = await createDAL(ctx);

  if (isDemoContext(ctx)) {
    throw new Error("Cannot modify demo data");
  }

  // DAL verifies List→Board→orgId === ctx.orgId before deleting
  await dal.lists.delete(id, boardId);

  await dal.auditLogs.create({
    entityId: id,
    entityType: "LIST",
    entityTitle: id,
    action: "DELETE",
  });

  revalidatePath(`/board/${boardId}`);
}