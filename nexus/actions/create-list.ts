"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { CreateList } from "./schema";
import { ActionState } from "@/lib/create-safe-action";
import { z } from "zod";
import { List } from "@prisma/client";
import { generateNextOrder } from "@/lib/lexorank";

type InputType = z.infer<typeof CreateList>;
type ReturnType = ActionState<InputType, List>;

const handler = async (data: InputType): Promise<ReturnType> => {
  const { title, boardId } = data;

  try {
    // 1. Calculate order (append to end of list)
    const lastList = await db.list.findFirst({
      where: { boardId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const newOrder = generateNextOrder(lastList?.order);

    // 2. Create the list
    const list = await db.list.create({
      data: {
        title,
        boardId,
        order: newOrder,
      },
    });

    // 3. Refresh the board page
    revalidatePath(`/board/${boardId}`);
    return { data: list };
  } catch (error) {
    console.error("[CREATE_LIST_ERROR]", error);
    return { error: "Failed to create list. Please try again." };
  }
};

export const createList = createSafeAction(CreateList, handler);