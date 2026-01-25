"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { UpdateList } from "./schema";
import { ActionState } from "@/lib/create-safe-action";
import { z } from "zod";
import { List } from "@prisma/client";

type InputType = z.infer<typeof UpdateList>;
type ReturnType = ActionState<InputType, List>;

const handler = async (data: InputType): Promise<ReturnType> => {
  const { id, boardId, title } = data;

  try {
    const list = await db.list.update({
      where: {
        id,
        boardId,
      },
      data: {
        title,
      },
    });

    revalidatePath(`/board/${boardId}`);
    return { data: list };
  } catch (error) {
    console.error("[UPDATE_LIST_ERROR]", error);
    return { error: "Failed to update list. Please try again." };
  }
};

export const updateList = createSafeAction(UpdateList, handler);