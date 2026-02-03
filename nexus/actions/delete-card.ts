"use server";

import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { protectDemoMode } from "@/lib/action-protection";
import { createAuditLog } from "@/lib/create-audit-log";
import { ACTION, ENTITY_TYPE } from "@prisma/client";

export async function deleteCard(id: string, boardId: string) {
  try {
    // Get board to check orgId for demo protection
    const board = await db.board.findUnique({
      where: { id: boardId },
      select: { orgId: true },
    });

    if (!board) {
      throw new Error("Board not found");
    }

    // Demo mode protection
    const demoCheck = await protectDemoMode(board.orgId);
    if (demoCheck) {
      throw new Error("Cannot modify demo data");
    }

    // Get card info before deletion
    const card = await db.card.findUnique({
      where: { id },
      select: { title: true },
    });

    if (!card) {
      throw new Error("Card not found");
    }

    await db.card.delete({
      where: { id },
    });

    // Create audit log
    await createAuditLog({
      entityId: id,
      entityType: ENTITY_TYPE.CARD,
      entityTitle: card.title,
      action: ACTION.DELETE,
    });

    revalidatePath(`/board/${boardId}`);
  } catch (error) {
    console.error("Failed to delete card:", error);
    throw error;
  }
}