"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { CreateBoard } from "./schema";
import { ActionState } from "@/lib/create-safe-action";
import { z } from "zod";
import { Board } from "@prisma/client";

type InputType = z.infer<typeof CreateBoard>;
type ReturnType = ActionState<InputType, Board>;

const handler = async (data: InputType): Promise<ReturnType> => {
  // MOCK AUTH: In production, this comes from Clerk 'auth()'
  const orgId = "default-organization"; 

  try {
    const board = await db.board.create({
      data: {
        title: data.title,
        orgId: orgId,
      }
    });

    revalidatePath(`/`);
    return { data: board };
  } catch (error) {
    console.error("[CREATE_BOARD_ERROR]", error);
    return { error: "Failed to create board. Please try again." };
  }
};

export const createBoard = createSafeAction(CreateBoard, handler);