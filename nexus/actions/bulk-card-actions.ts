"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { db } from "@/lib/db";
import { Priority } from "@prisma/client";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const BulkUpdateSchema = z.object({
  cardIds: z.array(z.string().uuid()).min(1).max(200),
  update: z.object({
    listId: z.string().uuid().optional(),
    priority: z.nativeEnum(Priority).optional(),
    assigneeId: z.string().optional().nullable(),
    dueDate: z.string().datetime().optional().nullable(),
    labelIds: z.array(z.string().uuid()).optional(),
  }),
});

const BulkDeleteSchema = z.object({
  cardIds: z.array(z.string().uuid()).min(1).max(200),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function verifyCardsOwnership(cardIds: string[], orgId: string) {
  const cards = await db.card.findMany({
    where: {
      id: { in: cardIds },
      list: { board: { orgId } },
    },
    select: { id: true },
  });
  if (cards.length !== cardIds.length) {
    throw new Error("Some cards not found or not authorized.");
  }
  return cards;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function bulkUpdateCards(
  cardIds: string[],
  update: {
    listId?: string;
    priority?: Priority;
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
      // Update direct fields
      if (Object.keys(directUpdate).length > 0) {
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

    if (!cardIds.length) return { error: "No cards selected." };

    await verifyCardsOwnership(cardIds, ctx.orgId);

    // Verify target list belongs to the org
    const targetList = await db.list.findFirst({
      where: { id: targetListId, board: { orgId: ctx.orgId } },
      include: { board: true },
    });
    if (!targetList) return { error: "Target list not found." };

    // Get the max order in target list (order is String/LexoRank)
    const existingCards = await db.card.findMany({
      where: { listId: targetListId },
      select: { order: true },
      orderBy: { order: "desc" },
      take: 1,
    });
    const baseOrder = existingCards[0]?.order ?? "m";
    // Append increasing suffixes to maintain sort order
    const newOrders = cardIds.map((_, i) => baseOrder + String.fromCharCode(97 + i));

    await db.$transaction(
      cardIds.map((id, i) =>
        db.card.update({
          where: { id },
          data: { listId: targetListId, order: newOrders[i] },
        })
      )
    );

    revalidatePath(`/board/${targetList.boardId}`);

    return { data: { moved: cardIds.length } };
  } catch (e) {
    console.error("[BULK_MOVE_CARDS]", e);
    return { error: e instanceof Error ? e.message : "Failed to move cards." };
  }
}
