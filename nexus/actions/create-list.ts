"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { CreateList } from "./schema";
import { ActionState } from "@/lib/create-safe-action";
import { z } from "zod";
import { List, ACTION, ENTITY_TYPE } from "@prisma/client";
import { generateNextOrder } from "@/lib/lexorank";
import { protectDemoMode } from "@/lib/action-protection";
import { createAuditLog } from "@/lib/create-audit-log";

type InputType = z.infer<typeof CreateList>;
type ReturnType = ActionState<InputType, List>;

const handler = async (data: InputType): Promise<ReturnType> => {
  const { title, boardId } = data;

  // Get board to check orgId for demo protection
  const board = await db.board.findUnique({
    where: { id: boardId },
    select: { orgId: true },
  });

  if (!board) {
    return { error: "Board not found" };
  }

  // Demo mode protection
  const demoCheck = await protectDemoMode<List>(board.orgId);
  if (demoCheck) return demoCheck;

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

    // 3. Create audit log
    await createAuditLog({
      entityId: list.id,
      entityType: ENTITY_TYPE.LIST,
      entityTitle: list.title,
      action: ACTION.CREATE,
    });

    // 4. Refresh the board page
    revalidatePath(`/board/${boardId}`);
    return { data: list };
  } catch (error) {
    console.error("[CREATE_LIST_ERROR]", error);
    return { error: "Failed to create list. Please try again." };
  }
};

export const createList = createSafeAction(CreateList, handler);