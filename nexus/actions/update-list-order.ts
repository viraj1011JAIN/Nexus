"use server";
import "server-only";

import { createDAL } from "@/lib/dal";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { checkRateLimit, RATE_LIMITS } from "@/lib/action-protection";

interface ListUpdate {
  id: string;
  order: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  boardId: string;
}

export async function updateListOrder(items: ListUpdate[], boardId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    const rl = checkRateLimit(ctx.userId, "update-list-order", RATE_LIMITS["update-list-order"]);
    if (!rl.allowed) {
      return { success: false, error: `Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.` };
    }

    const dal = await createDAL(ctx);

    if (isDemoContext(ctx)) {
      return { success: false, error: "Cannot modify demo data" };
    }

    // DAL.lists.reorder:
    //   1. Verifies boardId→orgId === ctx.orgId
    //   2. Fetches all valid list IDs for this board from DB
    //   3. Rejects any client-supplied ID not in that set (prevents ID injection)
    await dal.lists.reorder(
      items.map(({ id, order }) => ({ id, order })),
      boardId
    );

    return { success: true };
  } catch (error) {
    console.error("[UPDATE_LIST_ORDER_ERROR]", error);
    return { success: false, error: "Failed to reorder lists" };
  }
}