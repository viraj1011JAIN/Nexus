"use server";

import { createDAL } from "@/lib/dal";
import { db } from "@/lib/db";
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

  // Capture card title before deletion for the audit log fallback and event payload.
  // Include the list relation so we can use the DB-verified boardId instead of
  // trusting the caller-supplied parameter (prevents SSRF cache-invalidation abuse).
  const card = await db.card.findUnique({
    where: { id, list: { board: { orgId: ctx.orgId } } },
    include: { list: { select: { boardId: true } } },
  });
  if (!card) {
    throw new Error(`Card ${id} not found or access denied.`);
  }
  const cardTitle = card.title;
  // Use the DB-verified boardId; fall back to the caller param only as a last resort
  // (e.g. the list row was already deleted in an unusual concurrent-delete scenario).
  const trustedBoardId = card.list?.boardId ?? boardId;

  // dal.cards.delete verifies Card→List→Board→orgId === ctx.orgId before deleting
  await dal.cards.delete(id);

  // Fire CARD_DELETED event for automations + webhooks (TASK-019) — fire-and-forget.
  // emitCardEvent returns void and handles all internal errors; no .catch() needed.
  emitCardEvent(
    { type: "CARD_DELETED", orgId: ctx.orgId, boardId: trustedBoardId, cardId: id },
    { cardId: id, cardTitle, boardId: trustedBoardId, orgId: ctx.orgId }
  );

  await dal.auditLogs.create({
    entityId: id,
    entityType: "CARD",
    entityTitle: cardTitle,
    action: "DELETE",
  });

  revalidatePath(`/board/${trustedBoardId}`);
}