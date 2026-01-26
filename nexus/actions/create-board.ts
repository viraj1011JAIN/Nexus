"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { CreateBoard } from "./schema";
import { ActionState } from "@/lib/create-safe-action";
import { z } from "zod";
import { Board } from "@prisma/client";
import { logger } from "@/lib/logger";
import { STRIPE_CONFIG } from "@/lib/stripe";
import { protectDemoMode } from "@/lib/action-protection";

type InputType = z.infer<typeof CreateBoard>;
type ReturnType = ActionState<InputType, Board>;

const handler = async (data: InputType): Promise<ReturnType> => {
  const { orgId } = await auth();
  
  if (!orgId) {
    return { error: "Unauthorized - Please sign in or create an organization" };
  }

  // Demo mode protection
  const demoCheck = await protectDemoMode<Board>(orgId);
  if (demoCheck) return demoCheck;

  try {
    // Get or create organization
    let organization = await db.organization.findUnique({
      where: { id: orgId },
      include: {
        boards: true,
      },
    });

    // Auto-create organization if it doesn't exist
    if (!organization) {
      organization = await db.organization.create({
        data: {
          id: orgId,
          name: "My Organization",
          slug: orgId.toLowerCase(),
        },
        include: {
          boards: true,
        },
      });
    }

    // Feature Gating: Check board limit based on plan
    const currentBoardCount = organization.boards.length;
    const boardLimit = STRIPE_CONFIG.limits[organization.subscriptionPlan as "FREE" | "PRO"]?.boards || STRIPE_CONFIG.limits.FREE.boards;

    if (currentBoardCount >= boardLimit) {
      return { 
        error: `LIMIT_REACHED`,
        data: { limit: boardLimit, current: currentBoardCount } as any 
      };
    }

    const board = await db.board.create({
      data: {
        title: data.title,
        orgId: orgId,
      }
    });

    logger.info("Board created successfully", { boardId: board.id, orgId });
    revalidatePath(`/`);
    return { data: board };
  } catch (error) {
    logger.error("Failed to create board", { error, orgId });
    return { error: "Failed to create board. Please try again." };
  }
};

export const createBoard = createSafeAction(CreateBoard, handler);