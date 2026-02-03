"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { z } from "zod";
import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { createAuditLog } from "@/lib/create-audit-log";

// ============================================
// ASSIGN USER TO CARD
// ============================================

const AssignUserSchema = z.object({
  cardId: z.string(),
  assigneeId: z.string(),
  orgId: z.string(),
});

async function assignUserHandler(data: z.infer<typeof AssignUserSchema>) {
  const { userId } = await auth();
  
  if (!userId) {
    return { error: "Unauthorized" };
  }

  const { cardId, assigneeId, orgId } = data;

  try {
    const card = await db.card.update({
      where: { id: cardId },
      data: { assigneeId },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
        list: true,
      },
    });

    await createAuditLog({
      action: ACTION.UPDATE,
      entityId: cardId,
      entityType: ENTITY_TYPE.CARD,
      entityTitle: card.title,
    });

    revalidatePath(`/board/${card.list.boardId}`);
    return { data: card };
  } catch (error) {
    console.error("Assign user error:", error);
    return { error: "Failed to assign user to card" };
  }
}

export const assignUser = createSafeAction(AssignUserSchema, assignUserHandler);

// ============================================
// UNASSIGN USER FROM CARD
// ============================================

const UnassignUserSchema = z.object({
  cardId: z.string(),
  orgId: z.string(),
});

async function unassignUserHandler(data: z.infer<typeof UnassignUserSchema>) {
  const { userId } = await auth();
  
  if (!userId) {
    return { error: "Unauthorized" };
  }

  const { cardId, orgId } = data;

  try {
    const card = await db.card.update({
      where: { id: cardId },
      data: { assigneeId: null },
      include: {
        list: true,
      },
    });

    await createAuditLog({
      action: ACTION.UPDATE,
      entityId: cardId,
      entityType: ENTITY_TYPE.CARD,
      entityTitle: card.title,
    });

    revalidatePath(`/board/${card.list.boardId}`);
    return { data: card };
  } catch (error) {
    console.error("Unassign user error:", error);
    return { error: "Failed to unassign user from card" };
  }
}

export const unassignUser = createSafeAction(UnassignUserSchema, unassignUserHandler);

// ============================================
// GET ORGANIZATION MEMBERS (for assignee picker)
// ============================================

export async function getOrganizationMembers(orgId: string) {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const members = await db.organizationUser.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            email: true,
          },
        },
      },
      orderBy: {
        user: {
          name: 'asc',
        },
      },
    });

    return members.map((m) => m.user);
  } catch (error) {
    console.error("Get organization members error:", error);
    throw new Error("Failed to fetch organization members");
  }
}
