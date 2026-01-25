"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function deleteCard(id: string, boardId: string) {
  try {
    await db.card.delete({
      where: {
        id,
      },
    });

    revalidatePath(`/board/${boardId}`);
  } catch (error) {
    console.error("Failed to delete card:", error);
  }
}