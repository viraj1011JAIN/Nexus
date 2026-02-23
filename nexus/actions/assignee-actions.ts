"use server";

import { revalidatePath } from "next/cache";
import { createDAL } from "@/lib/dal";
import { getTenantContext, requireRole } from "@/lib/tenant-context";
import { createSafeAction } from "@/lib/create-safe-action";
import { z } from "zod";
import { checkRateLimit, RATE_LIMITS } from "@/lib/action-protection";

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

  await dal.auditLogs.create({
    action: "UPDATE",
    entityId: data.cardId,
    entityType: "CARD",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entityTitle: (card as any).title ?? data.cardId,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  revalidatePath(`/board/${(card as any).list?.boardId}`);
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

  await dal.auditLogs.create({
    action: "UPDATE",
    entityId: data.cardId,
    entityType: "CARD",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entityTitle: (card as any).title ?? data.cardId,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  revalidatePath(`/board/${(card as any).list?.boardId}`);
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
