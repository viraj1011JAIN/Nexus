"use server";

import { createDAL } from "@/lib/dal";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { checkRateLimit, RATE_LIMITS } from "@/lib/action-protection";
import { emitCardEvent } from "@/lib/event-bus";

interface CardUpdate {
  id: string;
  order: string;
  listId: string;
  title: string;
}

export async function updateCardOrder(items: CardUpdate[], boardId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    const rl = checkRateLimit(ctx.userId, "update-card-order", RATE_LIMITS["update-card-order"]);
    if (!rl.allowed) {
      return { success: false, error: `Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.` };
    }

    const dal = await createDAL(ctx);

    if (isDemoContext(ctx)) {
      return { success: false, error: "Cannot modify demo data" };
    }

    // DAL.cards.reorder:
    //   1. Verifies boardId→orgId === ctx.orgId
    //   2. Fetches all valid card IDs for this board from DB
    //   3. Rejects any client-supplied ID not in that set (prevents ID injection)
    await dal.cards.reorder(
      items.map(({ id, order, listId }) => ({ id, order, listId })),
      boardId
    );

    // Fire automations + webhooks for each moved card (TASK-019/020) — fire-and-forget
    for (const item of items) {
      void emitCardEvent(
        { type: "CARD_MOVED", orgId: ctx.orgId, boardId, cardId: item.id, context: { toListId: item.listId } },
        { cardId: item.id, cardTitle: item.title, listId: item.listId, boardId, orgId: ctx.orgId }
      ).catch(() => {});
    }

    return { success: true };
  } catch (error) {
    console.error("[UPDATE_CARD_ORDER_ERROR]", error);
    return { success: false, error: "Failed to reorder cards" };
  }
}