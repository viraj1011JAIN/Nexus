"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function deleteList(id: string, boardId: string) {
  try {
    await db.list.delete({
      where: {
        id,
        boardId,
      },
    });

    revalidatePath(`/board/${boardId}`);
  } catch (error) {
    console.error("Failed to delete list:", error);
  }
}