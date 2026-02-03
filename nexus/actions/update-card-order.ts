"use server";

import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { protectDemoMode } from "@/lib/action-protection";

interface CardUpdate {
  id: string;
  order: string; // FIXED: Changed from number to string for lexorank
  listId: string;
  title: string;
}

export async function updateCardOrder(items: CardUpdate[], boardId: string) {
  try {
    // Get board to check orgId for demo protection
    const board = await db.board.findUnique({
      where: { id: boardId },
      select: { orgId: true },
    });

    if (!board) {
      return { success: false, error: "Board not found" };
    }

    // Demo mode protection
    const demoCheck = await protectDemoMode(board.orgId);
    if (demoCheck) {
      return { success: false, error: "Cannot modify demo data" };
    }

    const transaction = items.map((card) =>
      db.card.update({
        where: { id: card.id },
        data: {
          order: card.order,
          listId: card.listId,
        },
      })
    );

    await db.$transaction(transaction);
    // Note: No revalidatePath here for smooth drag-and-drop performance
    // The UI is already optimistically updated
    return { success: true };
  } catch (error) {
    console.error("[UPDATE_CARD_ORDER_ERROR]", error);
    return { success: false, error: "Failed to reorder cards" };
  }
}