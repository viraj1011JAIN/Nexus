"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { z } from "zod";
import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { createAuditLog } from "@/lib/create-audit-log";

// ============================================
// CREATE LABEL
// ============================================

const CreateLabelSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name too long"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format"),
  orgId: z.string(),
});

async function createLabelHandler(data: z.infer<typeof CreateLabelSchema>) {
  const { userId } = await auth();
  
  if (!userId) {
    return { error: "Unauthorized" };
  }

  const { name, color, orgId } = data;

  try {
    const label = await db.label.create({
      data: {
        name,
        color,
        orgId,
      },
    });

    await createAuditLog({
      action: ACTION.CREATE,
      entityId: label.id,
      entityType: ENTITY_TYPE.BOARD, // Using BOARD as proxy for label
      entityTitle: label.name,
    });

    revalidatePath(`/dashboard`);
    return { data: label };
  } catch (error) {
    console.error("Create label error:", error);
    return { error: "Failed to create label" };
  }
}

export const createLabel = createSafeAction(CreateLabelSchema, createLabelHandler);

// ============================================
// ASSIGN LABEL TO CARD
// ============================================

const AssignLabelSchema = z.object({
  cardId: z.string(),
  labelId: z.string(),
  orgId: z.string(),
});

async function assignLabelHandler(data: z.infer<typeof AssignLabelSchema>) {
  const { userId } = await auth();
  
  if (!userId) {
    return { error: "Unauthorized" };
  }

  const { cardId, labelId, orgId } = data;

  try {
    // Check if already assigned
    const existing = await db.cardLabelAssignment.findUnique({
      where: {
        cardId_labelId: {
          cardId,
          labelId,
        },
      },
    });

    if (existing) {
      return { error: "Label already assigned to this card" };
    }

    const assignment = await db.cardLabelAssignment.create({
      data: {
        cardId,
        labelId,
      },
      include: {
        label: true,
        card: true,
      },
    });

    await createAuditLog({
      action: ACTION.UPDATE,
      entityId: cardId,
      entityType: ENTITY_TYPE.CARD,
      entityTitle: assignment.card.title,
    });

    revalidatePath(`/board/${assignment.card.listId}`);
    return { data: assignment };
  } catch (error) {
    console.error("Assign label error:", error);
    return { error: "Failed to assign label" };
  }
}

export const assignLabel = createSafeAction(AssignLabelSchema, assignLabelHandler);

// ============================================
// UNASSIGN LABEL FROM CARD
// ============================================

const UnassignLabelSchema = z.object({
  cardId: z.string(),
  labelId: z.string(),
  orgId: z.string(),
});

async function unassignLabelHandler(data: z.infer<typeof UnassignLabelSchema>) {
  const { userId } = await auth();
  
  if (!userId) {
    return { error: "Unauthorized" };
  }

  const { cardId, labelId, orgId } = data;

  try {
    const assignment = await db.cardLabelAssignment.findUnique({
      where: {
        cardId_labelId: {
          cardId,
          labelId,
        },
      },
      include: {
        card: true,
      },
    });

    if (!assignment) {
      return { error: "Label not assigned to this card" };
    }

    await db.cardLabelAssignment.delete({
      where: {
        cardId_labelId: {
          cardId,
          labelId,
        },
      },
    });

    await createAuditLog({
      action: ACTION.UPDATE,
      entityId: cardId,
      entityType: ENTITY_TYPE.CARD,
      entityTitle: assignment.card.title,
    });

    revalidatePath(`/board/${assignment.card.listId}`);
    return { data: { success: true } };
  } catch (error) {
    console.error("Unassign label error:", error);
    return { error: "Failed to unassign label" };
  }
}

export const unassignLabel = createSafeAction(UnassignLabelSchema, unassignLabelHandler);

// ============================================
// GET ORGANIZATION LABELS
// ============================================

export async function getOrganizationLabels(orgId: string) {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const labels = await db.label.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
    });

    return labels;
  } catch (error) {
    console.error("Get labels error:", error);
    throw new Error("Failed to fetch labels");
  }
}

// ============================================
// GET CARD LABELS
// ============================================

export async function getCardLabels(cardId: string) {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const assignments = await db.cardLabelAssignment.findMany({
      where: { cardId },
      include: {
        label: true,
      },
    });

    return assignments.map((a) => ({
      ...a.label,
      assignmentId: a.id,
    }));
  } catch (error) {
    console.error("Get card labels error:", error);
    throw new Error("Failed to fetch card labels");
  }
}
