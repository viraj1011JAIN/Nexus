"use server";

import { revalidatePath } from "next/cache";
import { createDAL } from "@/lib/dal";
import { getTenantContext, requireRole } from "@/lib/tenant-context";
import { createSafeAction } from "@/lib/create-safe-action";
import { z } from "zod";
import { checkRateLimit, RATE_LIMITS } from "@/lib/action-protection";
import { emitCardEvent } from "@/lib/event-bus";

/** Minimal typed shape returned by any card operation that includes its list. */
type CardWithList = {
  title: string;
  list: { boardId: string } | null;
};

/**
 * Records an UPDATE audit log entry for a card and revalidates the board path.
 * Centralises the repeated audit + revalidate pattern in assign/unassign handlers.
 */
async function logCardUpdateAndRevalidate(
  dal: Awaited<ReturnType<typeof createDAL>>,
  card: CardWithList,
  cardId: string,
) {
  await dal.auditLogs.create({
    action: "UPDATE",
    entityId: cardId,
    entityType: "CARD",
    entityTitle: card.title ?? cardId,
  });
  if (card.list?.boardId) {
    revalidatePath(`/board/${card.list.boardId}`);
  }
}

// ============================================
// ASSIGN USER TO CARD — MEMBER+
// ============================================

const AssignUserSchema = z.object({
  cardId: z.string(),
  assigneeId: z.string(),
  // orgId removed — card ownership verified by DAL using ctx.orgId
});

async function assignUserHandler(data: z.infer<typeof AssignUserSchema>) {
  const ctx = await getTenantContext();
  await requireRole("MEMBER", ctx);
  const rl = checkRateLimit(ctx.userId, "assign-user", RATE_LIMITS["assign-user"]);
  if (!rl.allowed) {
    return { error: `Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.` };
  }
  const dal = await createDAL(ctx);

  // DAL verifies Card->List->Board->orgId === ctx.orgId before assigning
  const card = await dal.assignees.assign(data.cardId, data.assigneeId);
  await logCardUpdateAndRevalidate(dal, card, data.cardId);

  // Fire MEMBER_ASSIGNED event for automations + webhooks (TASK-019) — fire-and-forget
  // Guard: only emit when boardId is known so the event has valid routing data.
  if (card.list?.boardId) {
    void emitCardEvent(
      {
        type: "MEMBER_ASSIGNED",
        orgId: ctx.orgId,
        boardId: card.list.boardId,
        cardId: data.cardId,
        context: { assigneeId: data.assigneeId },
      },
      { cardId: data.cardId, cardTitle: card.title, assigneeId: data.assigneeId, orgId: ctx.orgId }
    ).catch((err) => console.error("[assign-user] emitCardEvent failed", err));
  }

  return { data: card };
}

export const assignUser = createSafeAction(AssignUserSchema, assignUserHandler);

// ============================================
// UNASSIGN USER FROM CARD — MEMBER+
// ============================================

const UnassignUserSchema = z.object({
  cardId: z.string(),
  // orgId removed
});

async function unassignUserHandler(data: z.infer<typeof UnassignUserSchema>) {
  const ctx = await getTenantContext();
  await requireRole("MEMBER", ctx);
  const rl = checkRateLimit(ctx.userId, "assign-user", RATE_LIMITS["assign-user"]);
  if (!rl.allowed) {
    return { error: `Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.` };
  }
  const dal = await createDAL(ctx);

  const card = await dal.assignees.unassign(data.cardId);
  await logCardUpdateAndRevalidate(dal, card, data.cardId);
  return { data: card };
}

export const unassignUser = createSafeAction(UnassignUserSchema, unassignUserHandler);

// ============================================
// GET ORGANIZATION MEMBERS (for assignee picker)
// orgId comes from Clerk — not from caller
// ============================================

export async function getOrganizationMembers() {
  const ctx = await getTenantContext();
  const dal = await createDAL(ctx);
  const members = await dal.assignees.findOrgMembers();
  return members.map((m) => m.user);
}
