"use server";
import "server-only";

import { revalidatePath } from "next/cache";
import { createDAL } from "@/lib/dal";
import { getTenantContext, requireRole } from "@/lib/tenant-context";
import { createSafeAction } from "@/lib/create-safe-action";
import { z } from "zod";
import { checkRateLimit, RATE_LIMITS } from "@/lib/action-protection";

// ============================================
// CREATE LABEL — ADMIN only (org-level resource)
// ============================================

const CreateLabelSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name too long"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format"),
  // orgId removed from schema — injected from Clerk JWT via DAL
});

async function createLabelHandler(data: z.infer<typeof CreateLabelSchema>) {
  const ctx = await getTenantContext();
  await requireRole("ADMIN", ctx); // Labels are org-level resources
  const rl = checkRateLimit(ctx.userId, "create-label", RATE_LIMITS["create-label"]);
  if (!rl.allowed) {
    return { error: `Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.` };
  }
  const dal = await createDAL(ctx);

  const label = await dal.labels.create({ name: data.name, color: data.color });

  await dal.auditLogs.create({
    action: "CREATE",
    entityId: label.id,
    entityType: "BOARD", // BOARD as proxy — no LABEL entity type in enum
    entityTitle: label.name,
  });

  revalidatePath(`/dashboard`);
  return { data: label };
}

export const createLabel = createSafeAction(CreateLabelSchema, createLabelHandler);

// ============================================
// ASSIGN LABEL TO CARD — MEMBER+
// ============================================

const AssignLabelSchema = z.object({
  cardId: z.string(),
  labelId: z.string(),
  // orgId removed — both card and label ownership verified by DAL using ctx.orgId
});

async function assignLabelHandler(data: z.infer<typeof AssignLabelSchema>) {
  const ctx = await getTenantContext();
  await requireRole("MEMBER", ctx);
  const rl = checkRateLimit(ctx.userId, "assign-label", RATE_LIMITS["assign-label"]);
  if (!rl.allowed) {
    return { error: `Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.` };
  }
  const dal = await createDAL(ctx);

  const assignment = await dal.labels.assign(data.cardId, data.labelId);

  return { data: assignment };
}

export const assignLabel = createSafeAction(AssignLabelSchema, assignLabelHandler);

// ============================================
// UNASSIGN LABEL FROM CARD — MEMBER+
// ============================================

const UnassignLabelSchema = z.object({
  cardId: z.string(),
  labelId: z.string(),
  // orgId removed
});

async function unassignLabelHandler(data: z.infer<typeof UnassignLabelSchema>) {
  const ctx = await getTenantContext();
  await requireRole("MEMBER", ctx);
  const rl = checkRateLimit(ctx.userId, "assign-label", RATE_LIMITS["assign-label"]);
  if (!rl.allowed) {
    return { error: `Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.` };
  }
  const dal = await createDAL(ctx);

  await dal.labels.unassign(data.cardId, data.labelId);

  return { data: { success: true } };
}

export const unassignLabel = createSafeAction(UnassignLabelSchema, unassignLabelHandler);

// ============================================
// GET ORGANIZATION LABELS — any authenticated member
// ============================================

export async function getOrganizationLabels() {
  const ctx = await getTenantContext();
  const dal = await createDAL(ctx);
  // orgId is from context — callers cannot query another org's labels
  return dal.labels.findMany();
}

// ============================================
// GET CARD LABELS
// ============================================

export async function getCardLabels(cardId: string) {
  const ctx = await getTenantContext();
  const dal = await createDAL(ctx);
  // DAL verifies card belongs to this org before returning its labels
  return dal.labels.findManyForCard(cardId);
}
