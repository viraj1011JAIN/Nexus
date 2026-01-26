"use server";

import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { protectDemoMode } from "@/lib/action-protection";

export async function deleteList(id: string, boardId: string) {
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

    await db.list.delete({
      where: {
        id,
        boardId,
      },
    });

    revalidatePath(`/board/${boardId}`);
  } catch (error) {
    console.error("Failed to delete list:", error);
    throw error;
  }
}