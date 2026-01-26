"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { CreateCard } from "./schema";
import { ActionState } from "@/lib/create-safe-action";
import { z } from "zod";
import { Card } from "@prisma/client";
import { generateNextOrder } from "@/lib/lexorank";
import { logger } from "@/lib/logger";
import { protectDemoMode } from "@/lib/action-protection";

type InputType = z.infer<typeof CreateCard>;
type ReturnType = ActionState<InputType, Card>;

const handler = async (data: InputType): Promise<ReturnType> => {
  const { title, listId, boardId } = data;

  // Get board to check orgId for demo protection
  const board = await db.board.findUnique({
    where: { id: boardId },
    select: { orgId: true },
  });

  if (!board) {
    return { error: "Board not found" };
  }

  // Demo mode protection
  const demoCheck = await protectDemoMode<Card>(board.orgId);
  if (demoCheck) return demoCheck;

  try {
    // 1. Calculate order (append to end of list)
    const lastCard = await db.card.findFirst({
      where: { listId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const newOrder = generateNextOrder(lastCard?.order);

    // 2. Create the card
    const card = await db.card.create({
      data: {
        title,
        listId,
        order: newOrder,
      },
    });

    // 3. Refresh the board page
    revalidatePath(`/board/${boardId}`);
    return { data: card };
  } catch (error) {
    logger.error("Failed to create card", { error, listId, boardId });
    return { error: "Failed to create card. Please try again." };
  }
};

export const createCard = createSafeAction(CreateCard, handler);