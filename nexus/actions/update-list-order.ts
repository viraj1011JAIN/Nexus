"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

interface ListUpdate {
  id: string;
  order: string; // FIXED: Changed from number to string for lexorank
  title: string;
  createdAt: Date;
  updatedAt: Date;
  boardId: string;
}

export async function updateListOrder(items: ListUpdate[], boardId: string) {
  try {
    const transaction = items.map((list) =>
      db.list.update({
        where: { id: list.id },
        data: {
          order: list.order,
        },
      })
    );

    await db.$transaction(transaction);
    revalidatePath(`/board/${boardId}`);
    return { success: true };
  } catch (error) {
    console.error("[UPDATE_LIST_ORDER_ERROR]", error);
    return { success: false, error: "Failed to reorder lists" };
  }
}