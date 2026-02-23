"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTenantContext, requireRole, isDemoContext } from "@/lib/tenant-context";
import { createDAL } from "@/lib/dal";
import { db } from "@/lib/db";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const AddChecklistSchema = z.object({
  cardId: z.string().uuid(),
  boardId: z.string().uuid(),
  title: z.string().min(1).max(200).default("Checklist"),
});

const AddChecklistItemSchema = z.object({
  checklistId: z.string().uuid(),
  boardId: z.string().uuid(),
  title: z.string().min(1).max(500),
});

const UpdateChecklistItemSchema = z.object({
  id: z.string().uuid(),
  boardId: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  isComplete: z.boolean().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
});

const DeleteChecklistSchema = z.object({
  id: z.string().uuid(),
  boardId: z.string().uuid(),
});

const RenameChecklistSchema = z.object({
  id: z.string().uuid(),
  boardId: z.string().uuid(),
  title: z.string().min(1).max(200),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Verify the checklist's card belongs to the calling org. */
async function verifyChecklistOwnership(checklistId: string, orgId: string) {
  const cl = await db.checklist.findFirst({
    where: { id: checklistId },
    select: { card: { select: { list: { select: { board: { select: { orgId: true } } } } } } },
  });
  if (!cl || cl.card.list.board.orgId !== orgId) throw new Error("Not found");
  return cl;
}

async function verifyItemOwnership(itemId: string, orgId: string) {
  const item = await db.checklistItem.findFirst({
    where: { id: itemId },
    include: { checklist: { include: { card: { include: { list: { include: { board: { select: { orgId: true } } } } } } } } },
  });
  if (!item || item.checklist.card.list.board.orgId !== orgId) throw new Error("Not found");
  return item;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function getChecklists(cardId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    const checklists = await db.checklist.findMany({
      where: {
        cardId,
        card: { list: { board: { orgId: ctx.orgId } } },
      },
      include: {
        items: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { order: "asc" },
    });

    return { data: checklists };
  } catch (e) {
    console.error("[GET_CHECKLISTS]", e);
    return { error: "Failed to load checklists." };
  }
}

export async function addChecklist(raw: unknown) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const input = AddChecklistSchema.parse(raw);

    // Verify card ownership
    const card = await db.card.findFirst({
      where: { id: input.cardId, list: { board: { orgId: ctx.orgId } } },
    });
    if (!card) return { error: "Card not found." };

    const checklist = await db.checklist.create({
      data: {
        cardId: input.cardId,
        title: input.title,
        order: String(Date.now()),
      },
      include: { items: true },
    });

    revalidatePath(`/board/${input.boardId}`);
    return { data: checklist };
  } catch (e) {
    console.error("[ADD_CHECKLIST]", e);
    return { error: "Failed to add checklist." };
  }
}

export async function renameChecklist(raw: unknown) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const input = RenameChecklistSchema.parse(raw);
    await verifyChecklistOwnership(input.id, ctx.orgId);

    await db.checklist.update({
      where: { id: input.id },
      data: { title: input.title },
    });

    revalidatePath(`/board/${input.boardId}`);
    return { data: true };
  } catch (e) {
    console.error("[RENAME_CHECKLIST]", e);
    return { error: "Failed to rename checklist." };
  }
}

export async function deleteChecklist(raw: unknown) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const input = DeleteChecklistSchema.parse(raw);
    await verifyChecklistOwnership(input.id, ctx.orgId);

    await db.checklist.delete({ where: { id: input.id } });

    revalidatePath(`/board/${input.boardId}`);
    return { data: true };
  } catch (e) {
    console.error("[DELETE_CHECKLIST]", e);
    return { error: "Failed to delete checklist." };
  }
}

export async function addChecklistItem(raw: unknown) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const input = AddChecklistItemSchema.parse(raw);
    await verifyChecklistOwnership(input.checklistId, ctx.orgId);

    const item = await db.checklistItem.create({
      data: {
        checklistId: input.checklistId,
        title: input.title,
        order: String(Date.now()),
      },
    });

    revalidatePath(`/board/${input.boardId}`);
    return { data: item };
  } catch (e) {
    console.error("[ADD_CHECKLIST_ITEM]", e);
    return { error: "Failed to add item." };
  }
}

export async function updateChecklistItem(raw: unknown) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    const input = UpdateChecklistItemSchema.parse(raw);
    await verifyItemOwnership(input.id, ctx.orgId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.isComplete !== undefined) {
      updateData.isComplete = input.isComplete;
      updateData.completedAt = input.isComplete ? new Date() : null;
    }
    if ("dueDate" in input) updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    if ("assigneeId" in input) updateData.assigneeId = input.assigneeId;

    const item = await db.checklistItem.update({
      where: { id: input.id },
      data: updateData,
    });

    revalidatePath(`/board/${input.boardId}`);
    return { data: item };
  } catch (e) {
    console.error("[UPDATE_CHECKLIST_ITEM]", e);
    return { error: "Failed to update item." };
  }
}

export async function deleteChecklistItem(id: string, boardId: string) {
  try {
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);
    if (isDemoContext(ctx)) return { error: "Not available in demo mode." };

    await verifyItemOwnership(id, ctx.orgId);
    await db.checklistItem.delete({ where: { id } });

    revalidatePath(`/board/${boardId}`);
    return { data: true };
  } catch (e) {
    console.error("[DELETE_CHECKLIST_ITEM]", e);
    return { error: "Failed to delete item." };
  }
}

// Types for use in UI
export type ChecklistWithItems = Awaited<ReturnType<typeof getChecklists>>["data"] extends undefined
  ? never
  : NonNullable<Awaited<ReturnType<typeof getChecklists>>["data"]>[number];
