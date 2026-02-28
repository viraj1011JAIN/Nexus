"use server";
import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PRIORITY_VALUES, type PriorityValue } from "@/lib/priority-values";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { db } from "@/lib/db";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const BulkUpdateSchema = z.object({
  cardIds: z.array(z.string().uuid()).min(1).max(200),
  update: z.object({
    listId: z.string().uuid().optional(),
    priority: z.enum(PRIORITY_VALUES).optional(),
    assigneeId: z.string().optional().nullable(),
    dueDate: z.string().datetime().optional().nullable(),
    labelIds: z.array(z.string().uuid()).optional(),
  }),
});

const BulkDeleteSchema = z.object({
  cardIds: z.array(z.string().uuid()).min(1).max(200),
});

const BulkMoveSchema = z.object({
  cardIds: z.array(z.string().uuid()).min(1).max(200),
  targetListId: z.string().uuid(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function verifyCardsOwnership(cardIds: string[], orgId: string) {
  // Deduplicate to avoid false negatives from repeated IDs
  const uniqueCardIds = [...new Set(cardIds)];
  const cards = await db.card.findMany({
    where: {
      id: { in: uniqueCardIds },
      list: { board: { orgId } },
    },
    select: { id: true },
  });
  if (cards.length !== uniqueCardIds.length) {
    throw new Error("Some cards not found or not authorized.");
  }
  return cards;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function bulkUpdateCards(
  cardIds: string[],
  update: {
    listId?: string;
    priority?: PriorityValue;
    assigneeId?: string | null;
    dueDate?: string | null;
    labelIds?: string[];
  }
) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const validated = BulkUpdateSchema.parse({ cardIds, update });
    await verifyCardsOwnership(validated.cardIds, ctx.orgId);

    const { labelIds, dueDate, assigneeId, ...directUpdate } = validated.update;

    await db.$transaction(async (tx) => {
      // Update direct fields — also run when only assigneeId or dueDate are set
      if (
        Object.keys(directUpdate).length > 0 ||
        assigneeId !== undefined ||
        dueDate !== undefined
      ) {
        await tx.card.updateMany({
          where: { id: { in: validated.cardIds } },
          data: {
            ...directUpdate,
            ...(assigneeId !== undefined ? { assigneeId } : {}),
            ...(dueDate !== undefined
              ? { dueDate: dueDate ? new Date(dueDate) : null }
              : {}),
          },
        });
      }

      // Update labels: add (not replace) labels to each card
      if (labelIds && labelIds.length > 0) {
        for (const cardId of validated.cardIds) {
          for (const labelId of labelIds) {
            await tx.cardLabelAssignment.upsert({
              where: { cardId_labelId: { cardId, labelId } },
              create: { cardId, labelId },
              update: {},
            });
          }
        }
      }
    });

    // Revalidate all affected boards
    const affectedCards = await db.card.findMany({
      where: { id: { in: validated.cardIds } },
      select: { list: { select: { boardId: true } } },
    });
    const boardIds = [...new Set(affectedCards.map((c) => c.list.boardId))];
    boardIds.forEach((id) => revalidatePath(`/board/${id}`));

    return { data: { updated: validated.cardIds.length } };
  } catch (e) {
    console.error("[BULK_UPDATE_CARDS]", e);
    return { error: e instanceof Error ? e.message : "Failed to update cards." };
  }
}

export async function bulkDeleteCards(cardIds: string[]) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const validated = BulkDeleteSchema.parse({ cardIds });
    await verifyCardsOwnership(validated.cardIds, ctx.orgId);

    // Get board IDs before deletion
    const affectedCards = await db.card.findMany({
      where: { id: { in: validated.cardIds } },
      select: { list: { select: { boardId: true } } },
    });
    const boardIds = [...new Set(affectedCards.map((c) => c.list.boardId))];

    await db.card.deleteMany({
      where: { id: { in: validated.cardIds } },
    });

    boardIds.forEach((id) => revalidatePath(`/board/${id}`));

    return { data: { deleted: validated.cardIds.length } };
  } catch (e) {
    console.error("[BULK_DELETE_CARDS]", e);
    return { error: e instanceof Error ? e.message : "Failed to delete cards." };
  }
}

export async function bulkMoveCards(cardIds: string[], targetListId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    // Validate inputs with the same schema pattern as other bulk actions
    const validated = BulkMoveSchema.parse({ cardIds, targetListId });

    await verifyCardsOwnership(validated.cardIds, ctx.orgId);

    // Verify target list belongs to the org
    const targetList = await db.list.findFirst({
      where: { id: validated.targetListId, board: { orgId: ctx.orgId } },
      include: { board: true },
    });
    if (!targetList) return { error: "Target list not found." };

    // Capture source board IDs before moving (for cache revalidation)
    const sourceCards = await db.card.findMany({
      where: { id: { in: validated.cardIds } },
      select: { list: { select: { boardId: true } } },
    });
    const sourceBoardIds = [...new Set(sourceCards.map((c) => c.list.boardId))]
      .filter((id) => id !== targetList.boardId); // exclude target (revalidated below)

    // Generate bounded order keys: timestamp base + zero-padded index delimiter
    const baseTs = Date.now().toString(36);
    const newOrders = validated.cardIds.map(
      (_, i) => `${baseTs}:${String(i).padStart(6, "0")}`
    );

    await db.$transaction(
      validated.cardIds.map((id, i) =>
        db.card.update({
          where: { id },
          data: { listId: validated.targetListId, order: newOrders[i] },
        })
      )
    );

    // Revalidate target board and all source boards
    revalidatePath(`/board/${targetList.boardId}`);
    sourceBoardIds.forEach((id) => revalidatePath(`/board/${id}`));

    return { data: { moved: validated.cardIds.length } };
  } catch (e) {
    console.error("[BULK_MOVE_CARDS]", e);
    return { error: e instanceof Error ? e.message : "Failed to move cards." };
  }
}
