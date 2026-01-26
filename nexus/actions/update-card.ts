"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { UpdateCard } from "./schema";
import { createAuditLog } from "@/lib/create-audit-log"; 
import { ACTION, ENTITY_TYPE, Card } from "@prisma/client";   
import { ActionState } from "@/lib/create-safe-action";
import { z } from "zod";
import { protectDemoMode } from "@/lib/action-protection";

type InputType = z.infer<typeof UpdateCard>;
type ReturnType = ActionState<InputType, Card>;

const handler = async (data: InputType): Promise<ReturnType> => {
  const { id, boardId, ...values } = data;

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
    const card = await db.card.update({
      where: { id },
      data: { ...values },
    });

    await createAuditLog({
      entityTitle: card.title,
      entityId: card.id,
      entityType: ENTITY_TYPE.CARD,
      action: ACTION.UPDATE,
    });

    revalidatePath(`/board/${boardId}`);
    return { data: card };
  } catch (error) {
    console.error("[UPDATE_CARD_ERROR]", error);
    return { error: "Failed to update." };
  }
};

export const updateCard = createSafeAction(UpdateCard, handler);