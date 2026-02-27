"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createDAL } from "@/lib/dal";
import { db } from "@/lib/db";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { checkRateLimit, RATE_LIMITS } from "@/lib/action-protection";
import { emitCardEvent } from "@/lib/event-bus";

export async function deleteCard(id: string, _boardId: string) {
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
  // Require that the list relation was fetched: without it the DB-verified boardId is
  // unavailable and we refuse to fall back to the untrusted caller-supplied parameter.
  if (!card.list) {
    throw new Error(`Card ${id} is missing its list association — cannot resolve a trusted boardId.`);
  }
  const trustedBoardId = card.list.boardId;

  // dal.cards.delete verifies Card→List→Board→orgId === ctx.orgId before deleting
  await dal.cards.delete(id);

  // Write audit log BEFORE emitting the event so that any consumer that processes
  // CARD_DELETED will always find a corresponding audit entry.
  await dal.auditLogs.create({
    entityId: id,
    entityType: "CARD",
    entityTitle: cardTitle,
    action: "DELETE",
  });

  // Fire CARD_DELETED event for automations + webhooks (TASK-019).
  // Wrapped in after() so the serverless runtime keeps the function alive until
  // delivery completes, and the event is guaranteed to fire after the audit write.
  after(() => emitCardEvent(
    { type: "CARD_DELETED", orgId: ctx.orgId, boardId: trustedBoardId, cardId: id },
    { cardId: id, cardTitle, boardId: trustedBoardId, orgId: ctx.orgId }
  ));

  revalidatePath(`/board/${trustedBoardId}`);
}