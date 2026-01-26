"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { DeleteBoard } from "./schema";
import { ActionState } from "@/lib/create-safe-action";
import { z } from "zod";
import { Board } from "@prisma/client";

type InputType = z.infer<typeof DeleteBoard>;
type ReturnType = ActionState<InputType, Board>;

const handler = async (data: InputType): Promise<ReturnType> => {
  const { orgId } = await auth();
  
  if (!orgId) {
    return { error: "Unauthorized - Please sign in" };
  }

  try {
    // Verify board belongs to organization before deleting
    const board = await db.board.findUnique({
      where: { id: data.id },
    });

    if (!board) {
      return { error: "Board not found" };
    }

    if (board.orgId !== orgId) {
      return { error: "Unauthorized to delete this board" };
    }

    // Delete board (cascade will delete all lists, cards, etc.)
    const deletedBoard = await db.board.delete({
      where: { id: data.id },
    });

    revalidatePath(`/`);
    return { data: deletedBoard };
  } catch (error) {
    console.error("[DELETE_BOARD_ERROR]", error);
    return { error: "Failed to delete board. Please try again." };
  }
};

export const deleteBoard = createSafeAction(DeleteBoard, handler);
