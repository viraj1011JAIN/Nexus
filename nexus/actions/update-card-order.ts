"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

interface CardUpdate {
  id: string;
  order: string; // FIXED: Changed from number to string for lexorank
  listId: string;
  title: string;
}

export async function updateCardOrder(items: CardUpdate[], boardId: string) {
  try {
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
    revalidatePath(`/board/${boardId}`);
    return { success: true };
  } catch (error) {
    console.error("[UPDATE_CARD_ORDER_ERROR]", error);
    return { success: false, error: "Failed to reorder cards" };
  }
}