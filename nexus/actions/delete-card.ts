"use server";

import { createDAL } from "@/lib/dal";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { revalidatePath } from "next/cache";
import { checkRateLimit, RATE_LIMITS } from "@/lib/action-protection";
import { emitCardEvent } from "@/lib/event-bus";

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

  // Capture card title before deletion for the audit log fallback and event payload
  const card = await dal.cards.findUnique(id);
  const cardTitle = card.title;

  // dal.cards.delete verifies Card→List→Board→orgId === ctx.orgId before deleting
  await dal.cards.delete(id);

  // Fire CARD_DELETED event for automations + webhooks (TASK-019) — fire-and-forget
  void emitCardEvent(
    { type: "CARD_DELETED", orgId: ctx.orgId, boardId, cardId: id },
    { cardId: id, cardTitle, boardId, orgId: ctx.orgId }
  ).catch((err) => console.error("[delete-card] emitCardEvent failed", err));

  await dal.auditLogs.create({
    entityId: id,
    entityType: "CARD",
    entityTitle: cardTitle,
    action: "DELETE",
  });

  revalidatePath(`/board/${boardId}`);
}