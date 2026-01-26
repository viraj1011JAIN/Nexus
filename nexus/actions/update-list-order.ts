"use server";

import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { protectDemoMode } from "@/lib/action-protection";

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